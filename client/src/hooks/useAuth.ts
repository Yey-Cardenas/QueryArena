import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '../contexts/AuthContext';

/**
 * Returns the current authentication context value.
 * Must be used inside an <AuthProvider> — throws otherwise.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
