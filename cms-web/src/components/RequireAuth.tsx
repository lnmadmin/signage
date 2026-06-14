import { Navigate, Outlet } from 'react-router-dom';
import { auth } from '../auth/auth';

export function RequireAuth() {
  if (!auth.isAuthenticated()) return <Navigate to="/login" replace />;
  return <Outlet />;
}
