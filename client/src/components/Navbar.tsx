import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={s.nav} role="navigation" aria-label="Navegación principal">
      <Link to="/" style={s.brand}>
        <span style={s.brandIcon}>⚡</span> QueryArena
      </Link>

      <div style={s.links}>
        {user ? (
          <>
            <Link to="/exercises" style={s.link}>Ejercicios</Link>
            <Link to="/history" style={s.link}>Historial</Link>
            <Link to="/ranking" style={s.link}>Ranking</Link>
            <Link to="/dashboard" style={s.link}>Dashboard</Link>

            {user.role === 'admin' && (
              <>
                <span style={s.divider}>|</span>
                <Link to="/admin/levels" style={s.linkAdmin}>Niveles</Link>
                <Link to="/admin/categories" style={s.linkAdmin}>Categorías</Link>
                <Link to="/admin/exercises" style={s.linkAdmin}>Ejercicios</Link>
              </>
            )}

            <span style={s.divider}>|</span>
            <Link to="/profile" style={s.linkMuted}>{user.username}</Link>
            <button onClick={logout} style={s.logoutBtn}>Salir</button>
          </>
        ) : (
          <>
            <Link to="/login" style={s.link}>Iniciar sesión</Link>
            <Link to="/register" style={s.cta}>Registrarse</Link>
          </>
        )}
      </div>
    </nav>
  );
}

const s: Record<string, React.CSSProperties> = {
  nav: {
    alignItems: 'center',
    background: 'linear-gradient(90deg, #1e40af 0%, #4f46e5 100%)',
    boxShadow: '0 2px 8px rgba(79,70,229,0.3)',
    display: 'flex',
    gap: '0.25rem',
    justifyContent: 'space-between',
    padding: '0 1.5rem',
    height: '56px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '0.02em',
    textDecoration: 'none',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  brandIcon: {
    fontSize: '1.2rem',
  },
  links: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.1rem',
  },
  link: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '0.3rem 0.65rem',
    borderRadius: '4px',
    textDecoration: 'none',
  },
  linkAdmin: {
    color: '#fde68a',
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '0.3rem 0.65rem',
    borderRadius: '4px',
    textDecoration: 'none',
  },
  linkMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.875rem',
    padding: '0.3rem 0.65rem',
    textDecoration: 'none',
    fontStyle: 'italic',
  },
  divider: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: '0.75rem',
    padding: '0 0.25rem',
  },
  cta: {
    backgroundColor: '#fff',
    color: '#4f46e5',
    fontSize: '0.875rem',
    fontWeight: 700,
    padding: '0.3rem 0.9rem',
    borderRadius: '4px',
    textDecoration: 'none',
    marginLeft: '0.25rem',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
    padding: '0.25rem 0.65rem',
    marginLeft: '0.25rem',
  },
};
