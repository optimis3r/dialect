import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../utils/api';
import { clearStoredToken, getStoredToken, storeToken } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then((response) => setUser(response.data.user))
      .catch(() => clearStoredToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (identifier, password, rememberMe = true) => {
    const response = await api.post('/auth/login', { identifier, password });
    storeToken(response.data.token, rememberMe);
    setUser(response.data.user);
    setVerification(response.data.verificationRequired ? {
      email: response.data.user.email,
      code: response.data.verificationCode || ''
    } : null);
    return response.data.user;
  }, []);

  const register = useCallback(async (payload, rememberMe = true) => {
    const response = await api.post('/auth/register', payload);
    storeToken(response.data.token, rememberMe);
    setUser(response.data.user);
    setVerification(response.data.verificationRequired ? {
      email: payload.email,
      code: response.data.verificationCode || ''
    } : null);
    return response.data.user;
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setVerification(null);
  }, []);

  const updateMode = useCallback(async (mode) => {
    const response = await api.patch('/auth/mode', { mode });
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const response = await api.patch('/auth/profile', payload);
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const verifyEmail = useCallback(async (email, code) => {
    const response = await api.post('/auth/verify-email', { email, code });
    setVerification(null);
    await refreshUser();
    return response.data;
  }, [refreshUser]);

  const resendVerification = useCallback(async (email) => {
    const response = await api.post('/auth/resend-verification', { email });
    setVerification({ email, code: response.data.verificationCode || '' });
    return response.data;
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      verification,
      login,
      register,
      logout,
      updateMode,
      refreshUser,
      updateProfile,
      verifyEmail,
      resendVerification
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
