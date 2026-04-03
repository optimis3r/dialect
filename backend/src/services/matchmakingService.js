const { v4: uuidv4 } = require('uuid');

// In-memory matchmaking queue keyed by user id.
const queue = new Map();

function normalizeUserId(userId) {
  return String(userId);
}

exports.addToQueue = function (userId, entry = {}) {
  const key = normalizeUserId(userId);
  queue.set(key, {
    userId: key,
    eloRating: Number(entry.eloRating) || 1000,
    topic: entry.topic || 'General',
    language: entry.language || 'English',
    mode: entry.mode || 'text',
    socketId: entry.socketId || '',
    joinedAt: Date.now(),
    tolerance: 150,
    minElo: Number.isFinite(entry.minElo) ? entry.minElo : null,
    maxElo: Number.isFinite(entry.maxElo) ? entry.maxElo : null
  });
};

exports.removeFromQueue = function (userId) {
  queue.delete(normalizeUserId(userId));
};

exports.findMatch = function (userId) {
  const seekerId = normalizeUserId(userId);
  const seeker = queue.get(seekerId);
  if (!seeker) return null;

  for (const [candidateId, candidate] of queue.entries()) {
    if (candidateId === seekerId) continue;
    if (candidate.mode !== seeker.mode) continue;
    if (candidate.language !== seeker.language) continue;
    if (candidate.topic !== seeker.topic) continue;

    const eloDiff = Math.abs(seeker.eloRating - candidate.eloRating);
    const tolerance = Math.max(seeker.tolerance, candidate.tolerance);
    if (eloDiff > tolerance) continue;
    if (Number.isFinite(seeker.minElo) && candidate.eloRating < seeker.minElo) continue;
    if (Number.isFinite(seeker.maxElo) && candidate.eloRating > seeker.maxElo) continue;
    if (Number.isFinite(candidate.minElo) && seeker.eloRating < candidate.minElo) continue;
    if (Number.isFinite(candidate.maxElo) && seeker.eloRating > candidate.maxElo) continue;

    const roomId = uuidv4();
    queue.delete(seekerId);
    queue.delete(candidateId);
    return { roomId, userA: seeker, userB: candidate };
  }

  return null;
};

exports.expandTolerance = function (userId) {
  const key = normalizeUserId(userId);
  const entry = queue.get(key);
  if (entry) {
    entry.tolerance = Math.min(entry.tolerance + 50, 400);
    queue.set(key, entry);
  }
};

exports.getQueueSize = function () {
  return queue.size;
};

exports.isInQueue = function (userId) {
  return queue.has(normalizeUserId(userId));
};

exports.getQueueEntry = function (userId) {
  return queue.get(normalizeUserId(userId)) || null;
};
