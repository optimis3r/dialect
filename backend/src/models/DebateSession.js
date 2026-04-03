const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  side: { type: String, enum: ['A', 'B'], default: 'A' },
  alias: String,
  content: String,
  isAI: { type: Boolean, default: false },
  filtered: Boolean,
  wordCount: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  round: Number
}, { _id: false });

const flagSchema = new mongoose.Schema({
  ticketId: { type: String, required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: String,
  category: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  actionTaken: { type: String, enum: ['none', 'warning', 'temporary_ban', 'permanent_ban'], default: 'none' },
  resolutionNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { _id: false });

const debateSessionSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  topic: { type: String, required: true },
  language: { type: String, default: 'English' },
  mode: { type: String, enum: ['text', 'voice', 'video'], default: 'text' },
  matchType: { type: String, enum: ['human-vs-human', 'human-vs-ai'], default: 'human-vs-human' },
  isRated: { type: Boolean, default: true },
  status: { type: String, enum: ['waiting', 'active', 'ended', 'abandoned'], default: 'waiting' },
  userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userAAliasInSession: String,
  userBAliasInSession: String,
  userAMode: { type: String, enum: ['ghost', 'public'] },
  userBMode: { type: String, enum: ['ghost', 'public'] },
  aiOpponent: {
    enabled: { type: Boolean, default: false },
    side: { type: String, enum: ['A', 'B', ''], default: '' },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
    category: { type: String, default: '' },
    motion: { type: String, default: '' },
    stance: { type: String, default: '' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', ''], default: '' },
    persona: { type: String, default: '' },
    displayName: { type: String, default: '' }
  },
  currentTurn: { type: String, enum: ['A', 'B'], default: 'A' },
  currentRound: { type: Number, default: 1 },
  maxRounds: { type: Number, default: 5 },
  countdownSeconds: { type: Number, default: 30 },
  turnDuration: { type: Number, default: 120 },
  turnSecondsRemaining: { type: Number, default: 120 },
  draftA: { type: String, default: '' },
  draftB: { type: String, default: '' },
  speakingTimeA: { type: Number, default: 0 },
  speakingTimeB: { type: Number, default: 0 },
  transcript: [messageSchema],
  winner: { type: String, enum: ['A', 'B', 'draw', null], default: null },
  eloChangeA: Number,
  eloChangeB: Number,
  aiStatus: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
  aiError: { type: String, default: '' },
  aiReport: { type: mongoose.Schema.Types.Mixed, default: null },
  sharedReportToken: { type: String, default: '' },
  flags: [flagSchema],
  startTime: Date,
  endTime: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DebateSession', debateSessionSchema);
