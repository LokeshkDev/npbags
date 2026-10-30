'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { usePOSModal } from '../../lib/pos-modal-context';
import { getAdminDashboardAnalytics, getAdminProductAgingAlerts } from '../../lib/api';

export default function AdminDashboardPage() {
  const { openPOS } = usePOSModal();

  // Timeframe filter state: 'today' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartMetric, setChartMetric] = useState('revenue'); // 'revenue' | 'orders'
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Aging alerts state (Products in stock > 60 days)
  const [agingData, setAgingData] = useState({
    summary: {
      total_aging_items: 0,
      slow_moving_count: 0,
      dead_stock_count: 0,
      total_tied_capital: 0
    },
    aging_products: []
  });
  const [loadingAging, setLoadingAging] = useState(false);
  const [agingFilter, setAgingFilter] = useState('all'); // 'all', '60_90', '90_plus'

  // Analytics data state
  const [data, setData] = useState({
    today: {
      total_sales: 0,
      total_orders: 0,
      online_sales: 0,
      online_orders: 0,
      pos_sales: 0,
      pos_orders: 0,
      pos_cash: 0,
      pos_upi: 0,
      aov: 0
    },
    period_totals: {
      total_sales: 0,
      total_orders: 0,
      online_sales: 0,
      online_orders: 0,
      pos_sales: 0,
      pos_orders: 0,
      pos_cash_sales: 0,
      pos_upi_sales: 0,
      pos_card_sales: 0,
      total_tax: 0,
      total_taxable: 0,
      aov: 0
    },
    chart_series: [],
    payment_methods: [],
    top_products: [],
    inventory_health: {
      total_active_products: 0,
      low_stock_count: 0,
      out_of_stock_count: 0
    },
    recent_feed: []
  });

  // Fetch telemetry from backend
  const fetchAnalytics = useCallback(() => {
    setLoading(true);
    const params = { period };
    if (period === 'custom' && startDate && endDate) {
      params.startDate = startDate;
      params.endDate = endDate;
    }

    getAdminDashboardAnalytics(params)
      .then(res => {
        if (res) {
          setData(res);
        }
      })
      .catch(err => {
        console.error('Failed to load dashboard analytics:', err);
      })
      .finally(() => setLoading(false));
  }, [period, startDate, endDate]);

  const fetchAgingAlerts = useCallback(() => {
    setLoadingAging(true);
    getAdminProductAgingAlerts({ minDays: 60 })
      .then(res => {
        if (res && res.summary) {
          setAgingData(res);
        }
      })
      .catch(err => {
        console.warn('Could not load product aging alerts:', err);
      })
      .finally(() => setLoadingAging(false));
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchAgingAlerts();
  }, [fetchAnalytics, fetchAgingAlerts]);

  // Real-time synchronization: refresh data whenever orders are placed or edited
  useEffect(() => {
    const handleOrderSync = () => {
      fetchAnalytics();
      fetchAgingAlerts();
    };
    window.addEventListener('np_order_updated', handleOrderSync);
    return () => window.removeEventListener('np_order_updated', handleOrderSync);
  }, [fetchAnalytics, fetchAgingAlerts]);

  // Chart computation helpers
  const chartMax = useMemo(() => {
    if (!data.chart_series || data.chart_series.length === 0) return 100;
    const maxVal = Math.max(
      ...data.chart_series.map(pt =>
        chartMetric === 'revenue'
          ? Math.max(pt.online_sales + pt.pos_sales, pt.total_sales, 1)
          : Math.max(pt.online_orders + pt.pos_orders, pt.total_orders, 1)
      ),
      1
    );
    return Math.ceil(maxVal * 1.15);
  }, [data.chart_series, chartMetric]);

  const formatCurrency = (num) => {
    return '₹' + Number(num || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'paid' || s === 'completed') return 'badge-success';
    if (s === 'shipped') return 'badge-info';
    if (s === 'cancelled' || s === 'refunded') return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Executive Overview" />

        <div className="admin-content" style={{ padding: '14px 18px', maxWidth: '1600px', margin: '0 12px' }}>

          {/* 1. TOP HEADER & TIMEFRAME FILTER BAR */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '22px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Store Executive Analytics
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '20px',
                    background: '#ecfdf5',
                    color: '#065935',
                    fontSize: '11px',
                    fontWeight: 800,
                    border: '1px solid #a7f3d0'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                  Live Omnichannel Telemetry
                </span>
              </div>
              <p style={{ color: '#64748b', fontSize: '12.5px', marginTop: '3px' }}>
                Real-time performance across Website Ecommerce &amp; In-Store POS Register
              </p>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openPOS()}
                style={{
                  background: '#065935',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '7px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(6, 89, 53, 0.25)'
                }}
              >
                <span>⚡</span>
                <span>OPEN POS BILLING [F2]</span>
              </button>

              <button
                type="button"
                onClick={fetchAnalytics}
                style={{
                  background: '#ffffff',
                  color: '#334155',
                  border: '1.5px solid #cbd5e1',
                  padding: '8px 14px',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Refresh live metrics"
              >
                {loading ? 'Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>
          </div>

          {/* 2. TIMEFRAME FILTERS CONTROL STRIP */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '12px 18px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Timeframe:
              </span>

              {[
                { id: 'today', label: "Today's Register" },
                { id: 'daily', label: 'Daily (24h)' },
                { id: 'weekly', label: 'Last 7 Days' },
                { id: 'monthly', label: 'This Month (30d)' },
                { id: 'yearly', label: 'Yearly (2026)' },
                { id: 'custom', label: 'Custom Date Range' }
              ].map((tab) => {
                const isActive = period === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeriod(tab.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: isActive ? '1.5px solid #065935' : '1px solid transparent',
                      background: isActive ? '#065935' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Date Pickers (Shown when custom is selected) */}
            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                />
                <button
                  type="button"
                  onClick={fetchAnalytics}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Apply Filter
                </button>
              </div>
            )}
          </div>

          {/* 3. DEDICATED "TODAY'S SALES & REGISTER PERFORMANCE" HERO CARD */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0b1120 0%, #0f172a 100%)',
              borderRadius: '14px',
              border: '1px solid #1e293b',
              padding: '24px 28px',
              marginBottom: '26px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
              color: '#ffffff',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Background accent glow */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '260px',
                height: '260px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(6, 89, 53, 0.35) 0%, rgba(6, 89, 53, 0) 70%)',
                pointerEvents: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: '#10b981', textTransform: 'uppercase' }}>
                  TODAY&apos;S STORE CASHIER &amp; ONLINE SNAPSHOT
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 0' }}>
                  Today&apos;s Live Register Performance (00:00 &bull; {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', fontSize: '11.5px', fontWeight: 700, color: '#94a3b8' }}>
                  Average Bill: <strong style={{ color: '#ffffff' }}>{formatCurrency(data.today.aov)}</strong>
                </span>
                <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', fontSize: '11.5px', fontWeight: 800, color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  Total Orders: {data.today.total_orders}
                </span>
              </div>
            </div>

            {/* 4 Hero Counters for Today */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
              {/* Today Combined */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 700 }}>TODAY&apos;S COMBINED SALES</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#ffffff', margin: '6px 0 2px' }}>
                  {formatCurrency(data.today.total_sales)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#34d399', fontWeight: 700 }}>
                  {data.today.total_orders} transactions today
                </div>
              </div>

              {/* Today POS Walk-in */}
              <div style={{ background: 'rgba(6, 89, 53, 0.18)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontSize: '11.5px', color: '#6ee7b7', fontWeight: 700 }}>TODAY&apos;S IN-STORE POS BILLING</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', margin: '6px 0 2px' }}>
                  {formatCurrency(data.today.pos_sales)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#a7f3d0', display: 'flex', gap: '10px' }}>
                  <span>Cash: <strong>{formatCurrency(data.today.pos_cash)}</strong></span>
                  <span>UPI: <strong>{formatCurrency(data.today.pos_upi)}</strong></span>
                </div>
              </div>

              {/* Today Online Ecommerce */}
              <div style={{ background: 'rgba(99, 102, 241, 0.12)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(129, 140, 248, 0.25)' }}>
                <div style={{ fontSize: '11.5px', color: '#a5b4fc', fontWeight: 700 }}>TODAY&apos;S ONLINE STORE ORDERS</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#818cf8', margin: '6px 0 2px' }}>
                  {formatCurrency(data.today.online_sales)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#c7d2fe', fontWeight: 700 }}>
                  {data.today.online_orders} web order(s) placed
                </div>
              </div>

              {/* Register Status & Cash in Drawer */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 700 }}>DRAWER CASH COLLECTED</div>
                <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', margin: '6px 0 2px' }}>
                  {formatCurrency(data.today.pos_cash)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
                  Physical cash received at register
                </div>
              </div>
            </div>
          </div>

          {/* 4. DUAL-STREAM KPI GRID (Online vs Walk-in for Selected Period) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '26px' }}>

            {/* Total Period Revenue */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Period Revenue
                </span>
                <span style={{ padding: '6px', borderRadius: '8px', background: '#ecfdf5', color: '#065935' }}>
                  <Icon name="stats" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', margin: '10px 0 4px' }}>
                {formatCurrency(data.period_totals.total_sales)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Across <strong>{data.period_totals.total_orders} total orders/bills</strong> (AOV: {formatCurrency(data.period_totals.aov)})
              </div>
            </div>

            {/* Walk-in POS Billing Stream */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #a7f3d0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#065935', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Walk-in POS Bills
                  </span>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Store Register Counter</div>
                </div>
                <span style={{ padding: '6px 10px', borderRadius: '6px', background: '#065935', color: '#ffffff', fontSize: '11px', fontWeight: 800 }}>
                  {data.period_totals.pos_orders} Bills
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#065935', margin: '10px 0 4px' }}>
                {formatCurrency(data.period_totals.pos_sales)}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', display: 'flex', gap: '8px' }}>
                <span>Cash: <strong>{formatCurrency(data.period_totals.pos_cash_sales)}</strong></span>
                <span>&bull;</span>
                <span>UPI: <strong>{formatCurrency(data.period_totals.pos_upi_sales)}</strong></span>
              </div>
            </div>

            {/* Online Ecommerce Orders Stream */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #c7d2fe', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Online Web Orders
                  </span>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Website Storefront</div>
                </div>
                <span style={{ padding: '6px 10px', borderRadius: '6px', background: '#4f46e5', color: '#ffffff', fontSize: '11px', fontWeight: 800 }}>
                  {data.period_totals.online_orders} Orders
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#4338ca', margin: '10px 0 4px' }}>
                {formatCurrency(data.period_totals.online_sales)}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Shipped &amp; delivered via online gateway
              </div>
            </div>

            {/* Inventory & Low Stock Snapshot */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #fed7aa', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Catalog &amp; Stock Health
                </span>
                <span style={{ padding: '6px', borderRadius: '8px', background: '#ffedd5', color: '#c2410c' }}>
                  <Icon name="delivery" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#ea580c', margin: '10px 0 4px' }}>
                {data.inventory_health.low_stock_count} Items Low
              </div>
              <div style={{ fontSize: '12px', color: '#7c2d12', display: 'flex', justifyContent: 'space-between' }}>
                <span>Active: <strong>{data.inventory_health.total_active_products}</strong></span>
                <span>Out of Stock: <strong>{data.inventory_health.out_of_stock_count}</strong></span>
              </div>
            </div>
          </div>

          {/* 5. INTERACTIVE MULTI-STREAM TELEMETRY GRAPH */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1.5px solid #e2e8f0',
              padding: '22px 26px',
              marginBottom: '26px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            {/* Chart Title, Legend & Metric Toggle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '14px'
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Sales Telemetry &amp; Volume Trends
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Comparing In-Store Walk-in POS Bills vs. Online Website Orders
                </div>
              </div>

              {/* Legend & Metric Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontWeight: 700 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#065935' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#059669', display: 'inline-block' }} />
                    In-Store POS
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#6366f1', display: 'inline-block' }} />
                    Online Store
                  </span>
                </div>

                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '7px', padding: '3px' }}>
                  <button
                    type="button"
                    onClick={() => setChartMetric('revenue')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '5px',
                      border: 'none',
                      background: chartMetric === 'revenue' ? '#ffffff' : 'transparent',
                      color: chartMetric === 'revenue' ? '#0f172a' : '#64748b',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: chartMetric === 'revenue' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Revenue (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('orders')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '5px',
                      border: 'none',
                      background: chartMetric === 'orders' ? '#ffffff' : 'transparent',
                      color: chartMetric === 'orders' ? '#0f172a' : '#64748b',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: chartMetric === 'orders' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    Order Volume (Qty)
                  </button>
                </div>
              </div>
            </div>

            {/* Pure Responsive SVG Graph Container */}
            {data.chart_series.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>No completed orders in this timeframe.</div>
                <div style={{ fontSize: '12px' }}>Choose a different date range or launch POS billing to record new sales.</div>
              </div>
            ) : (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <div style={{ minWidth: `${Math.max(500, data.chart_series.length * 55)}px`, height: '240px', position: 'relative' }}>
                  {/* Grid Lines */}
                  {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                    <div
                      key={ratio}
                      style={{
                        position: 'absolute',
                        top: `${(1 - ratio) * 180 + 10}px`,
                        left: '50px',
                        right: '10px',
                        borderBottom: '1px dashed #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: '-50px',
                          top: '-8px',
                          fontSize: '10px',
                          color: '#94a3b8',
                          fontWeight: 700,
                          width: '45px',
                          textAlign: 'right'
                        }}
                      >
                        {chartMetric === 'revenue' ? formatCurrency(chartMax * ratio) : Math.round(chartMax * ratio)}
                      </span>
                    </div>
                  ))}

                  {/* Bars visualization */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      bottom: '30px',
                      left: '60px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-around',
                      gap: '8px'
                    }}
                  >
                    {data.chart_series.map((pt, idx) => {
                      const posVal = chartMetric === 'revenue' ? pt.pos_sales : pt.pos_orders;
                      const onlineVal = chartMetric === 'revenue' ? pt.online_sales : pt.online_orders;
                      const totalVal = posVal + onlineVal;

                      const posHeight = Math.max(0, (posVal / chartMax) * 180);
                      const onlineHeight = Math.max(0, (onlineVal / chartMax) * 180);

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredPoint({ pt, idx, posVal, onlineVal, totalVal })}
                          onMouseLeave={() => setHoveredPoint(null)}
                          style={{
                            flex: 1,
                            maxWidth: '46px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                        >
                          {/* Rich Floating Theme Tooltip on Hover */}
                          {hoveredPoint && hoveredPoint.idx === idx && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#0b1120',
                                border: '1.5px solid #065935',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#ffffff',
                                fontSize: '11px',
                                whiteSpace: 'nowrap',
                                zIndex: 100,
                                boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
                                pointerEvents: 'none'
                              }}
                            >
                              <div style={{ fontWeight: 800, color: '#f8fafc', marginBottom: '4px', borderBottom: '1px solid #1e293b', paddingBottom: '3px' }}>
                                {pt.label}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', margin: '2px 0' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                                <span>In-Store POS: <strong>{chartMetric === 'revenue' ? formatCurrency(posVal) : `${posVal} bills`}</strong></span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#a5b4fc', margin: '2px 0' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                                <span>Online Web: <strong>{chartMetric === 'revenue' ? formatCurrency(onlineVal) : `${onlineVal} orders`}</strong></span>
                              </div>
                              <div style={{ borderTop: '1px dashed #334155', marginTop: '4px', paddingTop: '3px', fontWeight: 900, color: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                                <span>Total:</span>
                                <span>{chartMetric === 'revenue' ? formatCurrency(totalVal) : `${totalVal} total`}</span>
                              </div>
                              {/* Arrow */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  borderLeft: '5px solid transparent',
                                  borderRight: '5px solid transparent',
                                  borderTop: '5px solid #065935'
                                }}
                              />
                            </div>
                          )}

                          {/* Stacked Bars */}
                          <div
                            style={{
                              width: '100%',
                              display: 'flex',
                              flexDirection: 'column-reverse',
                              alignItems: 'center',
                              filter: hoveredPoint && hoveredPoint.idx === idx ? 'brightness(1.2)' : 'none',
                              transition: 'filter 0.15s ease'
                            }}
                          >
                            {/* POS Bar (Emerald) */}
                            {posHeight > 0 && (
                              <div
                                style={{
                                  width: '80%',
                                  height: `${posHeight}px`,
                                  background: '#059669',
                                  borderRadius: onlineHeight > 0 ? '0 0 4px 4px' : '4px 4px 0 0',
                                  transition: 'height 0.3s ease'
                                }}
                              />
                            )}
                            {/* Online Bar (Indigo) */}
                            {onlineHeight > 0 && (
                              <div
                                style={{
                                  width: '80%',
                                  height: `${onlineHeight}px`,
                                  background: '#6366f1',
                                  borderRadius: '4px 4px 0 0',
                                  transition: 'height 0.3s ease'
                                }}
                              />
                            )}
                          </div>

                          {/* X-axis Label */}
                          <span
                            style={{
                              position: 'absolute',
                              bottom: '-24px',
                              fontSize: '10.5px',
                              color: '#64748b',
                              fontWeight: 700,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {pt.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. SUPPORTING OPERATIONAL METRICS: TOP PRODUCTS & PAYMENT MODES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '26px' }}>

            {/* Top 5 Best-Selling Products */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Top 5 Best-Selling Products
                </h4>
                <Link href="/products" style={{ fontSize: '11.5px', fontWeight: 700, color: '#065935', textDecoration: 'none' }}>
                  Manage Catalog &rarr;
                </Link>
              </div>

              {data.top_products.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No item sales recorded in this timeframe.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.top_products.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: idx === 0 ? '#fef3c7' : '#e2e8f0', color: idx === 0 ? '#b45309' : '#475569', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b' }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{p.units_sold} units sold</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 900, fontSize: '13.5px', color: '#065935' }}>
                        {formatCurrency(p.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Method Distribution */}
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1.5px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Payment Mode Distribution
                </h4>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>
                  Total Collected: {formatCurrency(data.period_totals.total_sales)}
                </span>
              </div>

              {data.payment_methods.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No payment data in this period.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {data.payment_methods.map((pm, idx) => {
                    const percentage = data.period_totals.total_sales > 0
                      ? Math.round((pm.amount / data.period_totals.total_sales) * 100)
                      : 0;

                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                          <span style={{ textTransform: 'uppercase' }}>{pm.method} ({pm.count} bills)</span>
                          <span style={{ color: '#065935' }}>{formatCurrency(pm.amount)} ({percentage}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentage}%`,
                              height: '100%',
                              background: pm.method.toLowerCase() === 'cash' ? '#059669' : pm.method.toLowerCase() === 'upi' ? '#6366f1' : '#f59e0b',
                              borderRadius: '4px'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 6.5. PRODUCT AGING & SLOW-MOVING STOCK ALERTS (60+ DAYS IN STOCK) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1.5px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              marginBottom: '26px'
            }}
          >
            {/* Aging Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                background: '#fafaf9'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>⏳</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                    Product Aging & Slow-Moving Stock Alerts (60+ Days)
                  </h3>
                  {agingData.summary.total_aging_items > 0 && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#fef3c7',
                        color: '#92400e',
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {agingData.summary.total_aging_items} Items Alerted
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                  Identifies stock held in warehouse for over 60 days to prevent dead stock and unlock working capital.
                </div>
              </div>

              {/* Summary KPIs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 14px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Slow Moving (60–90d)</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#b45309' }}>{agingData.summary.slow_moving_count} items</div>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase' }}>Dead Stock (90d+)</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#b91c1c' }}>{agingData.summary.dead_stock_count} items</div>
                </div>

                <div style={{ padding: '6px 14px', borderRadius: '8px', background: '#e0f2fe', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: '#075985', textTransform: 'uppercase' }}>Tied-Up Capital</div>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0284c7' }}>₹{agingData.summary.total_tied_capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                </div>
              </div>
            </div>

            {/* Aging Filter Sub-toolbar */}
            <div style={{ padding: '10px 24px', background: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAgingFilter('all')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: agingFilter === 'all' ? '#0f172a' : '#f1f5f9',
                    color: agingFilter === 'all' ? '#ffffff' : '#475569'
                  }}
                >
                  All Aging ({agingData.aging_products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAgingFilter('60_90')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: agingFilter === '60_90' ? '#d97706' : '#f1f5f9',
                    color: agingFilter === '60_90' ? '#ffffff' : '#475569'
                  }}
                >
                  60–90 Days ({agingData.summary.slow_moving_count})
                </button>
                <button
                  type="button"
                  onClick={() => setAgingFilter('90_plus')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: agingFilter === '90_plus' ? '#dc2626' : '#f1f5f9',
                    color: agingFilter === '90_plus' ? '#ffffff' : '#475569'
                  }}
                >
                  90+ Days Dead Stock ({agingData.summary.dead_stock_count})
                </button>
              </div>

              <Link
                href="/products"
                style={{ fontSize: '11.5px', fontWeight: 700, color: '#065935', textDecoration: 'none' }}
              >
                Manage Clearance Discounts &rarr;
              </Link>
            </div>

            {/* Aging Table */}
            {loadingAging ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                Analyzing stock aging telemetry...
              </div>
            ) : agingData.aging_products.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', background: '#f0fdf4' }}>
                <span style={{ fontSize: '24px' }}>🎉</span>
                <div style={{ fontWeight: 800, color: '#166534', fontSize: '14px', marginTop: '4px' }}>
                  No Aging or Slow-Moving Inventory!
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  All stock items have had activity or been added within the last 60 days.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="admin-table" style={{ width: '100%', margin: 0, fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
                      <th style={{ padding: '10px 18px' }}>PRODUCT ITEM</th>
                      <th style={{ padding: '10px 18px' }}>VENDOR / SUPPLIER</th>
                      <th style={{ padding: '10px 18px', textAlign: 'center' }}>DAYS IN STOCK</th>
                      <th style={{ padding: '10px 18px', textAlign: 'center' }}>QTY IN STOCK</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right' }}>TIED CAPITAL</th>
                      <th style={{ padding: '10px 18px', textAlign: 'center' }}>AGING STATUS</th>
                      <th style={{ padding: '10px 18px', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingData.aging_products
                      .filter(p => {
                        if (agingFilter === '60_90') return p.days_in_stock >= 60 && p.days_in_stock < 90;
                        if (agingFilter === '90_plus') return p.days_in_stock >= 90;
                        return true;
                      })
                      .map((p) => {
                        const isDead = p.days_in_stock >= 90;
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 18px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {p.image ? (
                                  <img
                                    src={p.image}
                                    alt={p.name}
                                    style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                  />
                                ) : (
                                  <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                    👜
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{p.name}</div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    {p.category_name || 'NP Grand'} • Price: ₹{p.price}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td style={{ padding: '10px 18px', color: '#475569', fontSize: '12px' }}>
                              {p.vendor_name || <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                            </td>

                            <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                              <span style={{ fontWeight: 900, color: isDead ? '#dc2626' : '#d97706', fontSize: '13px' }}>
                                {p.days_in_stock} days
                              </span>
                            </td>

                            <td style={{ padding: '10px 18px', textAlign: 'center', fontWeight: 800, color: '#334155' }}>
                              {p.stock_quantity} units
                            </td>

                            <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 900, color: '#0284c7' }}>
                              ₹{Number(p.tied_capital || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>

                            <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '3px 9px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: isDead ? '#fee2e2' : '#fef3c7',
                                  color: isDead ? '#b91c1c' : '#b45309',
                                  border: `1px solid ${isDead ? '#fecaca' : '#fde68a'}`
                                }}
                              >
                                {isDead ? '🛑 Dead Stock (90+ Days)' : '⚠️ Slow Moving (60–90d)'}
                              </span>
                            </td>

                            <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                              <Link
                                href="/products"
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  background: isDead ? '#b91c1c' : '#065935',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  textDecoration: 'none',
                                  display: 'inline-block'
                                }}
                              >
                                Edit / Discount
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. LIVE UNIFIED RECENT TRANSACTIONS FEED (Online Orders + POS Bills) */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  Recent Transactions &amp; Walk-in Bills
                </h3>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>Latest store bills and ecommerce orders</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Link href="/pos" className="admin-btn admin-btn-outline" style={{ fontSize: '11.5px', padding: '5px 12px' }}>
                  Walk-in Register &rarr;
                </Link>
                <Link href="/orders" className="admin-btn admin-btn-primary" style={{ fontSize: '11.5px', padding: '5px 12px' }}>
                  All Orders &rarr;
                </Link>
              </div>
            </div>

            <table className="admin-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
                  <th style={{ padding: '10px 18px' }}>TRANSACTION / ORDER #</th>
                  <th style={{ padding: '10px 18px' }}>STREAM</th>
                  <th style={{ padding: '10px 18px' }}>CUSTOMER</th>
                  <th style={{ padding: '10px 18px' }}>PAYMENT</th>
                  <th style={{ padding: '10px 18px' }}>STATUS</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right' }}>TOTAL</th>
                  <th style={{ padding: '10px 18px', textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_feed.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '13px' }}>
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.recent_feed.map((o) => {
                    const isPOS = (o.order_type || '').toLowerCase() === 'pos';
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 18px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: isPOS ? '#065935' : '#4338ca', fontSize: '13px' }}>
                            {o.order_number}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              background: isPOS ? '#ecfdf5' : '#e0e7ff',
                              color: isPOS ? '#065935' : '#3730a3'
                            }}
                          >
                            {isPOS ? 'WALK-IN POS' : 'ONLINE WEB'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>{o.customer_name}</div>
                          {o.customer_phone && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{o.customer_phone}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                          {(o.payment_method || 'Cash').toUpperCase()}
                        </td>
                        <td style={{ padding: '12px 18px' }}>
                          <span className={`badge ${getStatusBadge(o.order_status)}`}>
                            {(o.order_status || 'Paid').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 900, fontSize: '13.5px', color: '#0f172a' }}>
                          {formatCurrency(o.total_amount)}
                        </td>
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          {isPOS ? (
                            <button
                              type="button"
                              onClick={() => openPOS(o)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '5px',
                                background: '#b45309',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="Edit this walk-in bill in POS popup"
                            >
                              Edit Bill
                            </button>
                          ) : (
                            <Link
                              href="/orders"
                              style={{
                                padding: '4px 9px',
                                borderRadius: '5px',
                                background: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                fontSize: '11px',
                                fontWeight: 700,
                                textDecoration: 'none'
                              }}
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
