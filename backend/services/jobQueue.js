const os = require('os');
const JobQueue = require('../models/JobQueue');
const logger = require('./logger');
const { emitToAdmins } = require('./socket');

const state = {
  running: false,
  lastProcessAt: null,
  processed: 0,
  succeeded: 0,
  failed: 0,
  lastError: '',
  intervalMs: Math.max(Number(process.env.JOB_QUEUE_POLL_MS || 5000), 2000),
  nextRunAt: null,
  recent: [],
};

const handlers = new Map();
let intervalHandle = null;

const normalizeType = (type) => String(type || '').trim().toLowerCase();
const isEmailJob = (jobOrType) => normalizeType(jobOrType?.type || jobOrType) === 'email.send';

const isNonRetryableEmailError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  return Boolean(
    error?.nonRetryable ||
    error?.retryable === false ||
    error?.reason === 'smtp_auth_or_rate_limited' ||
    msg.includes('invalid login') ||
    msg.includes('too many login attempts') ||
    msg.includes('authentication failed') ||
    msg.includes('username and password not accepted') ||
    msg.includes('less secure app') ||
    msg.includes('535-5.7.8') ||
    msg.includes('534-5.7.9') ||
    msg.includes('454-4.7.0')
  );
};

const registerJobHandler = (type, handler) => {
  const key = normalizeType(type);
  if (!key || typeof handler !== 'function') return;
  handlers.set(key, handler);
};

const enqueueJob = async (type, payload = {}, options = {}) => {
  const key = normalizeType(type);
  if (!key) throw new Error('Job type is required');
  const doc = await JobQueue.create({
    type: key,
    payload,
    priority: Number(options.priority || 0),
    maxAttempts: Math.max(Number(options.maxAttempts || process.env.QUEUE_MAX_ATTEMPTS || 3), 1),
    runAt: options.runAt ? new Date(options.runAt) : new Date(),
    createdBy: options.createdBy || null,
  });
  emitToAdmins('jobqueue:update', { action: 'enqueue', jobId: String(doc._id), type: doc.type, status: doc.status });
  return doc;
};

const runHandler = async (job) => {
  const handler = handlers.get(normalizeType(job.type));
  if (!handler) throw new Error(`No handler registered for ${job.type}`);
  return handler(job.payload || {}, job);
};

const processOne = async (job) => {
  const startedAt = Date.now();
  try {
    job.status = 'processing';
    job.lockedAt = new Date();
    job.lockedBy = `${os.hostname()}:${process.pid}`;
    job.attempts += 1;
    await job.save();

    const result = await runHandler(job);
    job.status = 'success';
    job.result = result || {};
    job.error = '';
    job.lastError = '';
    job.completedAt = new Date();
    job.lockedAt = null;
    job.lockedBy = '';
    await job.save();

    state.succeeded += 1;
    state.recent.unshift({ id: String(job._id), type: job.type, status: job.status, attempts: job.attempts, completedAt: job.completedAt, durationMs: Date.now() - startedAt });
    state.recent = state.recent.slice(0, 20);
    emitToAdmins('jobqueue:update', { action: 'success', jobId: String(job._id), type: job.type, status: job.status });
    return { ok: true, jobId: String(job._id) };
  } catch (error) {
    job.lastError = error.message;
    job.error = error.message;
    job.lockedAt = null;
    job.lockedBy = '';
    job.completedAt = null;

    const nonRetryable = isEmailJob(job) && isNonRetryableEmailError(error);
    if (nonRetryable || job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      state.failed += 1;
    } else {
      job.status = 'retry_wait';
      job.runAt = new Date(Date.now() + Math.min(60_000, 5_000 * job.attempts));
    }

    await job.save();
    state.lastError = error.message;
    state.recent.unshift({ id: String(job._id), type: job.type, status: job.status, attempts: job.attempts, error: error.message, nonRetryable });
    state.recent = state.recent.slice(0, 20);
    emitToAdmins('jobqueue:update', { action: 'failed', jobId: String(job._id), type: job.type, status: job.status, error: error.message, nonRetryable });
    if (!nonRetryable && job.attempts < job.maxAttempts) throw error;
    return { ok: false, jobId: String(job._id), nonRetryable };
  }
};

