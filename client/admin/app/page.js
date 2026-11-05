'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../lib/api';

export default function AdminRootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAdminToken();
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return null;
}
