import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectToken } from '../../store/slices/authSlice';
import useLocalStorage from '../../hooks/useLocalStorage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticatedFromStore = useSelector(selectIsAuthenticated);
  const tokenFromStore = useSelector(selectToken);
  const [tokenFromLocalStorage] = useLocalStorage<string>('token', '');

  const isAuthenticated = isAuthenticatedFromStore || 
    !!(tokenFromLocalStorage && typeof tokenFromLocalStorage === 'string' && tokenFromLocalStorage.trim()) || 
    !!(tokenFromStore && tokenFromStore.trim());

  if (!isAuthenticated) {
    return <Navigate to="/passport/identify" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;