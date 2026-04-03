import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`segmented-button ${active ? 'active' : ''}`}>
      {children}
    </button>
  );
}

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('flags');
  const [flags, setFlags] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [flagsResponse, usersResponse] = await Promise.all([
        api.get('/leaderboard/admin/flags'),
        api.get('/leaderboard/admin/users')
      ]);
      setFlags(flagsResponse.data.sessions || []);
      setUsers(usersResponse.data.users || []);
    } finally {
      setLoading(false);
    }
  };

  const moderate = async (roomId, ticketId, action) => {
    const note = window.prompt('Add an admin note for this action:', '') ?? '';
    const durationDays = action === 'temporary_ban'
      ? Number(window.prompt('Temporary ban duration in days:', '7') || '7')
      : 0;

    try {
      await api.post(`/leaderboard/admin/moderate/${roomId}/${ticketId}`, { action, note, durationDays });
      setMessage('Moderation action applied.');
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not apply moderation action');
    }
  };

  const permanentBan = async (userId) => {
    const reason = window.prompt('Ban reason:', 'Violation of community guidelines') || 'Violation of community guidelines';
    try {
      await api.post(`/leaderboard/admin/ban/${userId}`, { reason });
      setMessage('User permanently banned.');
      loadData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Could not ban user');
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ padding: '32px 24px', flex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <div className="button-row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <span className="badge badge-amber">Admin</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800 }}>Moderation Panel</h1>
          </div>
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Review flags, inspect users, and apply warnings or bans.</p>
        </div>

        <div className="segmented-control" style={{ marginBottom: 20 }}>
          <TabButton active={tab === 'flags'} onClick={() => setTab('flags')}>Flagged Sessions</TabButton>
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>Users</TabButton>
        </div>

        {message ? (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text2)' }}>
            {message}
          </div>
        ) : null}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--amber)', borderRadius: '50%', margin: '0 auto' }} />
          </div>
        ) : tab === 'flags' ? (
          <div className="fade-in">
            {flags.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ color: 'var(--text2)' }}>No moderation tickets right now.</div>
              </div>
            ) : (
              flags.map((session) => (
                <div key={session.roomId} className="card" style={{ marginBottom: 16 }}>
                  <div className="button-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{session.topic} • {session.language}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {session.userA?.username || '?'} vs {session.userB?.username || '?'} • {new Date(session.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/report/${session.roomId}`)}>View Report</button>
                  </div>

                  {session.flags?.map((flag) => (
                    <div key={flag.ticketId} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                      <div className="button-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{flag.category}</div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{flag.reason}</div>
                        </div>
                        <div className={`badge ${flag.status === 'pending' ? 'badge-amber' : flag.status === 'dismissed' ? 'badge-red' : 'badge-green'}`}>
                          {flag.status}
                        </div>
                      </div>
                      <div className="button-row">
                        <button className="btn btn-ghost btn-sm" onClick={() => moderate(session.roomId, flag.ticketId, 'dismiss')}>Dismiss</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => moderate(session.roomId, flag.ticketId, 'warning')}>Warn</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => moderate(session.roomId, flag.ticketId, 'temporary_ban')}>Temp Ban</button>
                        <button className="btn btn-danger btn-sm" onClick={() => moderate(session.roomId, flag.ticketId, 'permanent_ban')}>Perm Ban</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="fade-in">
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 110px 110px 120px', padding: '10px 20px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <div>User</div>
                <div style={{ textAlign: 'right' }}>Mode</div>
                <div style={{ textAlign: 'right' }}>ELO</div>
                <div style={{ textAlign: 'right' }}>Debates</div>
                <div style={{ textAlign: 'right' }}>Status</div>
                <div style={{ textAlign: 'right' }}>Action</div>
              </div>

              {users.map((entry) => (
                <div key={entry._id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 90px 110px 110px 120px', padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{entry.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{entry._id}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{entry.mode}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{entry.eloRating}</div>
                  <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{entry.totalDebates}</div>
                  <div style={{ textAlign: 'right', color: entry.isBanned ? 'var(--red)' : entry.suspensionEndsAt ? 'var(--amber)' : 'var(--green)' }}>
                    {entry.isBanned ? 'Banned' : entry.suspensionEndsAt ? 'Suspended' : 'Active'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => permanentBan(entry._id)}>Ban</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
