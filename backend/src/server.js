require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const morgan     = require('morgan');

const authRoutes        = require('./routes/auth');
const debateRoutes      = require('./routes/debate');
const leaderboardRoutes = require('./routes/leaderboard');
const socketHandler     = require('./socket/socketHandler');
const errorHandler      = require('./middleware/errorHandler');

const app    = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// ── Middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── REST Routes ────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/debate',      debateRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() })
);

// 404 for unknown API routes
app.use('/api/*', (req, res) =>
  res.status(404).json({ success: false, message: 'API endpoint not found' })
);

// Global error handler
app.use(errorHandler);

// ── Socket.io ──────────────────────────────────────────────────────────
socketHandler(io, app);

// ── Database + Start ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('[DB]     ✓ Connected to MongoDB');
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`[SERVER] ✓ Running on port ${PORT}`);
    console.log(`[MODE]     ${process.env.NODE_ENV || 'development'}`);
  });
})
.catch(err => {
  console.error('[DB] ✗ Connection failed:', err.message);
  console.error('    Make sure MongoDB is running: mongod --dbpath /data/db');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received — shutting down gracefully');
  server.close(() => { mongoose.connection.close(); process.exit(0); });
});

module.exports = { app, io };
