'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAdminToken, setAdminToken, removeAdminToken, loginAdmin } from './api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Re-fetch current user profile and live allowed_menus permissions from database
  const refreshProfile = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        const fresh = json?.data?.user || json?.user;
        if (fresh) {
          setAdminUser(fresh);
          localStorage.setItem('npgrand_admin_user', JSON.stringify(fresh));
          return fresh;
        }
      } else if (res.status === 401) {
        removeAdminToken();
        setAdminUser(null);
        if (pathname !== '/login') {
          router.push('/login?expired=1');
        }
        return null;
      }
    } catch (e) {
      console.warn('Could not refresh admin user profile:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    const token = getAdminToken();
    const storedUser = localStorage.getItem('npgrand_admin_user');

    if (!token) {
      setAdminUser(null);
      setLoading(false);
      if (pathname !== '/login') {
        router.replace('/login');
      }
      return;
    }

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAdminUser(user);

        // Menu route guard for restricted branch users
        if (user.role !== 'admin' && pathname !== '/login' && pathname !== '/dashboard') {
          if (pathname.startsWith('/branches') || pathname.startsWith('/settings')) {
            router.replace('/dashboard');
          } else if (Array.isArray(user.allowed_menus) && user.allowed_menus.length > 0) {
            const routeKeyMap = {
              '/pos': 'pos',
              '/orders': 'orders',
              '/inventory': 'inventory',
              '/products': 'products',
              '/categories': 'categories',
              '/barcodes': 'barcodes',
              '/customers': 'customers',
              '/salespersons': 'salespersons',
              '/vendors': 'vendors',
              '/audit-logs': 'audit_logs',
              '/cms': 'cms'
            };
            const matchedKey = Object.keys(routeKeyMap).find(k => pathname.startsWith(k));
            if (matchedKey && !user.allowed_menus.includes(routeKeyMap[matchedKey])) {
              router.replace('/dashboard');
            }
          }
        }
      } catch (e) {
        removeAdminToken();
        setAdminUser(null);
        if (pathname !== '/login') {
          router.replace('/login');
        }
        setLoading(false);
        return;
      }
    }
    // Always pull live permissions from server on mount/transition to reflect permission edits instantly
    refreshProfile().finally(() => setLoading(false));
  }, [pathname, router, refreshProfile]);

  // Real-time synchronization across tabs and when user permissions are updated
  useEffect(() => {
    const handleUserUpdate = (e) => {
      if (e?.detail) {
        setAdminUser(e.detail);
        localStorage.setItem('npgrand_admin_user', JSON.stringify(e.detail));
      } else {
        refreshProfile();
      }
    };
    window.addEventListener('np_user_updated', handleUserUpdate);
    window.addEventListener('storage', handleUserUpdate);
    return () => {
      window.removeEventListener('np_user_updated', handleUserUpdate);
      window.removeEventListener('storage', handleUserUpdate);
    };
  }, [refreshProfile]);

  const login = async (email, password) => {
    const res = await loginAdmin(email, password);
    if (res && res.token && res.user) {
      setAdminToken(res.token);
      setAdminUser(res.user);
      localStorage.setItem('npgrand_admin_user', JSON.stringify(res.user));
      router.push('/dashboard');
      return res.user;
    }
    throw new Error('Admin authentication failed');
  };

  const logout = () => {
    removeAdminToken();
    setAdminUser(null);
    router.push('/login');
  };

  // If not on login page, do not render children until authentication is verified!
  if (pathname !== '/login' && (loading || !adminUser)) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, sans-serif)'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          border: '3px solid rgba(255, 255, 255, 0.15)',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'adminSpin 0.75s linear infinite',
          marginBottom: '16px'
        }} />
        <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', color: '#94a3b8' }}>
          Verifying security access...
        </span>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isAuthenticated: !!adminUser,
        loading,
        login,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    return {
      adminUser: null,
      isAuthenticated: false,
      loading: false,
      login: async () => {},
      logout: () => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    };
  }
  return ctx;
}

