const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const validateEnv = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./services/logger');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const systemRoutes = require('./routes/systemRoutes');
const { protect, adminOnly } = require('./middleware/authMiddleware');
const { initSocket } = require('./services/socket');
const { initMaintenanceJobs } = require('./services/maintenance');
const { initJobQueue } = require('./services/jobQueue');
const { seedDemoContent } = require('./services/seedDemoContent');

validateEnv();

const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
app.disable('x-powered-by');

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = Array.from(new Set([FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean)));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 500),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(requestLogger);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', etag: true }));
app.use('/api', apiLimiter);

initSocket(server, allowedOrigins);

app.get('/', (req, res) => res.send('CampusConnect API is running 🚀'));
app.get('/api/version', (req, res) => res.json({ version: process.env.npm_package_version || '1.0.0' }));
app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'CampusConnect API',
    requestId: req.requestId || crypto.randomUUID(),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
app.get('/api/ready', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const socketReady = Boolean(require('./services/socket').getIO());
  res.setHeader('Cache-Control', 'no-store');
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ready' : 'degraded',
    database: dbReady ? 'connected' : 'disconnected',
    socket: socketReady ? 'ready' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/system', systemRoutes);

app.get('/api/protected', protect, (req, res) => res.json({ message: 'Protected route 🔒', user: req.user }));
app.get('/api/admin/guard', protect, adminOnly, (req, res) => res.json({ message: 'Welcome Admin 👑', user: req.user }));

app.use(notFound);
app.use(errorHandler);

const shutdown = async (signal) => {
  logger.warn(`Received ${signal}, shutting down gracefully`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown error', { error: error.message });
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => logger.error('Unhandled Rejection', { message: error?.message, stack: error?.stack }));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error.message, stack: error.stack });
  process.exit(1);
});

const startServer = async () => {
  try {
    await connectDB();
    initJobQueue();
    initMaintenanceJobs();
    try {
      const seedResult = await seedDemoContent();
      if (seedResult?.seeded) {
        logger.info('Demo content seeded', seedResult);
      }
    } catch (seedError) {
      logger.warn('Demo content seed skipped', { message: seedError.message });
    }
    server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  } catch (error) {
    logger.error('Failed to start server', { message: error.message, stack: error.stack });
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, server };
