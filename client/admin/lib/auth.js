'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAdminToken, setAdminToken, removeAdminToken, loginAdmin } from './api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    const storedUser = localStorage.getItem('npgrand_admin_user');

    if (token && storedUser) {
      try {
        setAdminUser(JSON.parse(storedUser));
      } catch (e) {
        removeAdminToken();
      }
    } else if (pathname !== '/login') {
      router.push('/login');
    }
    setLoading(false);
  }, [pathname, router]);

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
        logout
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

