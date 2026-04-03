const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const badgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, required: true },
  earnedAt: { type: Date, default: Date.now }
}, { _id: false });

const vocabularyEntrySchema = new mongoose.Schema({
  word: { type: String, required: true },
  replacements: [{ type: String }],
  definition: { type: String, default: '' },
  example: { type: String, default: '' },
  sourceTopic: { type: String, default: '' },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now }
}, { _id: false });

const performanceSnapshotSchema = new mongoose.Schema({
  key: { type: String, required: true },
  debates: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  avgScore: { type: Number, default: 0 }
}, { _id: false });

const eloHistorySchema = new mongoose.Schema({
  value: { type: Number, required: true },
  roomId: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now }
}, { _id: false });

const moderationEventSchema = new mongoose.Schema({
  action: { type: String, enum: ['warning', 'temporary_ban', 'permanent_ban', 'lifted'], required: true },
  reason: { type: String, default: '' },
  durationDays: { type: Number, default: 0 },
  adminNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8 },
  eloRating: { type: Number, default: 1000 },
  mode: { type: String, enum: ['ghost', 'public'], default: 'ghost' },
  ghostAlias: { type: String, default: '' },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 240 },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  suspensionEndsAt: { type: Date, default: null },
  suspensionReason: { type: String, default: '' },
  emailVerified: { type: Boolean, default: true },
  verificationCode: { type: String, default: '' },
  verificationCodeExpiresAt: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  totalDebates: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  avgVocabScore: { type: Number, default: 0 },
  preferredMode: { type: String, enum: ['text', 'voice', 'video'], default: 'text' },
  preferredLanguage: { type: String, default: 'English' },
  preferredTopics: [{ type: String }],
  badges: [badgeSchema],
  vocabularyLog: [vocabularyEntrySchema],
  topicStats: [performanceSnapshotSchema],
  languageStats: [performanceSnapshotSchema],
  eloHistory: [eloHistorySchema],
  moderationHistory: [moderationEventSchema],
  lastLoginAt: { type: Date, default: null },
  debateHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DebateSession' }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.ghostAlias) {
    this.ghostAlias = `Debater_${Math.floor(1000 + Math.random() * 9000)}`;
  }
  if (this.isNew && (!this.eloHistory || this.eloHistory.length === 0)) {
    this.eloHistory = [{ value: this.eloRating, roomId: '', recordedAt: new Date() }];
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isSuspended = function () {
  return Boolean(this.suspensionEndsAt && this.suspensionEndsAt > new Date());
};

userSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    email: this.email,
    eloRating: this.eloRating,
    mode: this.mode,
    ghostAlias: this.ghostAlias,
    avatar: this.avatar,
    bio: this.bio,
    role: this.role,
    preferredMode: this.preferredMode,
    preferredLanguage: this.preferredLanguage,
    preferredTopics: this.preferredTopics,
    badges: this.badges,
    vocabularyLog: this.vocabularyLog,
    topicStats: this.topicStats,
    languageStats: this.languageStats,
    eloHistory: this.eloHistory,
    totalDebates: this.totalDebates,
    wins: this.wins,
    losses: this.losses,
    draws: this.draws,
    avgVocabScore: this.avgVocabScore,
    emailVerified: this.emailVerified,
    lockUntil: this.lockUntil,
    suspensionEndsAt: this.suspensionEndsAt,
    suspensionReason: this.suspensionReason,
    moderationHistory: this.moderationHistory,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt
  };
};

userSchema.methods.toProfileJSON = function () {
  return {
    _id: this._id,
    username: this.username,
    eloRating: this.eloRating,
    mode: this.mode,
    ghostAlias: this.ghostAlias,
    avatar: this.avatar,
    bio: this.bio,
    badges: this.badges,
    topicStats: this.topicStats,
    languageStats: this.languageStats,
    eloHistory: this.eloHistory,
    totalDebates: this.totalDebates,
    wins: this.wins,
    losses: this.losses,
    draws: this.draws,
    avgVocabScore: this.avgVocabScore,
    preferredLanguage: this.preferredLanguage,
    preferredTopics: this.preferredTopics,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
