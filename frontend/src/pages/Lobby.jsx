import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Navbar from '../components/Navbar';
import api from '../utils/api';

const TOPICS = [
  'Technology & AI',
  'Climate Change',
  'Education Reform',
  'Economic Policy',
  'Ethics & Philosophy',
  'Healthcare',
  'General'
];

const MODES = [
  { id: 'text', label: 'Text Debate', desc: 'Turn-based, timer-led structured exchanges.' },
  { id: 'voice', label: 'Voice Debate', desc: 'Live audio debate over WebRTC.' },
  { id: 'video', label: 'Video Debate', desc: 'Face-to-face debate with camera and mic.' }
];

const OPPONENT_TYPES = [
  { id: 'human', label: 'Match with Human', desc: 'Queue into live rated matchmaking.' },
  { id: 'ai', label: 'Play Against AI', desc: 'Start an unrated text practice room instantly.' }
];

const AI_DIFFICULTIES = [
  { id: 'easy', label: 'Easy', desc: 'Shorter turns, lighter pressure.' },
  { id: 'medium', label: 'Medium', desc: 'Balanced rebuttals and clearer pressure.' },
  { id: 'hard', label: 'Hard', desc: 'Sharper framing and tougher rebuttals.' }
];

const AI_PERSONAS = [
  { id: 'analyst', label: 'Analyst', desc: 'Calm, evidence-first reasoning.' },
  { id: 'challenger', label: 'Challenger', desc: 'Punchy, skeptical, and aggressive.' },
  { id: 'mentor', label: 'Mentor', desc: 'Patient, explanatory, and coaching-oriented.' }
];

