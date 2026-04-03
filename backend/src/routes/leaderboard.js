const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DebateSession = require('../models/DebateSession');
const { protect, adminOnly } = require('../middleware/auth');

// Get leaderboard (public mode users only)
router.get('/', protect, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const topic = String(req.query.topic || '').trim();
    const language = String(req.query.language || '').trim();

    let users = await User.find({ mode: 'public', isBanned: false })
      .select('username eloRating wins losses draws totalDebates avgVocabScore topicStats languageStats avatar')
      .sort({ eloRating: -1 })
      .limit(100);
    users = users.filter(user => {
      if (search && !user.username.toLowerCase().includes(search.toLowerCase())) return false;
      if (topic && !(user.topicStats || []).some(item => item.key === topic && item.debates > 0)) return false;
      if (language && !(user.languageStats || []).some(item => item.key === language && item.debates > 0)) return false;
      return true;
    });
    res.json({ success: true, leaderboard: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({})
      .select('username ghostAlias mode role eloRating wins losses draws totalDebates avgVocabScore avatar preferredLanguage preferredTopics isBanned suspensionEndsAt')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: get all flagged sessions
router.get('/admin/flags', protect, adminOnly, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const sessions = await DebateSession.find({ 'flags.0': { $exists: true } })
      .populate('userA', 'username').populate('userB', 'username')
      .select('roomId topic language flags userA userB createdAt');
    const filtered = status
      ? sessions.map(session => ({
        ...session.toObject(),
        flags: session.flags.filter(flag => flag.status === status)
      })).filter(session => session.flags.length > 0)
      : sessions;
    res.json({ success: true, sessions: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: ban a user
router.post('/admin/ban/:userId', protect, adminOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBanned = true;
    user.banReason = reason || 'Violated community guidelines';
    user.suspensionEndsAt = null;
    user.moderationHistory.push({
      action: 'permanent_ban',
      reason: user.banReason,
      durationDays: 0,
      adminNote: user.banReason
    });
    await user.save();
    res.json({ success: true, message: `User ${user.username} banned` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/moderate/:roomId/:ticketId', protect, adminOnly, async (req, res) => {
  try {
    const { action = 'none', note = '', durationDays = 0 } = req.body;
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const flag = session.flags.find(item => item.ticketId === req.params.ticketId);
    if (!flag) return res.status(404).json({ success: false, message: 'Ticket not found' });

    flag.status = action === 'dismiss' ? 'dismissed' : 'reviewed';
    flag.actionTaken = action === 'dismiss' ? 'none' : action;
    flag.resolutionNote = note;
    flag.reviewedBy = req.user._id;
    flag.reviewedAt = new Date();

    const targetUser = flag.targetUserId ? await User.findById(flag.targetUserId) : null;
    if (targetUser) {
      if (action === 'warning') {
        targetUser.moderationHistory.push({ action: 'warning', reason: note || flag.reason, adminNote: note });
      }
      if (action === 'temporary_ban') {
        const expiresAt = new Date(Date.now() + Number(durationDays || 1) * 24 * 60 * 60 * 1000);
        targetUser.suspensionEndsAt = expiresAt;
        targetUser.suspensionReason = note || flag.reason;
        targetUser.moderationHistory.push({
          action: 'temporary_ban',
          reason: note || flag.reason,
          durationDays: Number(durationDays || 1),
          adminNote: note,
          expiresAt
        });
      }
      if (action === 'permanent_ban') {
        targetUser.isBanned = true;
        targetUser.banReason = note || flag.reason;
        targetUser.moderationHistory.push({
          action: 'permanent_ban',
          reason: note || flag.reason,
          adminNote: note
        });
      }
      await targetUser.save();
    }

    await session.save();
    res.json({ success: true, message: 'Moderation action applied' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
