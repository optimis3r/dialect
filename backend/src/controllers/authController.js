const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

const PASSWORD_RULE = /^(?=.*\d).{8,}$/;
const PROFILE_TOPIC_LIMIT = 6;

function normalizeTopics(topics = []) {
  return [...new Set((topics || [])
    .map(topic => String(topic || '').trim())
    .filter(Boolean))]
    .slice(0, PROFILE_TOPIC_LIMIT);
}

function buildVerificationPayload(user) {
  if (user.emailVerified) return {};
  return {
    verificationRequired: true,
    verificationCode: process.env.NODE_ENV === 'production' ? undefined : user.verificationCode
  };
}

function buildProfileResponse(user) {
  return { success: true, user: user.toPublicJSON(), ...buildVerificationPayload(user) };
}

function activeSuspensionMessage(user) {
  if (user.isBanned) return 'Account permanently suspended';
  if (user.isSuspended()) return `Account temporarily suspended until ${user.suspensionEndsAt.toISOString()}`;
  return '';
}

exports.register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      preferredMode = 'text',
      preferredLanguage = 'English',
      preferredTopics = []
    } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields are required' });
    if (!PASSWORD_RULE.test(password))
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include a number' });
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists)
      return res.status(409).json({ success: false, message: 'Email or username already taken' });
    const shouldRequireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    const verificationCode = shouldRequireVerification ? String(Math.floor(100000 + Math.random() * 900000)) : '';
    const user = await User.create({
      username,
      email,
      password,
      preferredMode,
      preferredLanguage,
      preferredTopics: normalizeTopics(preferredTopics),
      emailVerified: !shouldRequireVerification,
      verificationCode,
      verificationCodeExpiresAt: shouldRequireVerification ? new Date(Date.now() + 1000 * 60 * 30) : null,
      badges: [{ id: 'rookie', label: 'Rookie', description: 'Joined the DIALECT arena.' }]
    });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: user.toPublicJSON(), ...buildVerificationPayload(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = (identifier || email || username || '').trim().toLowerCase();
    if (!loginId || !password)
      return res.status(400).json({ success: false, message: 'Email/username and password required' });

    const query = loginId.includes('@')
      ? { email: loginId }
      : { username: loginId };

    const user = await User.findOne(query);
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.lockUntil && user.lockUntil > new Date())
      return res.status(423).json({ success: false, message: `Account locked until ${user.lockUntil.toISOString()}` });
    if (!(await user.comparePassword(password))) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 1000 * 60 * 15);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.emailVerified)
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in', ...buildVerificationPayload(user) });
    if (user.isBanned || user.isSuspended())
      return res.status(403).json({ success: false, message: activeSuspensionMessage(user) || 'Account suspended' });
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();
    const token = signToken(user._id);
    res.json({ success: true, token, user: user.toPublicJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user.toPublicJSON() });
};

exports.updateMode = async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['ghost', 'public'].includes(mode))
      return res.status(400).json({ success: false, message: 'Invalid mode' });
    if (mode === 'public' && req.user.totalDebates < 1)
      return res.status(400).json({ success: false, message: 'Complete at least one debate before switching to Public Mode' });
    req.user.mode = mode;
    await req.user.save();
    res.json(buildProfileResponse(req.user));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -verificationCode');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.mode === 'ghost') {
      return res.json({
        success: true,
        user: {
          _id: user._id,
          ghostAlias: user.ghostAlias,
          eloRating: user.eloRating,
          mode: 'ghost',
          totalDebates: user.totalDebates,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
          avgVocabScore: user.avgVocabScore,
          badges: user.badges
        }
      });
    }
    res.json({ success: true, user: user.toProfileJSON() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const {
      username,
      bio,
      avatar,
      preferredMode,
      preferredLanguage,
      preferredTopics
    } = req.body;

    if (username && username !== req.user.username) {
      const existing = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existing) return res.status(409).json({ success: false, message: 'Username already taken' });
      req.user.username = username;
    }

    if (typeof bio === 'string') req.user.bio = bio.trim().slice(0, 240);
    if (typeof avatar === 'string') req.user.avatar = avatar.trim();
    if (['text', 'voice', 'video'].includes(preferredMode)) req.user.preferredMode = preferredMode;
    if (typeof preferredLanguage === 'string' && preferredLanguage.trim()) req.user.preferredLanguage = preferredLanguage.trim();
    if (Array.isArray(preferredTopics)) req.user.preferredTopics = normalizeTopics(preferredTopics);

    await req.user.save();
    res.json(buildProfileResponse(req.user));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, message: 'Email and verification code are required' });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.emailVerified) return res.json({ success: true, message: 'Email already verified' });
    if (user.verificationCode !== String(code).trim() || !user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code is invalid or expired' });
    }
    user.emailVerified = true;
    user.verificationCode = '';
    user.verificationCodeExpiresAt = null;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.emailVerified) return res.json({ success: true, message: 'Email already verified' });
    user.verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    user.verificationCodeExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();
    res.json({
      success: true,
      message: 'Verification code refreshed',
      verificationCode: process.env.NODE_ENV === 'production' ? undefined : user.verificationCode
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, users: [] });
    const users = await User.find({
      _id: { $ne: req.user._id },
      username: { $regex: q, $options: 'i' }
    })
      .select('username ghostAlias mode eloRating avatar totalDebates wins losses avgVocabScore')
      .limit(12);
    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        username: user.username,
        displayName: user.mode === 'ghost' ? user.ghostAlias : user.username,
        mode: user.mode,
        eloRating: user.eloRating,
        avatar: user.avatar,
        totalDebates: user.totalDebates,
        wins: user.wins,
        losses: user.losses,
        avgVocabScore: user.avgVocabScore
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
