import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/debate/history')
      .then((response) => setSessions(response.data.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modeIcon = (mode) => ({ text: 'Text', voice: 'Voice', video: 'Video' }[mode] || 'Text');

  return (
    <div className="page">
      <Navbar />
      <div className="container page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">Past matches</div>
            <h1 className="page-title">Debate History</h1>
            <p className="page-subtitle">A cleaner view of your most recent debate rooms, reports, and outcomes.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 70 }}>
            <div className="spin" style={{ width: 38, height: 38, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, marginBottom: 10 }}>History</div>
            <div style={{ color: 'var(--text2)', marginBottom: 18 }}>No debate history yet.</div>
            <button className="btn btn-primary" onClick={() => navigate('/lobby')}>Start Your First Debate</button>
          </div>
        ) : (
          <div className="list-stack">
            {sessions.map((session) => (
              <button
                key={session.roomId}
                type="button"
                onClick={() => navigate(`/report/${session.roomId}`)}
                className="list-row"
                style={{ cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 72, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Mode
                  </div>
                  <div style={{ fontWeight: 700 }}>{modeIcon(session.mode)}</div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{session.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {session.userAAliasInSession} vs {session.userBAliasInSession} / {new Date(session.endTime).toLocaleString()}
                  </div>
                </div>

                <div className="button-row" style={{ justifyContent: 'flex-end' }}>
                  {session.matchType === 'human-vs-ai' ? <span className="badge badge-amber">AI Practice</span> : null}
                  {!session.isRated ? <span className="badge badge-amber">Unrated</span> : null}
                  <span className={`badge ${session.winner === 'draw' ? 'badge-amber' : 'badge-blue'}`}>
                    {session.winner === 'draw' ? 'Draw' : `Winner: ${session.winner}`}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>View Report</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
