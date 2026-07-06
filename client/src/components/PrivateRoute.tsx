import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Protects routes that require authentication.
 *
 * - While auth context is initialising (`isLoading`), renders nothing.
 * - If no authenticated user, redirects to `/login`.
 * - Otherwise renders the matched child route via `<Outlet />`.
 *
 * Requirements: 14.2
 */
export default function PrivateRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
