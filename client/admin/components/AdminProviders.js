'use client';

import React from 'react';
import { AdminAuthProvider } from '../lib/auth';
import { SidebarProvider } from '../lib/sidebar-context';

export function AdminProviders({ children }) {
  return (
    <AdminAuthProvider>
      <SidebarProvider>
        {children}
      </SidebarProvider>
    </AdminAuthProvider>
  );
}

export default AdminProviders;

