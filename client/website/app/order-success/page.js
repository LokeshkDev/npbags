'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../../components/common/Icons';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || 'NP-ORD-CONFIRMED';

  return (
    <div className="order-success-page" style={{ padding: '80px 20px', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(8, 166, 83, 0.1)', color: 'var(--brand-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Icon name="check" size={32} />
        </div>

        <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Thank you for your order!</h1>
        <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          Your order has been received and is being prepared with thoughtful care.
        </p>

        <div style={{ background: 'var(--surface-soft)', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '32px', textAlign: 'left' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Order Reference</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>{orderNumber}</div>
          <div style={{ marginTop: '16px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
            A confirmation receipt with your dispatch notification and live tracking link will be sent to your email address shortly.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/shop" className="btn">
            Continue Shopping →
          </Link>
          <Link href="/account" className="btn btn--outline">
            View My Orders
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>Loading receipt...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}

