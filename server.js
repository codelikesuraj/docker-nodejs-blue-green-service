const express = require('express');
const app = express();

// Configuration from environment variables
const APP_HOST = process.env.APP_HOST || '0.0.0.0';
const APP_POOL = process.env.APP_POOL || 'unknown';
const APP_PORT = process.env.APP_PORT || 3000;
const RELEASE_ID = process.env.RELEASE_ID || 'unknown';

// Chaos mode state
let chaosMode = {
  enabled: false,
  mode: 'error' // 'error' or 'timeout'
};

// Middleware to parse JSON
app.use(express.json());

// Middleware to add custom headers to all responses
app.use((req, res, next) => {
  res.setHeader('X-App-Pool', APP_POOL);
  res.setHeader('X-Release-Id', RELEASE_ID);
  next();
});

// Chaos mode middleware - simulates failures when enabled
const chaosMiddleware = (req, res, next) => {
  if (chaosMode.enabled) {
    if (chaosMode.mode === 'error') {
      return res.status(500).json({
        error: 'Chaos mode enabled - simulated error',
        pool: APP_POOL,
        timestamp: new Date().toISOString()
      });
    } else if (chaosMode.mode === 'timeout') {
      // Simulate timeout by not responding (request will hang)
      return; // Don't call next() or send response
    }
  }
  next();
};

// GET /version - Returns version info with headers
app.get('/version', chaosMiddleware, (req, res) => {
  res.json({
    pool: APP_POOL,
    releaseId: RELEASE_ID,
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// GET /healthz - Health check endpoint
app.get('/healthz', (req, res) => {
  // Always return healthy unless process is shutting down
  res.status(200).json({
    status: 'healthy',
    pool: APP_POOL,
    timestamp: new Date().toISOString()
  });
});

// POST /chaos/start - Start chaos mode
app.post('/chaos/start', (req, res) => {
  // Accept mode from query parameter, JSON body, or default to 'error'
  const mode = req.query.mode || req.body.mode || 'error';

  if (!['error', 'timeout'].includes(mode)) {
    return res.status(400).json({
      error: 'Invalid chaos mode. Use "error" or "timeout"',
      pool: APP_POOL
    });
  }

  chaosMode.enabled = true;
  chaosMode.mode = mode;

  console.log(`[${APP_POOL}] Chaos mode STARTED - Mode: ${mode}`);

  res.json({
    message: 'Chaos mode enabled',
    mode: chaosMode.mode,
    pool: APP_POOL,
    timestamp: new Date().toISOString()
  });
});

// POST /chaos/stop - Stop chaos mode
app.post('/chaos/stop', (req, res) => {
  const wasEnabled = chaosMode.enabled;
  chaosMode.enabled = false;

  console.log(`[${APP_POOL}] Chaos mode STOPPED`);

  res.json({
    message: 'Chaos mode disabled',
    wasEnabled,
    pool: APP_POOL,
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Blue/Green Deployment Service',
    pool: APP_POOL,
    releaseId: RELEASE_ID,
    endpoints: {
      version: 'GET /version',
      health: 'GET /healthz',
      chaosStart: 'POST /chaos/start (mode via query param or JSON body)',
      chaosStop: 'POST /chaos/stop'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    pool: APP_POOL
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${APP_POOL}] Error:`, err);
  res.status(500).json({
    error: 'Internal Server Error',
    pool: APP_POOL
  });
});

// Start server
const server = app.listen(APP_PORT, APP_HOST, () => {
  console.log(`
╔═════════════════════════════════════════════╗
║  Blue/Green Deployment Service              ║
║  Pool: ${APP_POOL.padEnd(36)} ║
║  Release ID: ${RELEASE_ID.padEnd(30)} ║
║  Host: ${APP_HOST.padEnd(36)} ║
║  Port: ${String(APP_PORT).padEnd(36)} ║
╚═════════════════════════════════════════════╝
  `);
  console.log(`Server running on http://${APP_HOST}:${APP_PORT}`);
  console.log(`Ready to accept requests...\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`[${APP_POOL}] SIGTERM received, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${APP_POOL}] Server closed`);
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(`\n[${APP_POOL}] SIGINT received, shutting down gracefully...`);
  server.close(() => {
    console.log(`[${APP_POOL}] Server closed`);
    process.exit(0);
  });
});