const processJobs = async (limit = 10) => {
  if (state.running) return { running: true, skipped: true };
  state.running = true;
  state.lastProcessAt = new Date();
  let processed = 0;

  try {
    const jobs = await JobQueue.find({
      status: { $in: ['queued', 'retry_wait'] },
      runAt: { $lte: new Date() },
    })
      .sort({ priority: -1, runAt: 1, createdAt: 1 })
      .limit(Math.max(Number(limit) || 10, 1));

    for (const job of jobs) {
      try {
        const result = await processOne(job);
        if (result?.ok) processed += 1;
      } catch (error) {
        logger.warn('Background job failed', { jobId: String(job._id), type: job.type, message: error.message });
      }
    }

    state.processed += processed;
    return { processed, scanned: jobs.length };
  } catch (error) {
    state.lastError = error.message;
    logger.error('Job queue process error', { message: error.message, stack: error.stack });
    return { processed, error: error.message };
  } finally {
    state.running = false;
  }
};

const initJobQueue = () => {
  if (intervalHandle) return state;
  if (process.env.EMAIL_ASYNC_QUEUE !== 'false') {
    try {
      const { deliverEmail } = require('./emailService');
      registerJobHandler('email.send', async (payload) => deliverEmail(payload));
    } catch (error) {
      logger.warn('Unable to register email job handler', { message: error.message });
    }
  }

  const intervalMs = state.intervalMs;
  state.nextRunAt = new Date(Date.now() + intervalMs);
  intervalHandle = setInterval(async () => {
    state.nextRunAt = new Date(Date.now() + intervalMs);
    await processJobs();
  }, intervalMs);
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();
  processJobs().catch((error) => logger.warn('Initial job queue run failed', { message: error.message }));
  return state;
};

const getJobQueueState = () => ({
  running: state.running,
  lastProcessAt: state.lastProcessAt,
  processed: state.processed,
  succeeded: state.succeeded,
  failed: state.failed,
  lastError: state.lastError,
  intervalMs: state.intervalMs,
  nextRunAt: state.nextRunAt,
});

const getJobQueueStats = async (limit = 8) => {
  const [counts, recentJobs, failedJobs, queuedJobs] = await Promise.all([
    JobQueue.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
    JobQueue.find().sort({ createdAt: -1 }).limit(Math.max(Number(limit) || 8, 1)).lean(),
    JobQueue.countDocuments({ status: 'failed' }),
    JobQueue.countDocuments({ status: { $in: ['queued', 'retry_wait', 'processing'] } }),
  ]);

  const grouped = Object.fromEntries(counts.map((item) => [item._id, item.value]));
  return {
    total: Object.values(grouped).reduce((sum, value) => sum + Number(value || 0), 0),
    queued: queuedJobs,
    failed: failedJobs,
    statusBreakdown: grouped,
    recentJobs: recentJobs.map((job) => ({
      _id: String(job._id),
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      runAt: job.runAt,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.error,
    })),
  };
};

const retryJob = async (jobId) => {
  const job = await JobQueue.findById(jobId);
  if (!job) return null;
  job.status = 'queued';
  job.runAt = new Date();
  job.error = '';
  job.lastError = '';
  job.lockedAt = null;
  job.lockedBy = '';
  job.completedAt = null;
  await job.save();
  emitToAdmins('jobqueue:update', { action: 'retry', jobId: String(job._id), type: job.type, status: job.status });
  return job;
};

module.exports = {
  initJobQueue,
  registerJobHandler,
  enqueueJob,
  getJobQueueState,
  getJobQueueStats,
  retryJob,
  processJobs,
};
