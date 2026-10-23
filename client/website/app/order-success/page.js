'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../../components/common/Icons';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order') || 'NP-ORD-CONFIRMED';
  const isFailedParam = searchParams.get('status') === 'failed';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNumber || orderNumber === 'NP-ORD-CONFIRMED') {
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/api/orders/${encodeURIComponent(orderNumber)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.data) {
          setOrder(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderNumber]);

  const isFailed = isFailedParam || (order && (order.payment_status === 'failed' || order.order_status === 'cancelled'));

  return (
    <div className="order-success-page" style={{ padding: '60px 20px', background: 'var(--surface)' }}>
      <div className="container" style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Header Status Card */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: isFailed ? 'rgba(200, 16, 46, 0.1)' : 'rgba(6, 89, 53, 0.1)',
            color: isFailed ? 'var(--brand-red)' : '#065935',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '28px'
          }}>
            {isFailed ? '✕' : <Icon name="check" size={32} />}
          </div>

          <h1 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>
            {isFailed ? 'Order / Payment Failed' : 'Thank You for Your Order!'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto' }}>
            {isFailed
              ? 'We could not complete your payment transaction. Please try again or choose an alternative payment method.'
              : 'Your order has been placed successfully and is being prepared with thoughtful care.'}
          </p>
        </div>

        {/* Reference Banner */}
        <div style={{
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #ebe6df',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Order Reference
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
              {order?.order_number || orderNumber}
            </div>
          </div>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '5px 12px',
            borderRadius: '16px',
            background: isFailed ? '#fdeced' : '#edf7f0',
            color: isFailed ? '#c8102e' : '#065935',
            border: isFailed ? '1px solid #fad2d6' : '1px solid #c9ebd4'
          }}>
            {isFailed ? 'Payment Failed' : (order?.order_status || 'Order Confirmed')}
          </span>
        </div>

        {/* Ordered Items with Product Primary Images */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #ebe6df',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          overflow: 'hidden',
          marginBottom: '28px'
        }}>
          <div style={{
            padding: '16px 24px',
            background: '#faf8f5',
            borderBottom: '1px solid #ebe6df',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Ordered Items {order?.items?.length ? `(${order.items.length})` : ''}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {order?.payment_method ? `Method: ${order.payment_method.toUpperCase()}` : ''}
            </span>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                Loading ordered products...
              </div>
            ) : order?.items && order.items.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {order.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      paddingBottom: idx !== order.items.length - 1 ? '16px' : '0',
                      borderBottom: idx !== order.items.length - 1 ? '1px dashed #eee' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <img
                        src={item.image_url || item.image || '/assets/bestsellers/best-handbag.png'}
                        alt={item.product_name}
                        onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                        style={{
                          width: '64px',
                          height: '76px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #ebe6df',
                          background: '#f8f8f8',
                          flexShrink: 0
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginBottom: '4px' }}>
                          {item.product_name}
                        </div>
                        {item.variant_info && (
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                            {item.variant_info}
                          </div>
                        )}
                        <div style={{ fontSize: '12.5px', color: '#666' }}>
                          Qty: <strong>{item.quantity}</strong> × ₹{parseFloat(item.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <strong style={{ fontSize: '15px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      ₹{parseFloat(item.total).toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)', fontSize: '13.5px' }}>
                Confirmation details and digital dispatch receipt have been processed.
              </div>
            )}

            {/* Bill Summary */}
            {order && (
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #ebe6df',
                display: 'grid',
                gap: '8px',
                fontSize: '13.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                  <span>Subtotal</span>
                  <span>₹{parseFloat(order.subtotal || 0).toFixed(2)}</span>
                </div>
                {parseFloat(order.discount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#065935' }}>
                    <span>Coupon Discount</span>
                    <span>−₹{parseFloat(order.discount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                  <span>Shipping Fee</span>
                  <span>
                    {parseFloat(order.shipping_fee || 0) === 0 ? (
                      <span style={{ color: '#065935', fontWeight: 600 }}>FREE</span>
                    ) : (
                      `₹${parseFloat(order.shipping_fee).toFixed(2)}`
                    )}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: 'var(--ink)',
                  paddingTop: '8px',
                  borderTop: '1px solid #eee'
                }}>
                  <span>Total Paid / Payable</span>
                  <span style={{ color: isFailed ? '#c8102e' : '#065935' }}>
                    ₹{parseFloat(order.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isFailed ? (
            <>
              <Link href="/checkout" className="btn" style={{ background: '#c8102e', color: '#fff' }}>
                Retry Checkout ↺
              </Link>
              <Link href="/shop" className="btn btn--outline">
                Return to Shop
              </Link>
            </>
          ) : (
            <>
              <Link href="/shop" className="btn" style={{ background: '#065935', color: '#fff' }}>
                Continue Shopping →
              </Link>
              <Link href="/account" className="btn btn--outline">
                View My Orders
              </Link>
            </>
          )}
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
