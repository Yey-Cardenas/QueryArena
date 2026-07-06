import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protects routes that require the `admin` role.
 *
 * - While auth context is initialising (`isLoading`), renders nothing.
 * - If no authenticated user, redirects to `/login`.
 * - If the user is authenticated but not an admin, shows an inline 403 message.
 * - Otherwise renders the matched child route via `<Outlet />`.
 *
 * Requirements: 14.3
 */
export default function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== 'admin') {
    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h1 style={styles.heading}>403 — Access Forbidden</h1>
          <p style={styles.message}>
            You do not have permission to view this page.
          </p>
          <a href="/" style={styles.link}>
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    maxWidth: '480px',
    padding: '2rem',
    textAlign: 'center',
    width: '100%',
  },
  heading: {
    color: '#dc2626',
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.75rem',
  },
  message: {
    color: '#dc2626',
    fontSize: '0.95rem',
    margin: '0 0 1.25rem',
  },
  link: {
    color: '#dc2626',
    fontSize: '0.9rem',
    textDecoration: 'underline',
  },
};
