import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../utils/api';

const TOPICS = ['', 'Technology & AI', 'Climate Change', 'Education Reform', 'Economic Policy', 'Ethics & Philosophy', 'Healthcare', 'General'];
const LANGUAGES = ['', 'English', 'Hindi'];

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get('/leaderboard', { params: { search, topic, language } })
      .then((response) => {
        if (mounted) setBoard(response.data.leaderboard || []);
      })
      .catch(() => {
        if (mounted) setBoard([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [language, search, topic]);

  return (
    <div className="page">
      <Navbar />
      <div className="container page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Public rankings</div>
            <h1 className="page-title">Global Leaderboard</h1>
            <p className="page-subtitle">
              Browse the strongest public debaters by ELO, then narrow the board by topic, language, or name without everything feeling squeezed together.
            </p>
          </div>

          <div className="filters-bar" style={{ minWidth: 'min(100%, 620px)', justifyContent: 'flex-end' }}>
            <input className="input" style={{ width: 220 }} placeholder="Search username..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="input" style={{ width: 190 }} value={topic} onChange={(event) => setTopic(event.target.value)}>
              {TOPICS.map((item) => <option key={item || 'all'} value={item}>{item || 'All Topics'}</option>)}
            </select>
            <select className="input" style={{ width: 170 }} value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((item) => <option key={item || 'all'} value={item}>{item || 'All Languages'}</option>)}
            </select>
          </div>
        </div>

        {user?.mode === 'ghost' && (
          <div className="panel-note" style={{ marginBottom: 22 }}>
            You are in Ghost Mode, so you stay hidden from the public leaderboard until you switch to Public Mode from your dashboard.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 70 }}>
            <div className="spin" style={{ width: 38, height: 38, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto' }} />
          </div>
        ) : board.length === 0 ? (
          <div className="card empty-state">
            <div style={{ color: 'var(--text2)' }}>No public debaters match the current filters yet.</div>
          </div>
        ) : (
          <div className="table-shell">
            <div className="table-grid">
              <div className="table-header" style={{ gridTemplateColumns: '70px 1.6fr 110px 90px 110px 110px' }}>
                <div>Rank</div>
                <div>Debater</div>
                <div style={{ textAlign: 'right' }}>ELO</div>
                <div style={{ textAlign: 'right' }}>Wins</div>
                <div style={{ textAlign: 'right' }}>Debates</div>
                <div style={{ textAlign: 'right' }}>Vocab</div>
              </div>

              {board.map((entry, index) => {
                const isMe = entry._id === user?._id;
                return (
                  <button
                    key={entry._id}
                    type="button"
                    onClick={() => navigate(`/profile?id=${entry._id}`)}
                    className="table-row"
                    style={{
                      width: '100%',
                      border: 'none',
                      background: isMe ? 'var(--accent-glow)' : 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      gridTemplateColumns: '70px 1.6fr 110px 90px 110px 110px'
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', color: index < 3 ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>#{index + 1}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                        {entry.username} {isMe ? <span style={{ fontSize: 11, color: 'var(--accent)' }}>(you)</span> : null}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {entry.totalDebates ? `${Math.round((entry.wins / entry.totalDebates) * 100)}% win rate` : 'No completed debates yet'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700 }}>{entry.eloRating}</div>
                    <div style={{ textAlign: 'right', color: 'var(--green)' }}>{entry.wins}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{entry.totalDebates}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{entry.avgVocabScore || '-'}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
