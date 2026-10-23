'use client';

import React, { Suspense } from 'react';
import OrderSuccessPage from '../order-success/page';

export default function OrderFailedPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>Loading order status...</div>}>
      <OrderSuccessPage />
    </Suspense>
  );
}

