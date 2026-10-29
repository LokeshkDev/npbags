'use client';

import React from 'react';
import { AdminAuthProvider } from '../lib/auth';
import { SidebarProvider } from '../lib/sidebar-context';
import { POSModalProvider } from '../lib/pos-modal-context';
import { POSBillingModal } from './POSBillingModal';

export function AdminProviders({ children }) {
  return (
    <AdminAuthProvider>
      <SidebarProvider>
        <POSModalProvider>
          {children}
          <POSBillingModal />
        </POSModalProvider>
      </SidebarProvider>
    </AdminAuthProvider>
  );
}

export default AdminProviders;
