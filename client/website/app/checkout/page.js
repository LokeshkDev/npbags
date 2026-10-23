'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../../lib/cart-context';
import { useAuth } from '../../lib/auth-context';
import { createOrder, validateCoupon, getUserAddresses, saveUserAddress } from '../../lib/api';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, freeShippingThreshold, clearCart } = useCart();
  const { user, token, loading: authLoading } = useAuth();

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

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/account?redirect=/checkout');
    }
  }, [authLoading, user, router]);

  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || ''
      }));
    }
    try {
      const savedAddr = localStorage.getItem('storefront_saved_address');
      if (savedAddr) {
        const parsed = JSON.parse(savedAddr);
        setFormData(prev => ({
          ...prev,
          address_line1: prev.address_line1 || parsed.line1 || '',
          address_line2: prev.address_line2 || parsed.line2 || '',
          city: prev.city || parsed.city || '',
          state: prev.state || parsed.state || '',
          postal_code: prev.postal_code || parsed.postal_code || ''
        }));
      }
    } catch (e) {}
  }, [user]);

  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Address Type selection: 'home', 'office', 'other'
  const [addressType, setAddressType] = useState('home');
  const [savedAddresses, setSavedAddresses] = useState({ home: null, office: null, other: null });
  const [saveThisAddress, setSaveThisAddress] = useState(true);
  const [addressToast, setAddressToast] = useState('');

  // Load saved multi-addresses (Home, Office, Other)
  React.useEffect(() => {
    try {
      const multi = localStorage.getItem('storefront_saved_addresses');
      let loaded = { home: null, office: null, other: null };
      if (multi) {
        loaded = { ...loaded, ...JSON.parse(multi) };
      }
      const single = localStorage.getItem('storefront_saved_address');
      if (single && !loaded.home) {
        loaded.home = JSON.parse(single);
      }
      setSavedAddresses(loaded);

      // Auto-fill from active type or first available
      const activeAddr = loaded.home || loaded.office || loaded.other;
      if (activeAddr) {
        const typeToSelect = loaded.home ? 'home' : loaded.office ? 'office' : 'other';
        setAddressType(typeToSelect);
        setFormData(prev => ({
          ...prev,
          address_line1: prev.address_line1 || activeAddr.line1 || activeAddr.address_line1 || '',
          address_line2: prev.address_line2 || activeAddr.line2 || activeAddr.address_line2 || '',
          city: prev.city || activeAddr.city || '',
          state: prev.state || activeAddr.state || '',
          postal_code: prev.postal_code || activeAddr.postal_code || ''
        }));
      }
    } catch (e) {}

    // Also fetch saved addresses from backend database if user is authenticated
    if (token) {
      getUserAddresses(token)
        .then(addrs => {
          if (Array.isArray(addrs) && addrs.length > 0) {
            setSavedAddresses(prev => {
              const next = { ...prev };
              addrs.forEach(a => {
                const type = (a.address_type || 'home').toLowerCase();
                const key = type === 'office' ? 'office' : type === 'other' ? 'other' : 'home';
                next[key] = {
                  line1: a.address_line1 || a.line1 || '',
                  line2: a.address_line2 || a.line2 || '',
                  city: a.city || '',
                  state: a.state || '',
                  postal_code: a.postal_code || ''
                };
              });
              try {
                localStorage.setItem('storefront_saved_addresses', JSON.stringify(next));
                const def = next.home || next.office || next.other;
                if (def) localStorage.setItem('storefront_saved_address', JSON.stringify(def));
              } catch (e) {}

              // Auto-fill if inputs are still blank
              const currentActive = next[addressType] || next.home || next.office || next.other;
              if (currentActive) {
                setFormData(prev => ({
                  ...prev,
                  address_line1: prev.address_line1 || currentActive.line1 || '',
                  address_line2: prev.address_line2 || currentActive.line2 || '',
                  city: prev.city || currentActive.city || '',
                  state: prev.state || currentActive.state || '',
                  postal_code: prev.postal_code || currentActive.postal_code || ''
                }));
              }
              return next;
            });
          }
        })
        .catch(() => {});
    }
  }, [token]);

  const handleSelectAddressType = (type) => {
    setAddressType(type);
    const target = savedAddresses[type];
    if (target) {
      setFormData(prev => ({
        ...prev,
        address_line1: target.line1 || target.address_line1 || '',
        address_line2: target.line2 || target.address_line2 || '',
        city: target.city || '',
        state: target.state || '',
        postal_code: target.postal_code || ''
      }));
      setAddressToast(`Loaded saved ${type.toUpperCase()} address`);
      setTimeout(() => setAddressToast(''), 3000);
    } else {
      setAddressToast(`Enter address details for ${type.toUpperCase()}`);
      setTimeout(() => setAddressToast(''), 3000);
    }
  };

  const persistAddress = (type, currentForm) => {
    try {
      const newAddr = {
        line1: currentForm.address_line1,
        address_line1: currentForm.address_line1,
        line2: currentForm.address_line2,
        address_line2: currentForm.address_line2,
        city: currentForm.city,
        state: currentForm.state,
        postal_code: currentForm.postal_code,
        address_type: type
      };
      const updated = {
        ...savedAddresses,
        [type]: newAddr
      };
      setSavedAddresses(updated);
      localStorage.setItem('storefront_saved_addresses', JSON.stringify(updated));
      localStorage.setItem('storefront_saved_address', JSON.stringify(newAddr));

      if (token) {
        saveUserAddress(newAddr, token).catch(() => {});
      }
    } catch (e) {}
  };

  const handleManualSaveAddress = (e) => {
    e.preventDefault();
    if (!formData.address_line1 || !formData.city || !formData.postal_code) {
      setAddressToast('Please fill in Street Address, City, and Postal Code first.');
      setTimeout(() => setAddressToast(''), 3500);
      return;
    }
    persistAddress(addressType, formData);
    setAddressToast(`✓ Saved as your default ${addressType.toUpperCase()} address!`);
    setTimeout(() => setAddressToast(''), 4000);
  };

  if (authLoading || !user) {
    return (
      <div className="container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #e0ddd7', borderTopColor: 'var(--brand-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '20px' }} />
        <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--brand-green)' }}>Please sign in to proceed to checkout</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>Redirecting to secure login portal...</p>
      </div>
    );
  }

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

    if (saveThisAddress) {
      persistAddress(addressType, formData);
    }

    setIsSubmitting(true);
    setOrderError('');

    try {
      const orderPayload = {
        customer_name: formData.name,
        customer_email: formData.email,
        customer_phone: formData.phone,
        shipping_address: {
          address_type: addressType,
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
            <h2 style={{ fontSize: '20px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--line)' }}>
              1. Delivery Information
            </h2>

            {/* Address Type Selector: Home, Office, Others */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Deliver to:</span>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>Choose address type</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSelectAddressType('home')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: addressType === 'home' ? '2px solid #065935' : '1px solid #dcd7ce',
                    background: addressType === 'home' ? '#edf7f0' : '#ffffff',
                    color: addressType === 'home' ? '#065935' : 'var(--ink)',
                    fontWeight: addressType === 'home' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>🏠</span>
                  <span>Home</span>
                  <span style={{ fontSize: '10.5px', color: savedAddresses.home ? '#065935' : 'var(--muted)', fontWeight: savedAddresses.home ? 700 : 400 }}>
                    {savedAddresses.home ? '✓ Saved' : '+ Add'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAddressType('office')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: addressType === 'office' ? '2px solid #065935' : '1px solid #dcd7ce',
                    background: addressType === 'office' ? '#edf7f0' : '#ffffff',
                    color: addressType === 'office' ? '#065935' : 'var(--ink)',
                    fontWeight: addressType === 'office' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>🏢</span>
                  <span>Office</span>
                  <span style={{ fontSize: '10.5px', color: savedAddresses.office ? '#065935' : 'var(--muted)', fontWeight: savedAddresses.office ? 700 : 400 }}>
                    {savedAddresses.office ? '✓ Saved' : '+ Add'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAddressType('other')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: addressType === 'other' ? '2px solid #065935' : '1px solid #dcd7ce',
                    background: addressType === 'other' ? '#edf7f0' : '#ffffff',
                    color: addressType === 'other' ? '#065935' : 'var(--ink)',
                    fontWeight: addressType === 'other' ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>📍</span>
                  <span>Others</span>
                  <span style={{ fontSize: '10.5px', color: savedAddresses.other ? '#065935' : 'var(--muted)', fontWeight: savedAddresses.other ? 700 : 400 }}>
                    {savedAddresses.other ? '✓ Saved' : '+ Add'}
                  </span>
                </button>
              </div>

              {addressToast && (
                <div style={{
                  fontSize: '12.5px',
                  color: '#065935',
                  fontWeight: 600,
                  background: '#edf7f0',
                  border: '1px solid #c9ebd4',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginTop: '10px'
                }}>
                  {addressToast}
                </div>
              )}
            </div>

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

              {/* Save Address Options for Home, Office, Others */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginTop: '14px',
                padding: '12px 14px',
                background: '#fcfbf9',
                border: '1px solid #ebe6df',
                borderRadius: '8px'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ink)', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={saveThisAddress}
                    onChange={(e) => setSaveThisAddress(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#065935', width: '16px', height: '16px' }}
                  />
                  <span>Save as default <strong>{addressType.toUpperCase()}</strong> address</span>
                </label>
                <button
                  type="button"
                  onClick={handleManualSaveAddress}
                  style={{
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#043e24'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#065935'}
                >
                  Save Address
                </button>
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
                  <img
                    src={item.image || item.primary_image || '/assets/bestsellers/best-handbag.png'}
                    alt={item.name}
                    onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                    style={{ width: '56px', height: '64px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e5e2db', background: '#f8f8f8', flexShrink: 0 }}
                  />
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

