import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../utils/api';

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub ? <div className="stat-card__sub">{sub}</div> : null}
    </div>
  );
}

export default function Dashboard() {
  const { user, updateMode } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [modeLoading, setModeLoading] = useState(false);
  const [modeError, setModeError] = useState('');

  useEffect(() => {
    api.get('/debate/history').then((response) => setHistory(response.data.sessions || [])).catch(() => {});
  }, []);

  const toggleMode = async () => {
    setModeError('');
    setModeLoading(true);
    try {
      const nextMode = user.mode === 'ghost' ? 'public' : 'ghost';
      await updateMode(nextMode);
    } catch (err) {
      setModeError(err.response?.data?.message || 'Could not update mode');
    } finally {
      setModeLoading(false);
    }
  };

  const winRate = user.totalDebates > 0 ? Math.round((user.wins / user.totalDebates) * 100) : 0;

  return (
    <div className="page">
      <Navbar />
      <div className="container page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Your command center</div>
            <h1 className="page-title">
              Welcome back, <span style={{ color: 'var(--accent)' }}>{user?.mode === 'ghost' ? user?.ghostAlias : user?.username}</span>
            </h1>
            <p className="page-subtitle">
              Track your momentum, switch identity modes, and jump into your next debate without feeling buried in the interface.
            </p>
          </div>
          <div className="button-row">
            <button className="btn btn-primary btn-lg" style={{ minWidth: 210 }} onClick={() => navigate('/lobby')}>
              Find a Debate
            </button>
            <button className="btn btn-ghost btn-lg" style={{ minWidth: 210 }} onClick={() => navigate('/lobby?opponent=ai')}>
              Practice vs AI
            </button>
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <StatCard label="ELO Rating" value={user?.eloRating} sub="Current ranked standing" />
          <StatCard label="Total Debates" value={user?.totalDebates} sub="All recorded matches" />
          <StatCard label="Wins" value={user?.wins} sub={`${winRate}% win rate`} />
          <StatCard label="Losses" value={user?.losses} sub="Learning in progress" />
          <StatCard label="Vocab Score" value={user?.avgVocabScore || '-'} sub="Average across reports" />
        </div>

        <div className="content-grid">
          <div>
            <div className="page-kicker" style={{ marginBottom: 12 }}>Recent activity</div>
            <div className="list-stack">
              {history.length === 0 ? (
                <div className="card empty-state">
                  <div style={{ color: 'var(--text2)', marginBottom: 16 }}>No debates yet. Start your first match from the lobby.</div>
                  <button className="btn btn-primary" onClick={() => navigate('/lobby')}>
                    Start Debating
                  </button>
                </div>
              ) : (
                history.map((session) => (
                  <button
                    key={session.roomId}
                    type="button"
                    onClick={() => navigate(`/report/${session.roomId}`)}
                    className="list-row"
                    style={{ cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{session.topic}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {session.mode} / {new Date(session.endTime).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="button-row" style={{ justifyContent: 'flex-end' }}>
                      {session.matchType === 'human-vs-ai' ? <span className="badge badge-amber">AI Practice</span> : null}
                      {!session.isRated ? <span className="badge badge-amber">Unrated</span> : null}
                      <span className={`badge ${session.winner === 'draw' ? 'badge-amber' : 'badge-blue'}`}>
                        {session.winner === 'draw' ? 'Draw' : 'Ended'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>Open Report</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-stack">
            <div className="card">
              <div className="section-label">Identity mode</div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {user?.mode === 'ghost' ? 'Ghost Mode' : 'Public Mode'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                  {user?.mode === 'ghost' ? `Alias: ${user?.ghostAlias}` : `@${user?.username}`}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.8 }}>
                {user?.mode === 'ghost'
                  ? 'You are debating anonymously. Opponents only see your alias and you stay off the public leaderboard.'
                  : 'Your real profile is visible and you appear on the global leaderboard.'}
              </div>
              {modeError ? <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{modeError}</div> : null}
              <button className="btn btn-ghost btn-block" style={{ fontSize: 12 }} onClick={toggleMode} disabled={modeLoading}>
                {modeLoading ? 'Updating...' : `Switch to ${user?.mode === 'ghost' ? 'Public' : 'Ghost'} Mode`}
              </button>
            </div>

            <div className="card">
              <div className="section-label">Quick actions</div>
              <div className="button-stack">
                {[
                  { label: 'Find a Match', path: '/lobby' },
                  { label: 'Practice vs AI', path: '/lobby?opponent=ai' },
                  { label: 'Open Leaderboard', path: '/leaderboard' },
                  { label: 'View History', path: '/history' }
                ].map((action) => (
                  <button
                    key={action.path}
                    className="btn btn-ghost btn-block"
                    style={{ justifyContent: 'flex-start', fontSize: 13 }}
                    onClick={() => navigate(action.path)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
