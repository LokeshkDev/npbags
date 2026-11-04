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
      }
    } catch (e) {
      console.warn('Could not refresh admin user profile:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    const token = getAdminToken();
    const storedUser = localStorage.getItem('npgrand_admin_user');

    if (token) {
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          setAdminUser(user);

          // Menu route guard for restricted branch users
          if (user.role !== 'admin' && pathname !== '/login' && pathname !== '/dashboard') {
            if (pathname.startsWith('/branches') || pathname.startsWith('/settings')) {
              router.push('/dashboard');
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
                router.push('/dashboard');
              }
            }
          }
        } catch (e) {
          removeAdminToken();
        }
      }
      // Always pull live permissions from server on mount/transition to reflect permission edits instantly
      refreshProfile();
    } else if (pathname !== '/login') {
      router.push('/login');
    }
    setLoading(false);
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
      adminUser: { name: 'Administrator', role: 'admin' },
      isAuthenticated: true,
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

