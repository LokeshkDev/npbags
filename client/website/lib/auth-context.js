'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getMyProfile } from './api';

const AuthContext = createContext(null);

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return !!payload.exp && payload.exp * 1000 <= Date.now();
  } catch (e) {
    return false;
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem('storefront_token');
    localStorage.removeItem('storefront_user');
  } catch (e) {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let savedToken = null;
    let savedUser = null;
    try {
      savedToken = localStorage.getItem('storefront_token');
      savedUser = localStorage.getItem('storefront_user');
    } catch (e) {}

    if (!savedToken) {
      setLoading(false);
      return;
    }

    // Skip the network round-trip (and the resulting 401) for expired tokens.
    if (isTokenExpired(savedToken)) {
      clearStoredSession();
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let cachedUser = null;
    try {
      cachedUser = savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {}

    // Verify the token BEFORE exposing the session, so protected pages
    // don't fire authenticated requests with a stale/invalid token.
    getMyProfile(savedToken)
      .then(data => {
        const profile = (data && data.user) || cachedUser;
        setToken(savedToken);
        setUser(profile);
        if (profile) {
          try {
            localStorage.setItem('storefront_user', JSON.stringify(profile));
          } catch (e) {}
        }
      })
      .catch(error => {
        if (error && (error.status === 401 || error.status === 403)) {
          // Expired/invalid token – clear the stale session instead of
          // repeatedly hitting protected endpoints that return 401.
          clearStoredSession();
          setToken(null);
          setUser(null);
        } else {
          // Backend/network hiccup – keep the cached session usable.
          setToken(savedToken);
          setUser(cachedUser);
        }
      })
      .finally(() => setLoading(false));
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

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    try {
      localStorage.setItem('storefront_user', JSON.stringify(updatedUser));
    } catch (e) {}
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
        logout,
        updateUser
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