export default function Lobby() {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timerRef = useRef(null);
  const aiCreateAttemptRef = useRef(0);

  const [opponentType, setOpponentType] = useState(searchParams.get('opponent') === 'ai' ? 'ai' : 'human');
  const [topic, setTopic] = useState(user?.preferredTopics?.[0] || 'General');
  const [mode, setMode] = useState(user?.preferredMode || 'text');
  const [language, setLanguage] = useState(user?.preferredLanguage || 'English');
  const [minElo, setMinElo] = useState('');
  const [maxElo, setMaxElo] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiPersona, setAiPersona] = useState('analyst');
  const [queued, setQueued] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [tolerance, setTolerance] = useState(150);
  const [status, setStatus] = useState('');
  const [creatingAiMatch, setCreatingAiMatch] = useState(false);

  useEffect(() => {
    if (opponentType === 'ai' && mode !== 'text') {
      setMode('text');
    }
  }, [mode, opponentType]);

  useEffect(() => {
    if (!socket) return undefined;

    const onQueueJoined = () => {
      setQueued(true);
      setElapsed(0);
      setTolerance(150);
      setStatus('Searching for a worthy opponent...');
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);
    };

    const onSearchUpdate = ({ tolerance: nextTolerance }) => {
      setTolerance(nextTolerance);
      setStatus(`Still searching. Expanding matchmaking tolerance to +/-${nextTolerance} ELO.`);
    };

    const onMatchFound = ({ roomId, matchType }) => {
      clearInterval(timerRef.current);
      aiCreateAttemptRef.current = 0;
      setQueued(false);
      setCreatingAiMatch(false);
      setStatus(matchType === 'human-vs-ai' ? 'AI room ready. Entering practice debate...' : 'Match found. Entering debate room...');
      navigate(`/debate/${roomId}`);
    };

    const onQueueLeft = () => {
      clearInterval(timerRef.current);
      setQueued(false);
      setElapsed(0);
      setStatus('');
    };

    const onSocketError = ({ message }) => {
      clearInterval(timerRef.current);
      aiCreateAttemptRef.current = 0;
      setQueued(false);
      setCreatingAiMatch(false);
      setStatus(`Error: ${message}`);
    };

    socket.on('queue:joined', onQueueJoined);
    socket.on('queue:search_update', onSearchUpdate);
    socket.on('match:found', onMatchFound);
    socket.on('queue:left', onQueueLeft);
    socket.on('error', onSocketError);

    return () => {
      socket.off('queue:joined', onQueueJoined);
      socket.off('queue:search_update', onSearchUpdate);
      socket.off('match:found', onMatchFound);
      socket.off('queue:left', onQueueLeft);
      socket.off('error', onSocketError);
      clearInterval(timerRef.current);
    };
  }, [navigate, socket]);

  const selectedSummary = useMemo(() => {
    if (opponentType === 'ai') {
      return `${topic} / text / ${language} / ${aiDifficulty} / ${aiPersona}`;
    }
    const rangeText = minElo || maxElo ? ` / ELO ${minElo || 'any'}-${maxElo || 'any'}` : '';
    return `${topic} / ${mode} / ${language}${rangeText}`;
  }, [aiDifficulty, aiPersona, language, maxElo, minElo, mode, opponentType, topic]);

  const ensureHardware = async () => {
    if (mode === 'text') return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video'
      });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setStatus(`Unable to access ${mode === 'video' ? 'camera and microphone' : 'microphone'}.`);
      return false;
    }
  };

  const waitForSocketReady = async () => {
    if (!socket) {
      throw new Error('Realtime connection is not available yet.');
    }

    if (socket.connected || connected) {
      return socket;
    }

    setStatus('Connecting to the live debate server...');
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        reject(new Error('Realtime connection timed out. Please try again.'));
      }, 10000);

      const onConnect = () => {
        window.clearTimeout(timeout);
        socket.off('connect_error', onError);
        resolve();
      };

      const onError = () => {
        window.clearTimeout(timeout);
        socket.off('connect', onConnect);
        reject(new Error('Could not connect to the debate server.'));
      };

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });

    return socket;
  };

  const joinQueue = async () => {
    if (!socket) return;
    const ok = await ensureHardware();
    if (!ok) return;
    try {
      const liveSocket = await waitForSocketReady();
      liveSocket.emit('queue:join', {
        topic,
        mode,
        language,
        minElo: minElo ? Number(minElo) : null,
        maxElo: maxElo ? Number(maxElo) : null
      });
    } catch (error) {
      setStatus(`Error: ${error.message || 'Could not join the queue.'}`);
    }
  };

  const createAiMatchViaSocket = async () => {
    const liveSocket = await waitForSocketReady();
    const attemptId = Date.now();
    aiCreateAttemptRef.current = attemptId;

    return new Promise((resolve, reject) => {
      let settled = false;

      const finish = (handler) => (value) => {
        if (settled || aiCreateAttemptRef.current !== attemptId) return;
        settled = true;
        window.clearTimeout(timeout);
        liveSocket.off('match:found', onMatchFoundOnce);
        handler(value);
      };

      const resolveOnce = finish(resolve);
      const rejectOnce = finish(reject);

      const onMatchFoundOnce = (payload) => {
        if (payload?.matchType === 'human-vs-ai' && payload?.roomId) {
          resolveOnce({ success: true, roomId: payload.roomId });
        }
      };

      const timeout = window.setTimeout(() => {
        rejectOnce(new Error('AI room creation timed out. Please try again.'));
      }, 30000);

      liveSocket.on('match:found', onMatchFoundOnce);
      liveSocket.emit('ai:match:create', {
        topic,
        language,
        difficulty: aiDifficulty,
        persona: aiPersona
      }, (payload) => {
        if (!payload?.success || !payload?.roomId) {
          rejectOnce(new Error(payload?.message || 'Could not create AI debate.'));
          return;
        }
        resolveOnce(payload);
      });
    });
  };

  const startAiMatch = async () => {
    setCreatingAiMatch(true);
    setStatus('Creating your AI practice room...');

    try {
      aiCreateAttemptRef.current = Date.now();
      let payload;

      try {
        const response = await api.post('/debate/ai-room', {
          topic,
          language,
          difficulty: aiDifficulty,
          persona: aiPersona
        });
        payload = response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          payload = await createAiMatchViaSocket();
        } else {
          throw error;
        }
      }

      if (!payload?.success || !payload?.roomId) {
        throw new Error(payload?.message || 'Could not create AI debate.');
      }

      aiCreateAttemptRef.current = 0;
      setStatus('AI room ready. Entering practice debate...');
      setCreatingAiMatch(false);
      navigate(`/debate/${payload.roomId}`);
    } catch (error) {
      aiCreateAttemptRef.current = 0;
      setCreatingAiMatch(false);
      setStatus(`Error: ${error.response?.data?.message || error.message || 'Could not create AI debate.'}`);
    }
  };

  const leaveQueue = () => {
    if (!socket) return;
    socket.emit('queue:leave');
  };

  const fmt = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="page">
      <Navbar />
      <div className="container page-shell page-shell--narrow">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Queue setup</div>
            <h1 className="page-title">Debate Lobby</h1>
            <p className="page-subtitle">
              Build your next match with a little more breathing room. Queue for a rated live opponent or open an unrated AI sparring room for focused practice.
            </p>
          </div>
          <div className="panel-note" style={{ minWidth: 260 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Current preference
            </div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedSummary}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {connected ? 'Realtime matchmaking connected.' : 'Realtime connection still warming up.'}
            </div>
          </div>
        </div>

        {!queued ? (
          <div className="section-stack fade-in">
            <div className="card">
              <div className="section-label">Opponent</div>
              <div className="selection-grid">
                {OPPONENT_TYPES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOpponentType(item.id)}
                    className={`selection-card ${opponentType === item.id ? 'active' : ''}`}
                    style={{ textAlign: 'left' }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="section-label">Debate Mode</div>
              <div className="selection-grid">
                {MODES.map((item) => {
                  const disabled = opponentType === 'ai' && item.id !== 'text';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !disabled && setMode(item.id)}
                      className={`selection-card ${mode === item.id ? 'active' : ''}`}
                      style={{ textAlign: 'left', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                      disabled={disabled}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                        {disabled ? 'AI practice currently ships in text mode for reliability.' : item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <div className="section-label">Topic and language</div>
              <div className="section-stack" style={{ gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, fontWeight: 600 }}>Topic</div>
                  <div className="chip-group">
                    {TOPICS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTopic(item)}
                        className={`chip-button ${topic === item ? 'active' : ''}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ maxWidth: 280 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>Language</div>
                  <input className="input" value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="English" />
                </div>
              </div>
            </div>

            {opponentType === 'human' ? (
              <div className="card">
                <div className="section-label">Optional ELO filter</div>
                <div className="filters-bar">
                  <input className="input" style={{ flex: 1, minWidth: 180 }} type="number" placeholder="Min ELO" value={minElo} onChange={(event) => setMinElo(event.target.value)} />
                  <input className="input" style={{ flex: 1, minWidth: 180 }} type="number" placeholder="Max ELO" value={maxElo} onChange={(event) => setMaxElo(event.target.value)} />
                </div>
              </div>
            ) : (
              <div className="content-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                <div className="card">
                  <div className="section-label">AI Difficulty</div>
                  <div className="selection-grid">
                    {AI_DIFFICULTIES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAiDifficulty(item.id)}
                        className={`selection-card ${aiDifficulty === item.id ? 'active' : ''}`}
                        style={{ textAlign: 'left' }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <div className="section-label">AI Persona</div>
                  <div className="selection-grid">
                    {AI_PERSONAS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAiPersona(item.id)}
                        className={`selection-card ${aiPersona === item.id ? 'active' : ''}`}
                        style={{ textAlign: 'left' }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                          {item.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {status ? <div className="status-banner">{status}</div> : null}

            <div className="card" style={{ padding: 22 }}>
              <div className="button-row">
                {opponentType === 'human' ? (
                  <button className="btn btn-primary btn-lg" style={{ minWidth: 240 }} onClick={joinQueue}>
                    Enter Rated Queue
                  </button>
                ) : (
                  <button className="btn btn-primary btn-lg" style={{ minWidth: 240 }} onClick={startAiMatch} disabled={creatingAiMatch}>
                    {creatingAiMatch ? 'Creating AI Room...' : 'Start AI Debate'}
                  </button>
                )}
                <div style={{ color: 'var(--text2)', fontSize: 13 }}>
                  Selected setup: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{selectedSummary}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card fade-in empty-state">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 10 }}>{status || 'Searching...'}</h2>
            <p style={{ color: 'var(--text2)', fontSize: 32, fontFamily: 'var(--font-mono)', marginBottom: 18 }}>
              {fmt(elapsed)}
            </p>
            <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
              Looking for opponents near your ELO in {mode} mode on {topic} ({language}).
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
              Current tolerance: +/-{tolerance} ELO
            </div>
            <button className="btn btn-ghost" onClick={leaveQueue}>
              Cancel Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
