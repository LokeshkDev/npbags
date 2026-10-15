'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { getAdminOrders, updateOrderStatus } from '../../lib/api';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const loadOrders = () => {
    getAdminOrders({ status: statusFilter, search })
      .then(data => {
        if (data && data.orders) setOrders(data.orders);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, search]);

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, { order_status: status });
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, order_status: status });
      }
    } catch (err) {
      alert(err.message || 'Error updating status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered': return 'badge-success';
      case 'shipped': return 'badge-info';
      case 'paid': return 'badge-success';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Customer Orders Management" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search by order #, customer name, email..."
                className="form-control"
                style={{ width: '320px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: '180px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="admin-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        No orders recorded yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.order_number}</strong></td>
                        <td style={{ color: 'var(--muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>
                          <div><strong>{o.customer_name}</strong></div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.customer_email}</div>
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
                            {o.payment_method}
                          </span>
                        </td>
                        <td><strong>₹{o.total_amount}</strong></td>
                        <td>
                          <select
                            className={`badge ${getStatusBadge(o.order_status)}`}
                            style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            value={o.order_status}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => {
                              setSelectedOrder(o);
                              setNewStatus(o.order_status);
                            }}
                          >
                            <Icon name="eye" size={14} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Order Details Drawer / Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.order_number}`}
        maxWidth="640px"
      >
        {selectedOrder && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', background: 'var(--surface-soft)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <strong>Customer Info</strong>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>{selectedOrder.customer_name}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{selectedOrder.customer_email}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{selectedOrder.customer_phone}</div>
              </div>
              <div>
                <strong>Shipping Address</strong>
                {selectedOrder.shipping_address ? (
                  <div style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>
                    {selectedOrder.shipping_address.line1}
                    {selectedOrder.shipping_address.line2 && `, ${selectedOrder.shipping_address.line2}`}<br />
                    {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} — {selectedOrder.shipping_address.postal_code}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No address stored</div>
                )}
              </div>
            </div>

            <h4 style={{ marginBottom: '12px', fontSize: '15px' }}>Items Ordered</h4>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {selectedOrder.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', border: '1px solid var(--line)', borderRadius: '6px' }}>
                  <div>
                    <strong>{item.quantity}x {item.product_name}</strong>
                    {item.variant_info && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.variant_info}</div>}
                  </div>
                  <strong>₹{item.total}</strong>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'grid', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{selectedOrder.subtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>−₹{selectedOrder.discount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Shipping:</span>
                <span>₹{selectedOrder.shipping_fee}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
                <span>Total Amount:</span>
                <span>₹{selectedOrder.total_amount}</span>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '16px 0 0', marginTop: '20px' }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

