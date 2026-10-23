'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { updateMyProfile, getMyOrders, getUserAddresses, saveUserAddress } from '../../lib/api';

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect') || '';
  const fromCheckout = redirectParam === '/checkout';

  const { user, token, isAuthenticated, login, register, logout, updateUser } = useAuth();

  // Auth form states
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile dashboard states
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'profile', 'address'
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Edit profile form states
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Saved address states (Home, Office, Other)
  const [profileAddressType, setProfileAddressType] = useState('home');
  const [multiSavedAddresses, setMultiSavedAddresses] = useState({ home: null, office: null, other: null });
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressSavedMsg, setAddressSavedMsg] = useState('');

  // Initialize profile values when user loads
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
    }
  }, [user]);

  // Load saved address from localStorage and fetch orders + backend addresses
  useEffect(() => {
    // 1. Initial load from localStorage
    let loaded = { home: null, office: null, other: null };
    try {
      const multi = localStorage.getItem('storefront_saved_addresses');
      if (multi) {
        loaded = { ...loaded, ...JSON.parse(multi) };
      }
      const single = localStorage.getItem('storefront_saved_address');
      if (single && !loaded.home) {
        loaded.home = JSON.parse(single);
      }
      setMultiSavedAddresses(loaded);

      const def = loaded.home || loaded.office || loaded.other;
      if (def) {
        setAddressLine1(def.line1 || def.address_line1 || '');
        setAddressLine2(def.line2 || def.address_line2 || '');
        setCity(def.city || '');
        setState(def.state || '');
        setPostalCode(def.postal_code || '');
      }
    } catch (e) {}

    // 2. Fetch live user orders & sync addresses
    if (isAuthenticated && token) {
      setLoadingOrders(true);
      getMyOrders(token)
        .then(res => {
          const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.orders) ? res.orders : []));
          setOrders(list);

          // Pre-fill addresses from past orders if currently empty
          setMultiSavedAddresses(prev => {
            const next = { ...prev };
            list.forEach(ord => {
              if (ord.shipping_address) {
                const parsed = typeof ord.shipping_address === 'string' ? JSON.parse(ord.shipping_address) : ord.shipping_address;
                const type = (parsed.address_type || 'home').toLowerCase();
                const key = type === 'office' ? 'office' : type === 'other' ? 'other' : 'home';
                if (!next[key]) {
                  next[key] = {
                    line1: parsed.line1 || parsed.address_line1 || '',
                    line2: parsed.line2 || parsed.address_line2 || '',
                    city: parsed.city || '',
                    state: parsed.state || '',
                    postal_code: parsed.postal_code || ''
                  };
                }
              }
            });
            try {
              localStorage.setItem('storefront_saved_addresses', JSON.stringify(next));
              const def = next.home || next.office || next.other;
              if (def) localStorage.setItem('storefront_saved_address', JSON.stringify(def));
            } catch (e) {}

            // Pre-fill inputs if current inputs are blank
            const active = next.home || next.office || next.other;
            if (active && !addressLine1) {
              setAddressLine1(active.line1 || active.address_line1 || '');
              setAddressLine2(active.line2 || active.address_line2 || '');
              setCity(active.city || '');
              setState(active.state || '');
              setPostalCode(active.postal_code || '');
            }
            return next;
          });
        })
        .catch(() => {})
        .finally(() => setLoadingOrders(false));

      // 3. Fetch saved addresses from server database
      getUserAddresses(token)
        .then(addrs => {
          if (Array.isArray(addrs) && addrs.length > 0) {
            setMultiSavedAddresses(prev => {
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

              const active = next[profileAddressType] || next.home || next.office || next.other;
              if (active) {
                setAddressLine1(active.line1 || active.address_line1 || '');
                setAddressLine2(active.line2 || active.address_line2 || '');
                setCity(active.city || '');
                setState(active.state || '');
                setPostalCode(active.postal_code || '');
              }
              return next;
            });
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, token]);

  const handleSelectProfileAddressType = (type) => {
    setProfileAddressType(type);
    const target = multiSavedAddresses[type];
    if (target) {
      setAddressLine1(target.line1 || target.address_line1 || '');
      setAddressLine2(target.line2 || target.address_line2 || '');
      setCity(target.city || '');
      setState(target.state || '');
      setPostalCode(target.postal_code || '');
    } else {
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setState('');
      setPostalCode('');
    }
  };

  // Handle Address Save
  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    try {
      const addrData = {
        line1: addressLine1,
        address_line1: addressLine1,
        line2: addressLine2,
        address_line2: addressLine2,
        city,
        state,
        postal_code: postalCode,
        address_type: profileAddressType
      };
      const updated = {
        ...multiSavedAddresses,
        [profileAddressType]: addrData
      };
      setMultiSavedAddresses(updated);
      try {
        localStorage.setItem('storefront_saved_addresses', JSON.stringify(updated));
        localStorage.setItem('storefront_saved_address', JSON.stringify(addrData));
      } catch (e) {}

      if (token) {
        await saveUserAddress(addrData, token).catch(() => {});
      }

      setAddressSavedMsg(`Default ${profileAddressType.toUpperCase()} address saved! It will automatically pre-fill your checkout.`);
      setTimeout(() => setAddressSavedMsg(''), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Login or Register submit
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (mode === 'register' && (!phone || !phone.trim())) {
      setAuthError('Phone number is required.');
      return;
    }

    setAuthLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password, phone: phone.trim() });
      }

      // If redirect param exists (e.g. /checkout), redirect immediately
      if (redirectParam) {
        router.push(redirectParam);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    setProfileSaving(true);

    try {
      const res = await updateMyProfile({ name: profileName, phone: profilePhone }, token);
      if (res && res.data && res.data.user) {
        updateUser(res.data.user);
        setProfileSuccessMsg('Profile updated successfully!');
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      } else {
        setProfileSuccessMsg('Profile details saved.');
        setTimeout(() => setProfileSuccessMsg(''), 4000);
      }
    } catch (err) {
      setProfileErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // If user is logged in, show the brand-themed Customer Profile Dashboard
  if (isAuthenticated && user) {
    const userInitials = (user.name || 'U')
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const totalSpent = orders.reduce((sum, ord) => sum + (parseFloat(ord.total_amount) || 0), 0);

    return (
      <div className="account-page" style={{ backgroundColor: '#fcfbf9', minHeight: '85vh', padding: '40px 0 90px' }}>
        <div className="container" style={{ maxWidth: '1080px' }}>
          
          {/* Breadcrumb */}
          <nav style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }} aria-label="Breadcrumb">
            <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Home</Link>
            <span style={{ margin: '0 8px' }}>/</span>
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>My Account</span>
          </nav>

          {/* Checkout redirect notification if coming back */}
          {fromCheckout && (
            <div style={{
              background: '#eef8f1',
              border: '1px solid #c3e6cb',
              color: '#065935',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(6, 89, 53, 0.06)'
            }}>
              <div>
                <strong>You are signed in!</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px' }}>Ready to finish your order? Proceed directly to checkout.</p>
              </div>
              <Link href="/checkout" className="btn" style={{ background: '#065935', color: '#fff', padding: '10px 20px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                Go to Checkout →
              </Link>
            </div>
          )}

          {/* Profile Header Hero Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #ebe6df',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            padding: '28px 32px',
            marginBottom: '32px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #065935, #0a844f)',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '1px',
                boxShadow: '0 4px 12px rgba(6, 89, 53, 0.25)',
                border: '3px solid #ffffff'
              }}>
                {userInitials}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                    {user.name}
                  </h1>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 9px',
                    borderRadius: '20px',
                    background: '#edf7f0',
                    color: '#065935',
                    border: '1px solid #c9ebd4'
                  }}>
                    Verified Customer
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13.5px', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <span>✉ {user.email}</span>
                  {user.phone && <span>📞 {user.phone}</span>}
                </div>
              </div>
            </div>

            {/* Quick stats and Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right', borderRight: '1px solid #ebe6df', paddingRight: '20px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Orders</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#065935' }}>{orders.length}</div>
              </div>
              <div style={{ textAlign: 'right', borderRight: '1px solid #ebe6df', paddingRight: '20px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Spend</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand-red)' }}>₹{totalSpent.toFixed(0)}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #dcd7ce',
                  background: 'transparent',
                  color: '#666',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--brand-red)'; e.currentTarget.style.color = 'var(--brand-red)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#dcd7ce'; e.currentTarget.style.color = '#666'; }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid #ede8e0',
            marginBottom: '32px',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontSize: '14.5px',
                fontWeight: activeTab === 'orders' ? 700 : 500,
                color: activeTab === 'orders' ? '#065935' : '#6b7280',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'orders' ? '3px solid #065935' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>📦</span>
              <span>My Orders</span>
              <span style={{
                background: activeTab === 'orders' ? '#065935' : '#e5e2db',
                color: activeTab === 'orders' ? '#ffffff' : '#4b5563',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontSize: '14.5px',
                fontWeight: activeTab === 'profile' ? 700 : 500,
                color: activeTab === 'profile' ? '#065935' : '#6b7280',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'profile' ? '3px solid #065935' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>👤</span>
              <span>Profile Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('address')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                fontSize: '14.5px',
                fontWeight: activeTab === 'address' ? 700 : 500,
                color: activeTab === 'address' ? '#065935' : '#6b7280',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'address' ? '3px solid #065935' : '3px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>📍</span>
              <span>Delivery Addresses</span>
            </button>
          </div>

          {/* TAB 1: ORDERS LIST */}
          {activeTab === 'orders' && (
            <div>
              {loadingOrders ? (
                <div style={{ padding: '60px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid #ebe6df' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid #eee', borderTopColor: '#065935', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading your orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div style={{
                  background: '#ffffff',
                  padding: '50px 24px',
                  borderRadius: '16px',
                  border: '1px solid #ebe6df',
                  textAlign: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--ink)' }}>No orders placed yet</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 24px' }}>
                    Looks like you haven't bought anything yet. Explore our handcrafted sarees, shirts, and jewellery collections.
                  </p>
                  <Link href="/shop" className="btn" style={{ background: '#065935', color: '#fff', padding: '12px 28px', fontSize: '13px' }}>
                    Explore Storefront →
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {orders.map((order) => {
                    const status = (order.order_status || 'placed').toLowerCase();
                    const paymentStatus = (order.payment_status || '').toLowerCase();
                    const isDelivered = status === 'delivered';
                    const isCancelled = status === 'cancelled';
                    const isFailed = paymentStatus === 'failed' || isCancelled;
                    const isProcessing = status === 'processing' || status === 'shipped';

                    const badgeBg = isFailed ? '#fdeced' : isDelivered ? '#edf7f0' : isProcessing ? '#fef8eb' : '#edf3fa';
                    const badgeColor = isFailed ? '#c8102e' : isDelivered ? '#065935' : isProcessing ? '#b45309' : '#1d4ed8';
                    const displayStatus = isFailed ? (paymentStatus === 'failed' ? 'Payment Failed' : 'Cancelled') : (order.order_status || 'Placed');

                    return (
                      <div
                        key={order.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '14px',
                          border: isFailed ? '1px solid #fad2d6' : '1px solid #ebe6df',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Order Header */}
                        <div style={{
                          padding: '16px 24px',
                          background: isFailed ? '#fffafa' : '#faf8f5',
                          borderBottom: '1px solid #ebe6df',
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>
                                Order #{order.order_number || order.id}
                              </span>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                padding: '3px 10px',
                                borderRadius: '16px',
                                background: badgeBg,
                                color: badgeColor
                              }}>
                                {displayStatus}
                              </span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                              Placed on {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                              {order.payment_method && ` • Payment: ${order.payment_method.toUpperCase()}`}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11.5px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Amount</div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: isFailed ? '#c8102e' : '#065935' }}>
                              ₹{parseFloat(order.total_amount || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div style={{ padding: '20px 24px' }}>
                          {isFailed && (
                            <div style={{
                              background: '#fdeced',
                              border: '1px solid #fad2d6',
                              padding: '10px 16px',
                              borderRadius: '8px',
                              marginBottom: '16px',
                              fontSize: '13px',
                              color: '#c8102e',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '10px'
                            }}>
                              <span>⚠️ Payment was unsuccessful for this order. You can retry checkout anytime.</span>
                              <Link href="/checkout" style={{ background: '#c8102e', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                                Retry Checkout ↺
                              </Link>
                            </div>
                          )}

                          <div style={{ display: 'grid', gap: '14px' }}>
                            {(order.items || []).map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: idx !== (order.items.length - 1) ? '12px' : 0, borderBottom: idx !== (order.items.length - 1) ? '1px dashed #eee' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <img
                                    src={item.image_url || item.image || '/assets/bestsellers/best-handbag.png'}
                                    alt={item.product_name || item.name}
                                    onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                                    style={{ width: '48px', height: '56px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ebe6df', background: '#f5f5f5', flexShrink: 0 }}
                                  />
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>
                                      {item.product_name || item.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                      Qty: <strong>{item.quantity || item.qty}</strong> {item.size && `• Size: ${item.size}`} {item.color && `• Color: ${item.color}`} {item.variant_info && `• ${item.variant_info}`}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                                  ₹{parseFloat(item.total || ((item.price || 0) * (item.quantity || item.qty || 1))).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Shipping address summary */}
                          {order.shipping_address && (
                            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0ede8', fontSize: '12.5px', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                📍 Delivery to: <strong>{order.customer_name || user.name}</strong>, {typeof order.shipping_address === 'object' ? `${order.shipping_address.line1 || ''}, ${order.shipping_address.city || ''} ${order.shipping_address.postal_code || ''}` : order.shipping_address}
                              </div>
                              <Link href="/shop" style={{ color: '#065935', fontWeight: 600, textDecoration: 'none', fontSize: '12.5px' }}>
                                Buy Again →
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROFILE DETAILS FORM */}
          {activeTab === 'profile' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #ebe6df',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              padding: '32px',
              maxWidth: '640px'
            }}>
              <div style={{ marginBottom: '24px', borderBottom: '1px solid #f0ede8', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Personal Information</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '6px 0 0' }}>
                  Manage your personal profile details to keep your account up to date.
                </p>
              </div>

              {profileSuccessMsg && (
                <div style={{
                  background: '#edf7f0',
                  color: '#065935',
                  border: '1px solid #c9ebd4',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13.5px',
                  marginBottom: '20px'
                }}>
                  ✓ {profileSuccessMsg}
                </div>
              )}

              {profileErrorMsg && (
                <div style={{
                  background: '#fdeced',
                  color: '#c8102e',
                  border: '1px solid #f8c9cd',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13.5px',
                  marginBottom: '20px'
                }}>
                  ⚠ {profileErrorMsg}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} style={{ display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #dcd7ce',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#065935'}
                    onBlur={(e) => e.target.style.borderColor = '#dcd7ce'}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    Email Address <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '12px' }}>(Linked to account)</span>
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e5e2db',
                      background: '#f6f5f3',
                      fontSize: '14px',
                      color: '#666',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #dcd7ce',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#065935'}
                    onBlur={(e) => e.target.style.borderColor = '#dcd7ce'}
                  />
                </div>

                <div style={{ paddingTop: '8px' }}>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="btn"
                    style={{
                      background: '#065935',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: profileSaving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SAVED ADDRESS */}
          {activeTab === 'address' && (
            <div style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #ebe6df',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              padding: '32px',
              maxWidth: '640px'
            }}>
              <div style={{ marginBottom: '24px', borderBottom: '1px solid #f0ede8', paddingBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>Default Delivery Address</h2>
                <p style={{ fontSize: '13.5px', color: 'var(--muted)', margin: '6px 0 0' }}>
                  Save your primary delivery location for immediate 1-click checkout.
                </p>
              </div>

              {addressSavedMsg && (
                <div style={{
                  background: '#edf7f0',
                  color: '#065935',
                  border: '1px solid #c9ebd4',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13.5px',
                  marginBottom: '20px'
                }}>
                  ✓ {addressSavedMsg}
                </div>
              )}

              {/* Home, Office, Others Address Selector */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '22px' }}>
                {['home', 'office', 'other'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectProfileAddressType(type)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: profileAddressType === type ? '2px solid #065935' : '1px solid #dcd7ce',
                      background: profileAddressType === type ? '#edf7f0' : '#ffffff',
                      color: profileAddressType === type ? '#065935' : 'var(--ink)',
                      fontWeight: profileAddressType === type ? 700 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{type === 'home' ? '🏠' : type === 'office' ? '🏢' : '📍'}</span>
                    <span style={{ textTransform: 'capitalize' }}>{type === 'other' ? 'Others' : type}</span>
                    <span style={{ fontSize: '10.5px', color: multiSavedAddresses[type] ? '#065935' : 'var(--muted)', fontWeight: multiSavedAddresses[type] ? 700 : 400 }}>
                      {multiSavedAddresses[type] ? '✓ Saved' : '+ Empty'}
                    </span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddressSubmit} style={{ display: 'grid', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="House / Flat No., Building Name, Street"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #dcd7ce',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                    Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Landmark, Area, Sector"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #dcd7ce',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Coimbatore"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #dcd7ce',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tamil Nadu"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #dcd7ce',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
                      PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="641001"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid #dcd7ce',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div style={{ paddingTop: '8px' }}>
                  <button
                    type="submit"
                    className="btn"
                    style={{
                      background: '#065935',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 28px',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Save {profileAddressType.toUpperCase()} Address
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    );
  }

  // If NOT authenticated, show the brand-themed Sign In & Registration Portal
  return (
    <div className="account-login-page" style={{ backgroundColor: '#fcfbf9', minHeight: '80vh', padding: '60px 20px 100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '440px', width: '100%' }}>
        
        {fromCheckout && (
          <div style={{
            background: '#edf7f0',
            border: '1px solid #c9ebd4',
            color: '#065935',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '24px',
            fontSize: '13.5px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(6, 89, 53, 0.08)'
          }}>
            🔒 <strong>Sign in required</strong> to proceed with your checkout.
          </div>
        )}

        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #ebe6df',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
          padding: '36px 32px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, color: '#065935', marginBottom: '6px' }}>
              NP Grand Customer Portal
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
              {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
            </h1>
          </div>

          <div style={{ display: 'flex', borderBottom: '2px solid #f0ede8', marginBottom: '24px' }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: 'none',
                fontWeight: mode === 'login' ? 700 : 500,
                borderBottom: mode === 'login' ? '3px solid #065935' : '3px solid transparent',
                color: mode === 'login' ? '#065935' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '-2px',
                transition: 'all 0.2s ease'
              }}
              onClick={() => { setMode('login'); setAuthError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                background: 'none',
                fontWeight: mode === 'register' ? 700 : 500,
                borderBottom: mode === 'register' ? '3px solid #065935' : '3px solid transparent',
                color: mode === 'register' ? '#065935' : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '-2px',
                transition: 'all 0.2s ease'
              }}
              onClick={() => { setMode('register'); setAuthError(''); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'grid', gap: '16px' }}>
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lokesh Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="customer@npgrand.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                Password *
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {authError && (
              <div style={{ color: 'var(--brand-red)', fontSize: '13px', background: 'rgba(200, 16, 46, 0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(200, 16, 46, 0.2)' }}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="btn"
              disabled={authLoading}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '13px',
                background: '#065935',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: authLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {authLoading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #eee', borderTopColor: '#065935', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
