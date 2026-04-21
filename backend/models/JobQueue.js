const mongoose = require('mongoose');

const jobQueueSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'retry_wait', 'processing', 'success', 'failed', 'cancelled'],
      default: 'queued',
      index: true,
    },
    priority: { type: Number, default: 0, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    runAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
    lastError: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

jobQueueSchema.index({ status: 1, runAt: 1, priority: -1, createdAt: 1 });
jobQueueSchema.index({ type: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('JobQueue', jobQueueSchema);
