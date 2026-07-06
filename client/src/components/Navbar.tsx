import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav style={s.nav} role="navigation" aria-label="Main navigation">
      <Link to="/" style={s.brand}>QueryArena</Link>

      <div style={s.links}>
        {user ? (
          <>
            <Link to="/exercises" style={s.link}>Exercises</Link>
            <Link to="/history" style={s.link}>History</Link>
            <Link to="/ranking" style={s.link}>Ranking</Link>
            <Link to="/dashboard" style={s.link}>Dashboard</Link>

            {user.role === 'admin' && (
              <>
                <span style={s.divider}>|</span>
                <Link to="/admin/levels" style={s.linkAdmin}>Levels</Link>
                <Link to="/admin/categories" style={s.linkAdmin}>Categories</Link>
                <Link to="/admin/exercises" style={s.linkAdmin}>Exercises</Link>
              </>
            )}

            <span style={s.divider}>|</span>
            <Link to="/profile" style={s.linkMuted}>{user.username}</Link>
            <button onClick={handleLogout} style={s.logoutBtn}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login" style={s.link}>Sign in</Link>
            <Link to="/register" style={s.cta}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav: {
    alignItems: 'center',
    backgroundColor: '#0f1117',
    borderBottom: '1px solid #1e2130',
    display: 'flex',
    gap: '0.25rem',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: '52px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    color: '#e2e4ec',
    fontSize: '1rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    flexShrink: 0,
  },
  links: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.1rem',
  },
  link: {
    color: '#8b8fa8',
    fontSize: '0.875rem',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  linkAdmin: {
    color: '#a78bfa',
    fontSize: '0.875rem',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    textDecoration: 'none',
  },
  linkMuted: {
    color: '#6366f1',
    fontSize: '0.875rem',
    padding: '0.3rem 0.6rem',
    textDecoration: 'none',
  },
  divider: {
    color: '#2a2d3a',
    fontSize: '0.75rem',
    padding: '0 0.25rem',
  },
  cta: {
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 600,
    padding: '0.3rem 0.85rem',
    borderRadius: '4px',
    textDecoration: 'none',
    marginLeft: '0.25rem',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #2a2d3a',
    borderRadius: '4px',
    color: '#8b8fa8',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '0.25rem 0.6rem',
    marginLeft: '0.25rem',
  },
};
