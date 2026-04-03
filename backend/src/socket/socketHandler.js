const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DebateSession = require('../models/DebateSession');
const matchmakingService = require('../services/matchmakingService');
const nlpService = require('../services/nlpService');
const aiReportService = require('../services/aiReportService');
const aiOpponentService = require('../services/aiOpponentService');
const aiVoiceService = require('../services/aiVoiceService');
const { buildAiDebateTopic } = require('../services/aiTopicService');

const activeRooms = new Map();
const activeUserRooms = new Map();
const queueIntervals = new Map();

function verifySocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
}

function roomSide(room, userId) {
  if (room.userA.userId === userId) return 'A';
  if (room.userB.userId === userId) return 'B';
  return null;
}

function isAiRoom(room) {
  return Boolean(room?.session?.matchType === 'human-vs-ai' && room?.session?.aiOpponent?.enabled);
}

function safeWordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

module.exports = function (io, app) {
  const createAiRoomForUser = async (user, payload = {}, socket = null) => {
    if (activeUserRooms.has(String(user._id))) {
      throw new Error('You are already in an active debate');
    }

    clearQueueExpansion(user._id);
    matchmakingService.removeFromQueue(user._id);
    return createAiRoom(io, socket, user, payload);
  };

  if (app) {
    app.locals.createAiRoomForUser = createAiRoomForUser;
    app.locals.forfeitDebateForUser = async (roomId, userId) => {
      const room = activeRooms.get(roomId);
      if (!room) {
        throw new Error('Room not found');
      }
      const side = roomSide(room, String(userId));
      if (!side) {
        throw new Error('Not a participant');
      }
      await endDebate(io, roomId, String(userId), 'forfeit');
    };
  }

  io.use(verifySocket);

  io.on('connection', async (socket) => {
    let user;
    try {
      user = await User.findById(socket.userId).select('-password');
      if (!user || user.isBanned || (user.isSuspended && user.isSuspended())) {
        socket.disconnect();
        return;
      }
      socket.user = user;
    } catch {
      socket.disconnect();
      return;
    }

    console.log(`[SOCKET] Connected: ${user.username} (${socket.id})`);

    socket.on('queue:join', async ({ topic, mode, language, minElo, maxElo }) => {
      if (activeUserRooms.has(String(socket.userId))) {
        socket.emit('error', { message: 'You are already in an active debate' });
        return;
      }
      if (matchmakingService.isInQueue(socket.userId)) return;

      matchmakingService.addToQueue(socket.userId, {
        eloRating: user.eloRating,
        topic: topic || 'General',
        mode: mode || user.preferredMode || 'text',
        language: language || user.preferredLanguage || 'English',
        socketId: socket.id,
        minElo,
        maxElo
      });

      socket.emit('queue:joined', { queueSize: matchmakingService.getQueueSize() });
      scheduleQueueExpansion(io, socket.userId, socket);

      const match = matchmakingService.findMatch(socket.userId);
      if (match) await createRoom(io, match);
    });

    socket.on('queue:leave', () => {
      clearQueueExpansion(socket.userId);
      matchmakingService.removeFromQueue(socket.userId);
      socket.emit('queue:left');
    });

    socket.on('ai:match:create', async (payload = {}, ack = () => {}) => {
      try {
        const roomId = await createAiRoomForUser(user, payload, socket);
        ack({ success: true, roomId });
      } catch (error) {
        ack({ success: false, message: error.message || 'Could not create AI debate' });
      }
    });

    socket.on('room:join', ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const side = roomSide(room, socket.userId);
      if (!side) {
        socket.emit('error', { message: 'Not a participant' });
        return;
      }

      socket.join(roomId);
      socket.currentRoom = roomId;
      room[side === 'A' ? 'socketA' : 'socketB'] = socket.id;
      room[side === 'A' ? 'connectedA' : 'connectedB'] = true;

      if (isAiRoom(room) && room.connectedA && !room.started) {
        room.started = true;
        startDebate(io, roomId);
      } else if (room.connectedA && room.connectedB && !room.started) {
        room.started = true;
        startDebate(io, roomId);
      } else if (room.connectedA && room.connectedB && room.paused) {
        resumeDebate(io, roomId);
      }
    });

    socket.on('debate:draft_update', ({ roomId, content }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.session.mode !== 'text') return;
      const side = roomSide(room, socket.userId);
      if (!side) return;
      room.session[side === 'A' ? 'draftA' : 'draftB'] = String(content || '').slice(0, 1000);
    });

    socket.on('debate:speaking_stats', ({ roomId, seconds }) => {
      const room = activeRooms.get(roomId);
      if (!room || typeof seconds !== 'number') return;
      const side = roomSide(room, socket.userId);
      if (!side) return;
      if (side === 'A') room.session.speakingTimeA = Math.max(room.session.speakingTimeA, Math.round(seconds));
      if (side === 'B') room.session.speakingTimeB = Math.max(room.session.speakingTimeB, Math.round(seconds));
    });

    socket.on('debate:send_message', async ({ roomId, content }) => {
      const room = activeRooms.get(roomId);
      if (!room || !room.started || room.paused) return;
      const side = roomSide(room, socket.userId);
      if (!side) return;
      if (room.session.currentTurn !== side) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }
      await submitTurnMessage(io, roomId, socket.userId, content);
    });

    socket.on('debate:flag', async ({ roomId, reason, category }) => {
      const room = activeRooms.get(roomId);
      if (!room) return;
      const side = roomSide(room, socket.userId);
      if (!side) return;
      room.session.flags.push({
        ticketId: crypto.randomBytes(6).toString('hex'),
        reporterId: socket.userId,
        targetUserId: side === 'A' ? room.userB.userId : room.userA.userId,
        reason: String(reason || '').trim() || 'User report submitted',
        category: category || 'User Report',
        status: 'pending',
        severity: category === 'Hate Speech' ? 'high' : 'medium'
      });
      await room.session.save();
      socket.emit('flag:confirmed', { message: 'Report submitted successfully' });
    });

    socket.on('debate:forfeit', ({ roomId }) => endDebate(io, roomId, socket.userId, 'forfeit'));

    socket.on('webrtc:offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc:offer', { offer, from: socket.id });
    });

    socket.on('webrtc:answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc:answer', { answer, from: socket.id });
    });

    socket.on('webrtc:ice_candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc:ice_candidate', { candidate, from: socket.id });
    });

    socket.on('webrtc:ready', ({ roomId }) => {
      socket.to(roomId).emit('webrtc:peer_ready', { from: socket.id });
    });

    socket.on('debate:reconnect', ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room) return;
      const side = roomSide(room, socket.userId);
      if (!side) return;
      if (isAiRoom(room) && side === 'A' && room.session.status !== 'active') return;
      if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
      room[side === 'A' ? 'connectedA' : 'connectedB'] = true;
      room[side === 'A' ? 'socketA' : 'socketB'] = socket.id;
      socket.join(roomId);
      socket.currentRoom = roomId;
      if (!isAiRoom(room)) {
        io.to(roomId).emit('debate:opponent_reconnected');
      }
      if (room.connectedA && room.connectedB && room.paused) {
        resumeDebate(io, roomId);
      } else if (isAiRoom(room) && room.paused && room.connectedA) {
        resumeDebate(io, roomId);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[SOCKET] Disconnected: ${user.username}`);
      clearQueueExpansion(socket.userId);
      matchmakingService.removeFromQueue(socket.userId);

      if (!socket.currentRoom) return;
      const room = activeRooms.get(socket.currentRoom);
      if (!room || !room.started || room.session.status !== 'active') return;

      const side = roomSide(room, socket.userId);
      if (!side) return;

      room[side === 'A' ? 'connectedA' : 'connectedB'] = false;
      pauseDebate(io, socket.currentRoom);
      io.to(socket.currentRoom).emit('debate:opponent_disconnected', { timeout: 60 });

      room.disconnectTimer = setTimeout(() => {
        const targetConnected = side === 'A' ? room.connectedA : room.connectedB;
        if (!targetConnected) {
          endDebate(io, socket.currentRoom, null, side === 'A' ? 'disconnect_A' : 'disconnect_B');
        }
      }, 60000);
    });
  });

  function clearQueueExpansion(userId) {
    const timer = queueIntervals.get(String(userId));
    if (timer) {
      clearInterval(timer);
      queueIntervals.delete(String(userId));
    }
  }

  function scheduleQueueExpansion(io, userId, socket) {
    clearQueueExpansion(userId);
    const timer = setInterval(async () => {
      matchmakingService.expandTolerance(userId);
      const entry = matchmakingService.getQueueEntry(userId);
      if (!entry) {
        clearQueueExpansion(userId);
        return;
      }
      socket.emit('queue:search_update', { tolerance: entry.tolerance });
      const match = matchmakingService.findMatch(userId);
      if (match) await createRoom(io, match);
    }, 60000);
    queueIntervals.set(String(userId), timer);
  }

  async function createRoom(io, match) {
    const { roomId, userA, userB } = match;
    clearQueueExpansion(userA.userId);
    clearQueueExpansion(userB.userId);

    const [dbA, dbB] = await Promise.all([User.findById(userA.userId), User.findById(userB.userId)]);
    if (!dbA || !dbB) return;

    const aliasA = dbA.mode === 'ghost' ? dbA.ghostAlias : dbA.username;
    const aliasB = dbB.mode === 'ghost' ? dbB.ghostAlias : dbB.username;

    const session = new DebateSession({
      roomId,
      topic: userA.topic,
      language: userA.language,
      mode: userA.mode,
      status: 'waiting',
      userA: dbA._id,
      userB: dbB._id,
      userAAliasInSession: aliasA,
      userBAliasInSession: aliasB,
      userAMode: dbA.mode,
      userBMode: dbB.mode
    });
    await session.save();

    activeUserRooms.set(String(userA.userId), roomId);
    activeUserRooms.set(String(userB.userId), roomId);

    activeRooms.set(roomId, {
      roomId,
      session,
      userA: { userId: userA.userId, socketId: userA.socketId, alias: aliasA },
      userB: { userId: userB.userId, socketId: userB.socketId, alias: aliasB },
      connectedA: false,
      connectedB: false,
      started: false,
      paused: false,
      socketA: null,
      socketB: null,
      turnTimer: null,
      aiTurnTimeout: null,
      aiThinking: false,
      disconnectTimer: null,
      remainingTurn: session.turnDuration
    });

    const socketA = io.sockets.sockets.get(userA.socketId);
    const socketB = io.sockets.sockets.get(userB.socketId);

    if (socketA) socketA.emit('match:found', {
      roomId,
      topic: userA.topic,
      mode: userA.mode,
      language: userA.language,
      opponentAlias: aliasB,
      side: 'A',
      matchType: 'human-vs-human',
      isRated: true
    });
    if (socketB) socketB.emit('match:found', {
      roomId,
      topic: userA.topic,
      mode: userA.mode,
      language: userA.language,
      opponentAlias: aliasA,
      side: 'B',
      matchType: 'human-vs-human',
      isRated: true
    });
  }

  async function createAiRoom(io, socket, user, payload = {}) {
    const requestedTopic = String(payload.topic || user.preferredTopics?.[0] || 'General').trim() || 'General';
    const language = String(payload.language || user.preferredLanguage || 'English').trim() || 'English';
    const difficulty = ['easy', 'medium', 'hard'].includes(payload.difficulty) ? payload.difficulty : 'medium';
    const persona = ['analyst', 'challenger', 'mentor'].includes(payload.persona) ? payload.persona : 'analyst';
    const debateTopic = buildAiDebateTopic({
      requestedTopic,
      userId: String(user._id),
      difficulty,
      persona
    });
    const roomId = `ai_${crypto.randomBytes(6).toString('hex')}`;
    const aliasA = user.mode === 'ghost' ? user.ghostAlias : user.username;
    const displayName = `Dialect AI (${difficulty[0].toUpperCase()}${difficulty.slice(1)})`;

    const session = new DebateSession({
      roomId,
      topic: debateTopic.category,
      language,
      mode: 'text',
      matchType: 'human-vs-ai',
      isRated: false,
      status: 'waiting',
      userA: user._id,
      userB: null,
      userAAliasInSession: aliasA,
      userBAliasInSession: displayName,
      userAMode: user.mode,
      userBMode: 'public',
      aiOpponent: {
        enabled: true,
        side: 'B',
        provider: '',
        model: '',
        category: debateTopic.category,
        motion: debateTopic.motion,
        stance: debateTopic.stance,
        difficulty,
        persona,
        displayName
      }
    });
    await session.save();

    activeUserRooms.set(String(user._id), roomId);

    activeRooms.set(roomId, {
      roomId,
      session,
      userA: { userId: String(user._id), socketId: socket?.id || null, alias: aliasA },
      userB: { userId: null, socketId: null, alias: displayName, isAI: true },
      connectedA: false,
      connectedB: true,
      started: false,
      paused: false,
      socketA: null,
      socketB: null,
      turnTimer: null,
      aiTurnTimeout: null,
      aiThinking: false,
      disconnectTimer: null,
      remainingTurn: session.turnDuration
    });

    if (socket) {
      socket.emit('match:found', {
        roomId,
        topic: debateTopic.category,
        mode: 'text',
        language,
        opponentAlias: displayName,
        side: 'A',
        matchType: 'human-vs-ai',
        isRated: false,
        aiOpponent: session.aiOpponent,
        motion: debateTopic.motion
      });
    }

    return roomId;
  }

  function startDebate(io, roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.session.status = 'active';
    room.session.startTime = new Date();
    room.session.currentTurn = 'A';
    room.session.turnSecondsRemaining = room.session.turnDuration;
    room.remainingTurn = room.session.turnDuration;
    room.session.aiStatus = 'pending';
    room.session.save();

    io.to(roomId).emit('debate:started', {
      topic: room.session.topic,
      motion: room.session.aiOpponent?.motion || room.session.topic,
      language: room.session.language,
      mode: room.session.mode,
      matchType: room.session.matchType,
      isRated: room.session.isRated,
      aiOpponent: room.session.aiOpponent,
      aliasA: room.session.userAAliasInSession,
      aliasB: room.session.userBAliasInSession,
      firstTurn: 'A',
      turnDuration: room.session.turnDuration,
      maxRounds: room.session.maxRounds,
      countdownSeconds: room.session.countdownSeconds
    });

    setTimeout(() => {
      const freshRoom = activeRooms.get(roomId);
      if (!freshRoom || freshRoom.session.status !== 'active' || freshRoom.paused) return;
      startTurnTimer(io, roomId, freshRoom.session.turnDuration);
    }, room.session.countdownSeconds * 1000);
  }

  function pauseDebate(io, roomId) {
    const room = activeRooms.get(roomId);
    if (!room || room.paused) return;
    room.paused = true;
    if (room.turnTimer) clearInterval(room.turnTimer);
    room.session.turnSecondsRemaining = room.remainingTurn;
    room.session.save();
    io.to(roomId).emit('debate:paused', { remaining: room.remainingTurn });
  }

  function resumeDebate(io, roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.paused = false;
    room.session.turnSecondsRemaining = room.remainingTurn || room.session.turnDuration;
    room.session.save();
    io.to(roomId).emit('debate:resumed', { remaining: room.session.turnSecondsRemaining });
    startTurnTimer(io, roomId, room.session.turnSecondsRemaining);
    if (isAiRoom(room) && room.session.currentTurn === room.session.aiOpponent.side) {
      queueAiTurn(io, roomId);
    }
  }

  function startTurnTimer(io, roomId, initialRemaining) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearInterval(room.turnTimer);

    let remaining = initialRemaining ?? room.session.turnDuration;
    room.remainingTurn = remaining;
    room.session.turnSecondsRemaining = remaining;
    room.turnTimer = setInterval(() => {
      if (room.paused) return;
      remaining -= 1;
      room.remainingTurn = remaining;
      room.session.turnSecondsRemaining = remaining;
      io.to(roomId).emit('debate:timer', { remaining, turn: room.session.currentTurn });
      if (remaining <= 0) {
        clearInterval(room.turnTimer);
        handleTurnTimeout(io, roomId);
      }
    }, 1000);
  }

  async function handleTurnTimeout(io, roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    if (isAiRoom(room) && room.session.currentTurn === room.session.aiOpponent.side) {
      await queueAiTurn(io, roomId, true);
      return;
    }
    const currentDraft = room.session.currentTurn === 'A' ? room.session.draftA : room.session.draftB;
    const currentUserId = room.session.currentTurn === 'A' ? room.userA.userId : room.userB.userId;
    if (currentDraft && currentDraft.trim()) {
      await submitTurnMessage(io, roomId, currentUserId, currentDraft, true);
      return;
    }
    await advanceTurn(io, roomId, true);
  }

  async function submitTurnMessage(io, roomId, senderUserId, rawContent, timedOut = false) {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const side = roomSide(room, senderUserId);
    if (!side) return;

    const { filtered, wasFiltered } = nlpService.filterProfanity(rawContent);
    const content = String(filtered || '').trim();
    if (!content) {
      await advanceTurn(io, roomId, timedOut);
      return;
    }

    const alias = side === 'A' ? room.session.userAAliasInSession : room.session.userBAliasInSession;
    const message = {
      userId: senderUserId,
      side,
      alias,
      content,
      isAI: false,
      filtered: wasFiltered,
      wordCount: safeWordCount(content),
      durationSeconds: room.session.mode === 'text' ? 0 : Math.max(room.session.turnDuration - room.remainingTurn, 0),
      round: room.session.currentRound,
      timestamp: new Date()
    };

    room.session.transcript.push(message);
    room.session[side === 'A' ? 'draftA' : 'draftB'] = '';
    await room.session.save();

    io.to(roomId).emit('debate:message', { ...message, side, timedOut });

    if (wasFiltered) {
      room.session.flags.push({
        ticketId: crypto.randomBytes(6).toString('hex'),
        reporterId: senderUserId,
        targetUserId: senderUserId,
        reason: 'Auto-censorship triggered',
        category: 'Profanity Bypass',
        status: 'pending',
        severity: 'low'
      });
      await room.session.save();
    }

    await advanceTurn(io, roomId, timedOut);
  }

  async function queueAiTurn(io, roomId, immediate = false) {
    const room = activeRooms.get(roomId);
    if (!room || !isAiRoom(room) || room.paused || room.session.status !== 'active') return;
    if (room.session.currentTurn !== room.session.aiOpponent.side || room.aiThinking) return;

    room.aiThinking = true;
    if (room.aiTurnTimeout) clearTimeout(room.aiTurnTimeout);

    const runTurn = async () => {
      const freshRoom = activeRooms.get(roomId);
      if (!freshRoom || !isAiRoom(freshRoom) || freshRoom.paused || freshRoom.session.status !== 'active') {
        if (freshRoom) freshRoom.aiThinking = false;
        return;
      }

      const { message, provider, model, error } = await aiOpponentService.generateOpponentTurn({
        session: freshRoom.session,
        difficulty: freshRoom.session.aiOpponent.difficulty || 'medium',
        persona: freshRoom.session.aiOpponent.persona || 'analyst'
      });

      freshRoom.session.aiOpponent.provider = provider || freshRoom.session.aiOpponent.provider;
      freshRoom.session.aiOpponent.model = model || freshRoom.session.aiOpponent.model;
      freshRoom.session.aiError = error || '';
      await submitAiTurnMessage(io, roomId, message, {
        provider,
        model,
        error
      });
    };

    if (immediate) {
      await runTurn();
      return;
    }

    room.aiTurnTimeout = setTimeout(() => {
      runTurn().catch((error) => {
        const freshRoom = activeRooms.get(roomId);
        if (freshRoom) {
          freshRoom.aiThinking = false;
          freshRoom.aiError = error.message;
        }
      });
    }, 1800);
  }

  async function submitAiTurnMessage(io, roomId, rawContent, meta = {}) {
    const room = activeRooms.get(roomId);
    if (!room || !isAiRoom(room)) return;

    const { filtered, wasFiltered } = nlpService.filterProfanity(rawContent);
    const content = String(filtered || '').trim();
    if (!content) {
      room.aiThinking = false;
      await advanceTurn(io, roomId, true);
      return;
    }

    const message = {
      userId: null,
      side: room.session.aiOpponent.side || 'B',
      alias: room.session.userBAliasInSession,
      content,
      isAI: true,
      provider: meta.provider || room.session.aiOpponent.provider || '',
      model: meta.model || room.session.aiOpponent.model || '',
      error: meta.error || '',
      fallbackUsed: (meta.provider || room.session.aiOpponent.provider) === 'local-fallback',
      filtered: wasFiltered,
      wordCount: safeWordCount(content),
      durationSeconds: 0,
      round: room.session.currentRound,
      timestamp: new Date()
    };

    const voicePayload = await aiVoiceService.synthesizeOpponentSpeech({
      text: content,
      language: room.session.language,
      persona: room.session.aiOpponent.persona || 'analyst',
      difficulty: room.session.aiOpponent.difficulty || 'medium'
    });

    room.session.transcript.push(message);
    room.session.draftB = '';
    room.aiThinking = false;
    if (room.aiTurnTimeout) {
      clearTimeout(room.aiTurnTimeout);
      room.aiTurnTimeout = null;
    }

    if (voicePayload.error) {
      room.session.aiError = voicePayload.error;
    }

    await room.session.save();
    io.to(roomId).emit('debate:message', {
      ...message,
      timedOut: false,
      audio: voicePayload.audio,
      voice: voicePayload.voice || '',
      speechFallbackUsed: Boolean(voicePayload.fallbackUsed)
    });
    await advanceTurn(io, roomId, false);
  }

  async function advanceTurn(io, roomId, timedOut = false) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearInterval(room.turnTimer);

    const previousTurn = room.session.currentTurn;
    if (previousTurn === 'B') {
      room.session.currentRound += 1;
      if (room.session.currentRound > room.session.maxRounds) {
        await endDebate(io, roomId, null, 'rounds_complete');
        return;
      }
    }

    room.session.currentTurn = previousTurn === 'A' ? 'B' : 'A';
    room.remainingTurn = room.session.turnDuration;
    room.session.turnSecondsRemaining = room.session.turnDuration;
    await room.session.save();

    io.to(roomId).emit('debate:turn_change', {
      turn: room.session.currentTurn,
      round: room.session.currentRound,
      timedOut
    });

    startTurnTimer(io, roomId, room.session.turnDuration);
    if (isAiRoom(room) && room.session.currentTurn === room.session.aiOpponent.side) {
      await queueAiTurn(io, roomId);
    }
  }

  async function endDebate(io, roomId, forfeiterUserId, reason) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    if (room.turnTimer) clearInterval(room.turnTimer);
    if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
    if (room.aiTurnTimeout) clearTimeout(room.aiTurnTimeout);

    const session = room.session;
    session.status = 'ended';
    session.endTime = new Date();

    const aiMatch = isAiRoom(room);
    const [dbA, dbB] = await Promise.all([
      User.findById(room.userA.userId),
      room.userB.userId ? User.findById(room.userB.userId) : Promise.resolve(null)
    ]);
    if (!dbA || (!aiMatch && !dbB)) {
      activeRooms.delete(roomId);
      activeUserRooms.delete(String(room.userA.userId));
      if (room.userB.userId) activeUserRooms.delete(String(room.userB.userId));
      return;
    }

    const transcriptA = session.transcript.filter(item => item.side === 'A' || String(item.userId) === String(room.userA.userId));
    const transcriptB = session.transcript.filter(item => item.side === 'B' || (aiMatch ? item.isAI : String(item.userId) === String(room.userB.userId)));

    let winner = 'draw';
    let eloChangeA = 0;
    let eloChangeB = 0;

    if (transcriptA.length > 0 || transcriptB.length > 0) {
      const analysis = await aiReportService.generateDebateReport(transcriptA, transcriptB, {
        mode: session.mode,
        topic: session.topic,
        language: session.language,
        matchType: session.matchType,
        isRated: session.isRated,
        speakingTimeA: session.speakingTimeA,
        speakingTimeB: session.speakingTimeB,
        aliasA: session.userAAliasInSession,
        aliasB: session.userBAliasInSession
      });
      session.aiReport = analysis.report;
      session.aiStatus = 'ready';
      session.aiError = analysis.error || '';
    } else {
      session.aiStatus = 'ready';
    }

    if (reason === 'forfeit' && forfeiterUserId) {
      winner = String(forfeiterUserId) === String(room.userA.userId) ? 'B' : 'A';
    } else if (reason === 'disconnect_A') {
      winner = 'B';
    } else if (reason === 'disconnect_B') {
      winner = 'A';
    } else if (session.aiReport?.winner) {
      winner = session.aiReport.winner;
    }

    if (session.aiStatus === 'pending') session.aiStatus = 'ready';

    session.winner = winner;

    // AI debates are intentionally unrated so practice cannot be used to farm ELO.
    if (session.isRated && dbB && winner === 'A') {
      const { winnerChange, loserChange } = nlpService.calculateEloChange(dbA.eloRating, dbB.eloRating);
      eloChangeA = winnerChange;
      eloChangeB = loserChange;
      dbA.wins += 1;
      dbB.losses += 1;
    } else if (session.isRated && dbB && winner === 'B') {
      const { winnerChange, loserChange } = nlpService.calculateEloChange(dbB.eloRating, dbA.eloRating);
      eloChangeB = winnerChange;
      eloChangeA = loserChange;
      dbB.wins += 1;
      dbA.losses += 1;
    } else if (session.isRated && dbB) {
      dbA.draws += 1;
      dbB.draws += 1;
    }

    session.eloChangeA = eloChangeA;
    session.eloChangeB = eloChangeB;

    dbA.eloRating = Math.max(100, dbA.eloRating + eloChangeA);
    dbA.totalDebates += 1;
    dbA.debateHistory.push(session._id);
    if (dbB) {
      dbB.eloRating = Math.max(100, dbB.eloRating + eloChangeB);
      dbB.totalDebates += 1;
      dbB.debateHistory.push(session._id);
    }

    if (session.aiReport) {
      dbA.avgVocabScore = Math.round(((dbA.avgVocabScore * (dbA.totalDebates - 1)) + session.aiReport.vocabScoreA) / dbA.totalDebates);
      updateVocabularyLog(dbA, session.aiReport.wordInsightsA || [], session.topic);
      updateBucketStats(dbA.topicStats, session.topic, session.aiReport.vocabScoreA || 0, winner === 'A');
      updateBucketStats(dbA.languageStats, session.language, session.aiReport.vocabScoreA || 0, winner === 'A');
      if (dbB) {
        dbB.avgVocabScore = Math.round(((dbB.avgVocabScore * (dbB.totalDebates - 1)) + session.aiReport.vocabScoreB) / dbB.totalDebates);
        updateVocabularyLog(dbB, session.aiReport.wordInsightsB || [], session.topic);
        updateBucketStats(dbB.topicStats, session.topic, session.aiReport.vocabScoreB || 0, winner === 'B');
        updateBucketStats(dbB.languageStats, session.language, session.aiReport.vocabScoreB || 0, winner === 'B');
      }
    }

    dbA.eloHistory.push({ value: dbA.eloRating, roomId, recordedAt: new Date() });
    applyBadges(dbA);
    if (dbB) {
      dbB.eloHistory.push({ value: dbB.eloRating, roomId, recordedAt: new Date() });
      applyBadges(dbB);
    }

    const saves = [session.save(), dbA.save()];
    if (dbB) saves.push(dbB.save());
    await Promise.all(saves);

    io.to(roomId).emit('debate:ended', {
      winner,
      reason,
      roomId,
      eloChangeA,
      eloChangeB,
      newEloA: dbA.eloRating,
      newEloB: dbB?.eloRating ?? null,
      report: session.aiReport,
      matchType: session.matchType,
      isRated: session.isRated,
      aiOpponent: session.aiOpponent,
      aliasA: session.userAAliasInSession,
      aliasB: session.userBAliasInSession
    });

    activeRooms.delete(roomId);
    activeUserRooms.delete(String(room.userA.userId));
    if (room.userB.userId) activeUserRooms.delete(String(room.userB.userId));
    console.log(`[ROOM] Ended ${roomId} - winner: ${winner} - reason: ${reason}`);
  }

  function updateBucketStats(collection, key, score, won) {
    const safeKey = String(key || 'General');
    const existing = collection.find(item => item.key === safeKey);
    if (existing) {
      existing.debates += 1;
      if (won) existing.wins += 1;
      existing.avgScore = Math.round(((existing.avgScore * (existing.debates - 1)) + score) / existing.debates);
      return;
    }
    collection.push({
      key: safeKey,
      debates: 1,
      wins: won ? 1 : 0,
      avgScore: score
    });
  }

  function updateVocabularyLog(user, insights, topic) {
    insights.forEach(insight => {
      const existing = user.vocabularyLog.find(item => item.word === insight.word);
      if (existing) {
        existing.count += 1;
        existing.lastSeenAt = new Date();
        existing.sourceTopic = topic;
        existing.replacements = insight.replacements || existing.replacements;
        existing.definition = insight.definition || existing.definition;
        existing.example = insight.example || existing.example;
      } else {
        user.vocabularyLog.push({
          word: insight.word,
          replacements: insight.replacements || [],
          definition: insight.definition || '',
          example: insight.example || '',
          sourceTopic: topic,
          count: 1,
          lastSeenAt: new Date()
        });
      }
    });
    user.vocabularyLog = user.vocabularyLog.slice(-30);
  }

  function grantBadge(user, badge) {
    if (!user.badges.some(item => item.id === badge.id)) {
      user.badges.push({ ...badge, earnedAt: new Date() });
    }
  }

  function applyBadges(user) {
    if (user.totalDebates >= 1) {
      grantBadge(user, { id: 'first-debate', label: 'First Debate', description: 'Completed your first debate.' });
    }
    if (user.wins >= 1) {
      grantBadge(user, { id: 'first-win', label: 'First Win', description: 'Claimed your first victory.' });
    }
    if (user.totalDebates >= 5) {
      grantBadge(user, { id: 'veteran', label: 'Veteran', description: 'Completed five debates.' });
    }
    if (user.avgVocabScore >= 70) {
      grantBadge(user, { id: 'wordsmith', label: 'Wordsmith', description: 'Maintained a strong vocabulary score.' });
    }
    if (user.mode === 'public') {
      grantBadge(user, { id: 'public-debater', label: 'Public Debater', description: 'Appeared on the public leaderboard.' });
    }
  }
};
