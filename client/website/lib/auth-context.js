'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMyProfile } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('storefront_token');
      const savedUser = localStorage.getItem('storefront_user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Verify with backend
        getMyProfile(savedToken)
          .then(data => {
            if (data && data.user) {
              setUser(data.user);
              localStorage.setItem('storefront_user', JSON.stringify(data.user));
            }
          })
          .catch(() => {});
      }
    } catch (e) {}
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    if (res && res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('storefront_token', res.token);
      localStorage.setItem('storefront_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await registerUser(userData);
    if (res && res.token && res.user) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('storefront_token', res.token);
      localStorage.setItem('storefront_user', JSON.stringify(res.user));
      return res.user;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('storefront_token');
    localStorage.removeItem('storefront_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

