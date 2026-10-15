'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../lib/cart-context';
import { useAuth } from '../../lib/auth-context';
import { createOrder, validateCoupon } from '../../lib/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, freeShippingThreshold, clearCart } = useCart();
  const { user, token } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    payment_method: 'cod',
    notes: ''
  });

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');

  const shippingFee = subtotal >= freeShippingThreshold ? 0.00 : 49.00;
  const totalAmount = Math.max(0, subtotal - couponDiscount + shippingFee);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponError('');
    try {
      const res = await validateCoupon(couponCode.trim(), subtotal);
      if (res && res.discount_amount) {
        setCouponDiscount(parseFloat(res.discount_amount));
        setAppliedCoupon(res.code);
      }
    } catch (err) {
      setCouponError(err.message || 'Invalid coupon code');
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setOrderError('Your cart is empty.');
      return;
    }

    if (!formData.name || !formData.email || !formData.phone || !formData.address_line1 || !formData.city || !formData.postal_code) {
      setOrderError('Please fill in all required shipping address fields.');
      return;
    }

    setIsSubmitting(true);
    setOrderError('');

    try {
      const orderPayload = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        shipping_address: {
          line1: formData.address_line1,
          line2: formData.address_line2,
          city: formData.city,
          state: formData.state,
          postal_code: formData.postal_code
        },
        items: cart.map(item => ({
          product_id: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          size: item.size,
          color: item.color,
          image: item.image
        })),
        payment_method: formData.payment_method,
        coupon_code: appliedCoupon,
        notes: formData.notes
      };

      const res = await createOrder(orderPayload, token);
      clearCart();
      const orderNum = res?.order_number || res?.order_id || 'NP-CONFIRMED';
      router.push(`/order-success?order=${orderNum}`);
    } catch (err) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Your bag is empty</h2>
        <p style={{ marginTop: '12px', color: 'var(--muted)' }}>
          Explore our collections and add everyday essentials to continue.
        </p>
        <Link href="/shop" className="btn" style={{ marginTop: '24px', display: 'inline-block' }}>
          Explore Collections →
        </Link>
      </div>
    );
  }

  return (
    <div className="checkout-page" style={{ padding: '40px 0 80px' }}>
      <div className="container">
        <h1 style={{ marginBottom: '32px' }}>Checkout</h1>

        <form onSubmit={handleSubmitOrder} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'start' }}>
          {/* Left Column: Delivery Details */}
          <div className="checkout-form-column">
            <h2 style={{ fontSize: '20px', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid var(--line)' }}>
              1. Delivery Information
            </h2>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lokesh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Apartment, building, street address"
                  value={formData.address_line1}
                  onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Apartment, suite, landmark (optional)
                </label>
                <input
                  type="text"
                  placeholder="Suite, floor, landmark"
                  value={formData.address_line2}
                  onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Bengaluru"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Karnataka"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="560001"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
                  />
                </div>
              </div>
            </div>

            <h2 style={{ fontSize: '20px', marginTop: '36px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--line)' }}>
              2. Payment Method
            </h2>

            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payment_method"
                  value="cod"
                  checked={formData.payment_method === 'cod'}
                  onChange={() => setFormData({ ...formData, payment_method: 'cod' })}
                />
                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Pay comfortably when your package arrives at your door.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '1px solid var(--line)', borderRadius: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="payment_method"
                  value="card"
                  checked={formData.payment_method === 'card'}
                  onChange={() => setFormData({ ...formData, payment_method: 'card' })}
                />
                <div>
                  <strong>UPI / Credit & Debit Card / NetBanking</strong>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Fast and encrypted checkout via Razorpay / Card gateway.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="checkout-summary-column" style={{ background: 'var(--surface-soft)', padding: '28px', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Order Summary ({cart.length})</h2>

            <div style={{ display: 'grid', gap: '14px', marginBottom: '24px' }}>
              {cart.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <img src={item.image} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    <strong>{item.name}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                      Qty: {item.qty} {item.size && `· ${item.size}`} {item.color && `· ${item.color}`}
                    </div>
                  </div>
                  <strong style={{ fontSize: '14px' }}>₹{(item.price * item.qty).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {/* Promo Code Input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Discount code (e.g. WELCOME10)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--line)' }}
              />
              <button
                type="button"
                className="btn btn--outline"
                style={{ padding: '10px 16px', fontSize: '13px' }}
                onClick={handleApplyCoupon}
              >
                Apply
              </button>
            </div>
            {couponError && <p style={{ color: 'var(--brand-red)', fontSize: '12px', marginBottom: '12px' }}>{couponError}</p>}
            {appliedCoupon && <p style={{ color: 'var(--brand-green)', fontSize: '12px', marginBottom: '12px' }}>Coupon &apos;{appliedCoupon}&apos; applied (-₹{couponDiscount.toFixed(2)})</p>}

            {/* Price Calculations */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', display: 'grid', gap: '8px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand-green)' }}>
                  <span>Discount</span>
                  <span>−₹{couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shipping</span>
                <span>{shippingFee === 0 ? <strong style={{ color: 'var(--brand-green)' }}>FREE</strong> : `₹${shippingFee.toFixed(2)}`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: '12px', fontSize: '18px', fontWeight: 700 }}>
                <span>Total</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {orderError && (
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(237, 28, 42, 0.1)', color: 'var(--brand-red)', borderRadius: '8px', fontSize: '13px' }}>
                {orderError}
              </div>
            )}

            <button
              type="submit"
              className="btn"
              disabled={isSubmitting}
              style={{ width: '100%', marginTop: '24px', padding: '16px' }}
            >
              {isSubmitting ? 'Placing Order...' : `Place Order · ₹${totalAmount.toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

