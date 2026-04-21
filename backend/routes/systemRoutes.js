const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { getCacheStats } = require('../services/cache');
const { getMaintenanceState, runMaintenanceSweep, getMaintenanceRuns } = require('../services/maintenance');
const { getJobQueueState, getJobQueueStats, retryJob } = require('../services/jobQueue');

const router = express.Router();

router.get('/overview', protect, adminOnly, async (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    app: 'CampusConnect',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    platform: process.platform,
    hostname: os.hostname(),
    node: process.version,
    db: {
      state: mongoose.connection.readyState,
      connected: mongoose.connection.readyState === 1,
    },
    memory: {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external,
    },
    cache: getCacheStats(),
    jobs: getMaintenanceState(),
    queue: { ...(await getJobQueueStats(8)), state: getJobQueueState() },
  });
});

router.get('/jobs', protect, adminOnly, (req, res) => {
  res.json(getMaintenanceState());
});

router.get('/queue', protect, adminOnly, async (req, res) => {
  try {
    const [state, stats] = await Promise.all([
      Promise.resolve(getJobQueueState()),
      getJobQueueStats(20),
    ]);
    res.json({ state, stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/queue/:jobId/retry', protect, adminOnly, async (req, res) => {
  try {
    const job = await retryJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ message: 'Job re-queued', job });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get("/history", protect, adminOnly, async (req, res) => {
  try {
    const runs = await getMaintenanceRuns(req.query.limit || 10);
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/maintenance/run', protect, adminOnly, async (req, res) => {
  try {
    const result = await runMaintenanceSweep(req.body?.reason || 'manual');
    res.json({ message: 'Maintenance sweep completed', result });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
