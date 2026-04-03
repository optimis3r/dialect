const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { protect } = require('../middleware/auth');
const DebateSession = require('../models/DebateSession');
const { transcribeDebateAudio } = require('../services/aiVoiceService');

// Get debate session by roomId
router.get('/session/:roomId', protect, async (req, res) => {
  try {
    const session = await DebateSession.findOne({ roomId: req.params.roomId })
      .populate('userA', 'username ghostAlias mode eloRating')
      .populate('userB', 'username ghostAlias mode eloRating');
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const isA = session.userA?._id.toString() === req.user._id.toString();
    const isB = session.userB?._id.toString() === req.user._id.toString();
    const isParticipant = isA || isB;
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not a participant' });
    res.json({
      success: true,
      side: isA ? 'A' : 'B',
      session
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user's debate history
router.get('/history', protect, async (req, res) => {
  try {
    const sessions = await DebateSession.find({
      $or: [{ userA: req.user._id }, { userB: req.user._id }],
      status: 'ended'
    }).sort({ endTime: -1 }).limit(20).select('roomId topic language mode winner endTime eloChangeA eloChangeB userAAliasInSession userBAliasInSession aiStatus matchType isRated aiOpponent');
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get AI report for a session
router.get('/report/:roomId', protect, async (req, res) => {
  try {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) return res.status(404).json({ success: false, message: 'Not found' });
    const isA = session.userA?.toString() === req.user._id.toString();
    const isB = session.userB?.toString() === req.user._id.toString();
    if (!isA && !isB) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({
      success: true,
      report: session.aiReport,
      aiStatus: session.aiStatus,
      aiError: session.aiError,
      side: isA ? 'A' : 'B',
      shareToken: session.sharedReportToken || '',
      session: {
        topic: session.topic,
        language: session.language,
        mode: session.mode,
        matchType: session.matchType,
        isRated: session.isRated,
        aiOpponent: session.aiOpponent,
        winner: session.winner,
        eloChangeA: session.eloChangeA,
        eloChangeB: session.eloChangeB,
        speakingTimeA: session.speakingTimeA,
        speakingTimeB: session.speakingTimeB
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ai-room', protect, async (req, res) => {
  try {
    const createAiRoomForUser = req.app.locals.createAiRoomForUser;
    if (typeof createAiRoomForUser !== 'function') {
      return res.status(503).json({ success: false, message: 'AI room service is not ready yet' });
    }

    const roomId = await createAiRoomForUser(req.user, req.body || null, null);
    return res.json({ success: true, roomId });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Could not create AI debate' });
  }
});

router.post('/session/:roomId/forfeit', protect, async (req, res) => {
  try {
    const forfeitDebateForUser = req.app.locals.forfeitDebateForUser;
    if (typeof forfeitDebateForUser !== 'function') {
      return res.status(503).json({ success: false, message: 'Forfeit service is not ready yet' });
    }

    await forfeitDebateForUser(req.params.roomId, req.user._id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Could not forfeit this debate' });
  }
});

router.post('/speech/transcribe', protect, async (req, res) => {
  try {
    const { roomId, audioDataUrl, language } = req.body || {};
    if (!roomId || !audioDataUrl) {
      return res.status(400).json({ success: false, message: 'roomId and audioDataUrl are required' });
    }

    const session = await DebateSession.findOne({ roomId });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const isA = session.userA?.toString() === req.user._id.toString();
    const isB = session.userB?.toString() === req.user._id.toString();
    if (!isA && !isB) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (session.matchType !== 'human-vs-ai') {
      return res.status(400).json({ success: false, message: 'Speech transcription is currently enabled for AI practice rooms only' });
    }

    const transcription = await transcribeDebateAudio({
      audioDataUrl,
      language: language || session.language || 'English'
    });

    if (!transcription.transcript) {
      return res.status(422).json({ success: false, message: 'The recording could not be transcribed clearly. Please try again.' });
    }

    return res.json({
      success: true,
      transcript: transcription.transcript,
      provider: transcription.provider,
      model: transcription.model
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/report/:roomId/share', protect, async (req, res) => {
  try {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) return res.status(404).json({ success: false, message: 'Not found' });
    const isA = session.userA?.toString() === req.user._id.toString();
    const isB = session.userB?.toString() === req.user._id.toString();
    if (!isA && !isB) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (!session.sharedReportToken) {
      session.sharedReportToken = crypto.randomBytes(16).toString('hex');
      await session.save();
    }
    res.json({ success: true, shareToken: session.sharedReportToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/report/share/:token', async (req, res) => {
  try {
    const session = await DebateSession.findOne({ sharedReportToken: req.params.token })
      .populate('userA', 'username ghostAlias mode avatar')
      .populate('userB', 'username ghostAlias mode avatar');
    if (!session) return res.status(404).json({ success: false, message: 'Shared report not found' });
    res.json({
      success: true,
      report: session.aiReport,
      session: {
        topic: session.topic,
        language: session.language,
        mode: session.mode,
        winner: session.winner,
        aliasA: session.userAAliasInSession,
        aliasB: session.userBAliasInSession
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
