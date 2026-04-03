import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import api from '../utils/api';

const WEAK = new Set(['good', 'bad', 'nice', 'big', 'small', 'very', 'really', 'just', 'many', 'few', 'thing', 'stuff', 'get', 'make', 'like', 'okay', 'fine', 'great']);
const ALTS = {
  good: 'exemplary',
  bad: 'detrimental',
  nice: 'admirable',
  big: 'substantial',
  small: 'marginal',
  very: 'remarkably',
  really: 'demonstrably',
  thing: 'factor',
  stuff: 'substance',
  get: 'obtain',
  make: 'generate'
};

function hintWords(text) {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  return [...new Set(words.filter((word) => WEAK.has(word)))].slice(0, 4).map((word) => ({ word, alt: ALTS[word] || 'a stronger word' }));
}

function TimerBar({ remaining, total = 120 }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const color = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>
        <span>Turn timer</span>
        <span style={{ fontFamily: 'var(--font-mono)', color, fontWeight: 600 }}>
          {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 999 }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: color, transition: 'width 1s linear' }} />
      </div>
    </div>
  );
}

function MediaPanel({ mode, localVideoRef, remoteVideoRef, localAudioRef, remoteAudioRef, muted, videoEnabled, onToggleMute, onToggleVideo }) {
  if (mode === 'text') return null;
  if (mode === 'voice') {
    return (
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <audio ref={localAudioRef} autoPlay muted />
        <audio ref={remoteAudioRef} autoPlay />
        <div className="button-row">
          <span className="badge badge-blue">Voice debate live</span>
          <button className="btn btn-ghost btn-sm" onClick={onToggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', aspectRatio: '4 / 3', objectFit: 'cover' }} />
        <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', aspectRatio: '4 / 3', objectFit: 'cover' }} />
      </div>
      <div className="button-row">
        <button className="btn btn-ghost btn-sm" onClick={onToggleMute}>{muted ? 'Unmute Mic' : 'Mute Mic'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onToggleVideo}>{videoEnabled ? 'Disable Camera' : 'Enable Camera'}</button>
      </div>
    </div>
  );
}

function hydrateMessage(message) {
  return {
    ...message,
    side: message.side || (message.isAI ? 'B' : 'A')
  };
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function speechLocale(language = 'English') {
  const value = String(language || 'English').trim().toLowerCase();
  if (value.startsWith('hindi')) return 'hi-IN';
  if (value.startsWith('marathi')) return 'mr-IN';
  if (value.startsWith('telugu')) return 'te-IN';
  if (value.startsWith('tamil')) return 'ta-IN';
  if (value.startsWith('kannada')) return 'kn-IN';
  return 'en-US';
}

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

export default function DebateRoom() {
  const { roomId } = useParams();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('waiting');
  const [side, setSide] = useState(null);
  const [meta, setMeta] = useState({
    topic: '',
    motion: '',
    language: 'English',
    mode: 'text',
    aliasA: '',
    aliasB: '',
    maxRounds: 5,
    countdownSeconds: 30,
    turnDuration: 120,
    matchType: 'human-vs-human',
    isRated: true,
    aiOpponent: null
  });
  const [turn, setTurn] = useState('A');
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(120);
  const [countdown, setCountdown] = useState(30);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [hints, setHints] = useState([]);
  const [result, setResult] = useState(null);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState('');
  const [aiRuntime, setAiRuntime] = useState({ provider: '', model: '', error: '' });
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagCategory, setFlagCategory] = useState('Harassment');
  const [flagReason, setFlagReason] = useState('');
  const [speakingSeconds, setSpeakingSeconds] = useState(0);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const chatEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const recognitionRef = useRef(null);
  const aiAudioRef = useRef(null);
  const currentSideRef = useRef(side);
  const currentOppAliasRef = useRef('');
  const currentIsAiMatchRef = useRef(false);
  const currentTurnDurationRef = useRef(120);
  const currentTtsEnabledRef = useRef(ttsEnabled);
  const currentTurnRef = useRef(turn);

  const {
    startCall,
    cleanup,
    toggleMute,
    toggleVideo,
    muted,
    videoEnabled
  } = useWebRTC({
    socket,
    roomId,
    mode: meta.mode,
    isInitiator: side === 'A',
    localVideoRef,
    remoteVideoRef,
    localAudioRef,
    remoteAudioRef
  });

  const isAiMatch = meta.matchType === 'human-vs-ai';
  const isMyTurn = turn === side;
  const oppAlias = side === 'A' ? meta.aliasB : meta.aliasA;
  const speechRecognitionSupported = Boolean(getSpeechRecognitionCtor());
  const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    currentSideRef.current = side;
    currentOppAliasRef.current = oppAlias;
    currentIsAiMatchRef.current = isAiMatch;
    currentTurnDurationRef.current = meta.turnDuration || 120;
    currentTtsEnabledRef.current = ttsEnabled;
    currentTurnRef.current = turn;
  }, [isAiMatch, meta.turnDuration, oppAlias, side, ttsEnabled, turn]);

  const stopAiAudio = () => {
    if (aiAudioRef.current) {
      aiAudioRef.current.pause();
      aiAudioRef.current = null;
    }
    if (speechSynthesisSupported) {
      window.speechSynthesis.cancel();
    }
  };

  const playAiAudio = (message) => {
    if (!currentTtsEnabledRef.current || !message?.isAI) return;
    stopAiAudio();

    if (message.audio?.dataUrl) {
      const audio = new Audio(message.audio.dataUrl);
      aiAudioRef.current = audio;
      audio.play().catch(() => {});
      return;
    }

    if (speechSynthesisSupported) {
      const utterance = new SpeechSynthesisUtterance(message.content);
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
      if (message.speechFallbackUsed) {
        setStatus('AI server voice was unavailable, so browser speech playback is being used instead.');
      }
    }
  };

  const stopVoiceRecorder = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.stop();
      recognitionRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const response = await api.get(`/debate/session/${roomId}`);
        if (cancelled) return;
        const session = response.data.session;
        const participantSide = response.data.side;

        if (session.status === 'ended') {
          navigate(`/report/${roomId}`, { replace: true });
          return;
        }

        setSide(participantSide);
        setMeta({
          topic: session.topic,
          motion: session.aiOpponent?.motion || session.topic,
          language: session.language,
          mode: session.mode,
          aliasA: session.userAAliasInSession,
          aliasB: session.userBAliasInSession,
          maxRounds: session.maxRounds,
          countdownSeconds: session.countdownSeconds,
          turnDuration: session.turnDuration || 120,
          matchType: session.matchType || 'human-vs-human',
          isRated: session.isRated !== false,
          aiOpponent: session.aiOpponent || null
        });
        setAiRuntime({
          provider: session.aiOpponent?.provider || '',
          model: session.aiOpponent?.model || '',
          error: session.aiError || ''
        });
        setTurn(session.currentTurn || 'A');
        setRound(session.currentRound || 1);
        setRemaining(session.turnSecondsRemaining || session.turnDuration || 120);
        setMessages((session.transcript || []).map(hydrateMessage));
        setSpeakingSeconds(participantSide === 'A' ? session.speakingTimeA || 0 : session.speakingTimeB || 0);
        setPhase(session.status === 'active' ? 'active' : 'waiting');
        if (session.matchType === 'human-vs-ai' && session.aiOpponent?.provider === 'local-fallback') {
          setStatus(session.aiError
            ? `The local AI model was unavailable, so the app used the built-in fallback response instead: ${session.aiError}`
            : 'The local AI model was unavailable, so the app used the built-in fallback response instead.');
        } else if (session.status === 'active' && session.matchType === 'human-vs-ai' && session.currentTurn !== participantSide) {
          setStatus(`${session.userBAliasInSession || 'Dialect AI'} is preparing a response...`);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error.response?.data?.message || 'Could not load this debate room.');
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [navigate, roomId]);

  useEffect(() => {
    if (!socket) return undefined;

    const onMatchFound = ({ side: nextSide }) => {
      if (nextSide) setSide(nextSide);
    };

    const onStarted = async (data) => {
      setMeta({
        topic: data.topic,
        motion: data.motion || data.aiOpponent?.motion || data.topic,
        language: data.language,
        mode: data.mode,
        aliasA: data.aliasA,
        aliasB: data.aliasB,
        maxRounds: data.maxRounds,
        countdownSeconds: data.countdownSeconds,
        turnDuration: data.turnDuration || 120,
        matchType: data.matchType || 'human-vs-human',
        isRated: data.isRated !== false,
        aiOpponent: data.aiOpponent || null
      });
      setAiRuntime({
        provider: data.aiOpponent?.provider || '',
        model: data.aiOpponent?.model || '',
        error: ''
      });
      setTurn(data.firstTurn);
      setRemaining(data.turnDuration || 120);
      setCountdown(data.countdownSeconds);
      setPhase('countdown');
      setPaused(false);
      setStatus('');
      if (data.mode === 'voice' || data.mode === 'video') {
        try {
          await startCall();
        } catch {
          setStatus('Could not start media devices for this debate.');
        }
      }
    };

    const onMessage = (message) => {
      const nextMessage = hydrateMessage(message);
      setMessages((current) => [...current, nextMessage]);
      if (nextMessage.isAI) {
        setAiRuntime({
          provider: nextMessage.provider || '',
          model: nextMessage.model || '',
          error: nextMessage.error || ''
        });
        setStatus(nextMessage.fallbackUsed
          ? (nextMessage.error
            ? `The local AI model was unavailable, so the app used the built-in fallback response instead: ${nextMessage.error}`
            : 'The local AI model was unavailable, so the app used the built-in fallback response instead.')
          : '');
        playAiAudio(nextMessage);
      }
    };

    const onTurnChange = ({ turn: nextTurn, round: nextRound, timedOut }) => {
      setTurn(nextTurn);
      setRound(nextRound);
      setRemaining(currentTurnDurationRef.current);
      setHints([]);
      setDraft('');
      if (timedOut) {
        setStatus('The previous turn timed out.');
      } else if (currentIsAiMatchRef.current && nextTurn !== currentSideRef.current) {
        setStatus(`${currentOppAliasRef.current || 'Dialect AI'} is preparing a response...`);
      } else {
        setStatus('');
      }
    };

    const onTimer = ({ remaining: nextRemaining }) => setRemaining(nextRemaining);
    const onEnded = (payload) => {
      stopVoiceRecorder();
      stopAiAudio();
      setResult(payload);
      setPhase('ended');
      cleanup();
    };
    const onPaused = ({ remaining: nextRemaining }) => {
      setPaused(true);
      setRemaining(nextRemaining);
      setStatus('Debate paused while the other debater reconnects.');
    };
    const onResumed = ({ remaining: nextRemaining }) => {
      setPaused(false);
      setRemaining(nextRemaining);
      setStatus(
        currentIsAiMatchRef.current && currentTurnRef.current !== currentSideRef.current
          ? `${currentOppAliasRef.current || 'Dialect AI'} is back on turn.`
          : 'Debate resumed.'
      );
    };
    const onOpponentDisconnected = () => {
      setPaused(true);
      setStatus('Opponent disconnected. Waiting up to 60 seconds for reconnection.');
    };
    const onOpponentReconnected = () => {
      setPaused(false);
      setStatus('Opponent reconnected.');
    };
    const onFlagConfirmed = () => {
      setFlagOpen(false);
      setFlagReason('');
      setStatus('Report submitted successfully.');
    };
    const onError = ({ message }) => setStatus(message);

    socket.on('match:found', onMatchFound);
    socket.on('debate:started', onStarted);
    socket.on('debate:message', onMessage);
    socket.on('debate:turn_change', onTurnChange);
    socket.on('debate:timer', onTimer);
    socket.on('debate:ended', onEnded);
    socket.on('debate:paused', onPaused);
    socket.on('debate:resumed', onResumed);
    socket.on('debate:opponent_disconnected', onOpponentDisconnected);
    socket.on('debate:opponent_reconnected', onOpponentReconnected);
    socket.on('flag:confirmed', onFlagConfirmed);
    socket.on('error', onError);
    socket.emit('room:join', { roomId });

    return () => {
      socket.off('match:found', onMatchFound);
      socket.off('debate:started', onStarted);
      socket.off('debate:message', onMessage);
      socket.off('debate:turn_change', onTurnChange);
      socket.off('debate:timer', onTimer);
      socket.off('debate:ended', onEnded);
      socket.off('debate:paused', onPaused);
      socket.off('debate:resumed', onResumed);
      socket.off('debate:opponent_disconnected', onOpponentDisconnected);
      socket.off('debate:opponent_reconnected', onOpponentReconnected);
      socket.off('flag:confirmed', onFlagConfirmed);
      socket.off('error', onError);
      stopAiAudio();
      cleanup();
    };
  }, [cleanup, roomId, socket, startCall]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    const interval = setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          clearInterval(interval);
          setPhase('active');
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    stopVoiceRecorder();
    stopAiAudio();
  }, []);

  useEffect(() => {
    if (!socket || phase !== 'active' || meta.mode === 'text' || paused || !isMyTurn) return undefined;
    const interval = setInterval(() => {
      setSpeakingSeconds((current) => {
        const next = current + 1;
        socket.emit('debate:speaking_stats', { roomId, seconds: next });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, meta.mode, paused, phase, roomId, socket]);

  const onDraftChange = (event) => {
    const value = event.target.value;
    setDraft(value);
    setHints(hintWords(value));
    socket?.emit('debate:draft_update', { roomId, content: value });
  };

  const sendMessage = () => {
    if (!socket || !draft.trim() || !isMyTurn || phase !== 'active' || paused) return;
    setStatus(isAiMatch ? `${oppAlias || 'Dialect AI'} is preparing a response...` : '');
    socket.emit('debate:send_message', { roomId, content: draft.trim() });
  };

  const startVoiceInput = async () => {
    if (!isAiMatch || meta.mode !== 'text' || !isMyTurn) return;
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setStatus('Browser speech recognition is not available here. Use Chrome or Edge, or type your response manually.');
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognitionRef.current = recognition;
      recognition.lang = speechLocale(meta.language);
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
        setVoiceRecording(false);
        recognitionRef.current = null;
        if (!transcript) {
          setStatus('No speech was captured. Please try again.');
          return;
        }

        setDraft(transcript);
        setHints(hintWords(transcript));
        socket?.emit('debate:draft_update', { roomId, content: transcript });
        setStatus('Voice note transcribed in your browser. Review it, then send when ready.');
      };

      recognition.onerror = () => {
        setVoiceRecording(false);
        recognitionRef.current = null;
        setStatus('Browser speech recognition could not understand that clearly. Please try again.');
      };

      recognition.onend = () => {
        setVoiceRecording(false);
        recognitionRef.current = null;
      };

      recognition.start();
      setVoiceRecording(true);
      setStatus('Listening through your browser microphone. Tap stop when you are done.');
    } catch {
      setVoiceRecording(false);
      setStatus('Microphone or browser speech recognition was blocked, so voice input could not start.');
    }
  };

  const submitFlag = () => {
    if (!socket || !flagCategory || isAiMatch) return;
    socket.emit('debate:flag', {
      roomId,
      category: flagCategory,
      reason: flagReason || flagCategory
    });
  };

  const forfeitDebate = async () => {
    try {
      await api.post(`/debate/session/${roomId}/forfeit`);
      setStatus('Forfeiting debate...');
    } catch (error) {
      if (socket) {
        socket.emit('debate:forfeit', { roomId });
        setStatus('Forfeiting debate...');
      } else {
        setStatus(error.response?.data?.message || 'Could not forfeit this debate.');
      }
    }
  };

  if (phase === 'waiting') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="spin" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>
          {status || 'Connecting to debate room...'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Room: {roomId}</div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Debate begins in</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 88, fontWeight: 800, color: 'var(--accent)' }}>{countdown}</div>
        <div style={{ color: 'var(--text2)' }}>{meta.topic} / {meta.language}</div>
      </div>
    );
  }

  if (phase === 'ended' && result) {
    const myEloChange = side === 'A' ? result.eloChangeA : result.eloChangeB;
    const myNewElo = side === 'A' ? result.newEloA : result.newEloB;
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            {result.winner === side ? 'You Won' : result.winner === 'draw' ? 'Draw' : 'Debate Ended'}
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: 18 }}>{meta.topic}</div>
          <div className="button-row" style={{ justifyContent: 'center', marginBottom: 20 }}>
            {meta.isRated ? (
              <>
                <span className={`badge ${myEloChange >= 0 ? 'badge-green' : 'badge-red'}`}>
                  {myEloChange >= 0 ? '+' : ''}{myEloChange} ELO
                </span>
                <span className="badge badge-blue">{myNewElo} New Rating</span>
              </>
            ) : (
              <span className="badge badge-amber">Unrated AI Practice</span>
            )}
          </div>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/report/${roomId}`)}>View Debate Report</button>
            <button className="btn btn-ghost" onClick={() => navigate(meta.isRated ? '/lobby' : '/lobby?opponent=ai')}>
              Debate Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ height: 56, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>DIAL<span style={{ color: 'var(--accent)' }}>ECT</span></div>
        <span className="badge badge-blue">{meta.mode}</span>
        <span className="badge badge-blue">{meta.language}</span>
        {isAiMatch ? <span className="badge badge-amber">AI Practice</span> : null}
        {!meta.isRated ? <span className="badge badge-amber">Unrated</span> : null}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{meta.topic}</span>
        <span style={{ marginLeft: 'auto', color: isMyTurn ? 'var(--green)' : 'var(--text2)', fontSize: 12 }}>
          {isMyTurn ? 'Your turn' : `${oppAlias}'s turn`}
        </span>
        {!isAiMatch ? <button className="btn btn-ghost btn-sm" onClick={() => setFlagOpen(true)}>Report</button> : null}
        <button className="btn btn-danger btn-sm" onClick={forfeitDebate}>Forfeit</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <MediaPanel
            mode={meta.mode}
            localVideoRef={localVideoRef}
            remoteVideoRef={remoteVideoRef}
            localAudioRef={localAudioRef}
            remoteAudioRef={remoteAudioRef}
            muted={muted}
            videoEnabled={videoEnabled}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
          />

          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {status ? (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text2)', fontSize: 13 }}>
                {status}
              </div>
            ) : null}

            {isAiMatch && meta.motion ? (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--accent-glow)', border: '1px solid var(--accent2)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Today's Motion
                </div>
                <div style={{ color: 'var(--text)', lineHeight: 1.6, fontWeight: 600 }}>
                  {meta.motion}
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6 }}>
                  Debate category: {meta.topic}
                </div>
              </div>
            ) : null}

            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--muted)', fontSize: 13 }}>
                The debate is live. {isMyTurn ? 'Open with your strongest argument.' : `${oppAlias} has the floor first.`}
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div key={`${message.alias}-${message.timestamp || index}`} style={{ display: 'flex', justifyContent: message.side === side ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                <div style={{ maxWidth: '76%' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                    {message.alias} / Round {message.round}{message.isAI ? ' / AI' : ''}{message.timedOut ? ' / auto-submitted' : ''}{message.filtered ? ' / filtered' : ''}
                  </div>
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: message.side === side ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                    background: message.side === side ? 'var(--accent)' : 'var(--surface2)',
                    border: `1px solid ${message.side === side ? 'var(--accent2)' : 'var(--border)'}`,
                    lineHeight: 1.55
                  }}>
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '14px 20px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
            <TimerBar remaining={remaining} total={meta.turnDuration || 120} />

            {hints.length ? (
              <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {hints.map((hint) => (
                  <div key={hint.word} style={{ padding: '4px 10px', background: 'var(--amber-dim)', border: '1px solid #d4912a30', borderRadius: 20, fontSize: 11, color: 'var(--amber)' }}>
                    Try <strong>{hint.alt}</strong> instead of "{hint.word}"
                  </div>
                ))}
              </div>
            ) : null}

            {isAiMatch && meta.mode === 'text' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  Voice practice:
                  {' '}
                  {voiceProcessing ? 'transcribing your latest clip...' : 'use your browser microphone to dictate, then edit before sending.'}
                </div>
                <div className="button-row">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={voiceRecording ? stopVoiceRecorder : startVoiceInput}
                    disabled={!isMyTurn || paused || voiceProcessing}
                  >
                    {voiceRecording ? 'Stop Recording' : 'Voice Input'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setTtsEnabled((current) => {
                        const next = !current;
                        if (!next) stopAiAudio();
                        return next;
                      });
                    }}
                  >
                    {ttsEnabled ? 'Mute AI Voice' : 'Enable AI Voice'}
                  </button>
                </div>
              </div>
            ) : null}

            {meta.mode === 'text' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <textarea
                  value={draft}
                  onChange={onDraftChange}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={!isMyTurn || paused}
                  placeholder={isMyTurn ? 'Type your argument...' : `Waiting for ${oppAlias}...`}
                  rows={3}
                  maxLength={1000}
                  style={{
                    flex: 1,
                    background: 'var(--surface2)',
                    border: `1px solid ${isMyTurn ? 'var(--border2)' : 'var(--border)'}`,
                    borderRadius: 8,
                    color: 'var(--text)',
                    padding: '10px 14px',
                    resize: 'none',
                    opacity: isMyTurn && !paused ? 1 : 0.6
                  }}
                />
                <button className="btn btn-primary" onClick={sendMessage} disabled={!isMyTurn || !draft.trim() || paused || voiceProcessing}>Send</button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {paused ? 'The room is paused while reconnection is in progress.' : isMyTurn ? 'You currently hold the floor.' : `${oppAlias} currently holds the floor.`}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
              <span>{draft.length}/1000</span>
              <span>Shift+Enter for newline</span>
            </div>
          </div>
        </div>

        <div style={{ width: 260, background: 'var(--surface)', borderLeft: '1px solid var(--border)', padding: 16, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Participants</div>
          {[{ label: 'A', alias: meta.aliasA, note: side === 'A' ? 'You' : 'Opponent' }, { label: 'B', alias: meta.aliasB, note: isAiMatch ? `${meta.aiOpponent?.persona || 'AI'} / ${meta.aiOpponent?.difficulty || 'medium'}` : side === 'B' ? 'You' : 'Opponent' }].map((entry) => (
            <div key={entry.label} style={{ padding: '10px 12px', border: `1px solid ${turn === entry.label ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, marginBottom: 8, background: turn === entry.label ? 'var(--accent-glow)' : 'var(--surface2)' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Debater {entry.label}</div>
              <div style={{ fontWeight: 600 }}>{entry.alias}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{entry.note}</div>
            </div>
          ))}

          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 18, marginBottom: 10 }}>Session</div>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>Round {round} / {meta.maxRounds}</div>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>Messages: {messages.length}</div>
          <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>{meta.isRated ? 'Rated ELO match' : 'Unrated practice match'}</div>
          {meta.mode !== 'text' ? <div style={{ color: 'var(--text2)', fontSize: 13 }}>Your speaking time: {speakingSeconds}s</div> : null}
          {isAiMatch ? (
            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>AI Profile</div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>{meta.aiOpponent?.displayName || 'Dialect AI'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                Persona: {meta.aiOpponent?.persona || 'analyst'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                Difficulty: {meta.aiOpponent?.difficulty || 'medium'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                Voice: {ttsEnabled ? 'enabled' : 'muted'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                Provider: {aiRuntime.provider || 'pending'}
              </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  Model: {aiRuntime.model || meta.aiOpponent?.model || 'pending'}
                </div>
              {aiRuntime.provider === 'local-fallback' ? (
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--amber-dim)', border: '1px solid #d4912a30', color: 'var(--amber)', fontSize: 11, lineHeight: 1.45 }}>
                  The local AI model was unavailable, so this turn came from the built-in fallback system.
                  {aiRuntime.error ? ` ${aiRuntime.error}` : ''}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {flagOpen && !isAiMatch ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 380 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Report Opponent</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Category</label>
              <select className="input" value={flagCategory} onChange={(event) => setFlagCategory(event.target.value)}>
                <option>Hate Speech</option>
                <option>Harassment</option>
                <option>Profanity Bypass</option>
                <option>Cheating/Scripted Responses</option>
                <option>Other</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>Notes</label>
              <textarea className="input" rows={4} value={flagReason} onChange={(event) => setFlagReason(event.target.value)} placeholder="Optional extra context..." />
            </div>
            <div className="button-row">
              <button className="btn btn-danger" onClick={submitFlag}>Submit Report</button>
              <button className="btn btn-ghost" onClick={() => setFlagOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
