import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Lobby', path: '/lobby' },
  { label: 'Leaderboard', path: '/leaderboard' },
  { label: 'History', path: '/history' },
];

function ConnDot({ connected }) {
  return (
    <div
      title={connected ? 'Connected' : 'Disconnected'}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: connected ? 'var(--green)' : 'var(--red)',
        boxShadow: connected ? '0 0 10px var(--green)' : 'none',
      }}
    />
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="site-nav">
      <div className="container">
        <div className="site-nav__inner">
          <Link to="/dashboard" className="site-nav__brand">
            <span className="site-nav__wordmark">
              DIAL<span style={{ color: 'var(--accent)' }}>ECT</span>
            </span>
          </Link>

          <div className="site-nav__links">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`site-nav__link ${active ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="site-nav__right">
            <Link
              to="/profile"
              className="site-nav__profile"
              style={{ borderColor: pathname === '/profile' ? 'var(--border2)' : undefined }}
            >
              <ConnDot connected={connected} />
              <div>
                <div className="site-nav__profile-name">
                  {user?.mode === 'ghost' ? user?.ghostAlias : user?.username}
                </div>
                <div className="site-nav__profile-meta">
                  {connected ? 'Live connection active' : 'Realtime offline'} / {user?.eloRating} ELO
                </div>
              </div>
            </Link>

            <span className={`badge ${user?.mode === 'ghost' ? 'badge-amber' : 'badge-green'}`}>
              {user?.mode === 'ghost' ? 'Ghost Mode' : 'Public Mode'}
            </span>

            {user?.role === 'admin' && (
              <Link to="/admin" className="badge badge-amber">
                Admin
              </Link>
            )}

            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
