const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('npgrand_admin_token');
}

export function setAdminToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('npgrand_admin_token', token);
  }
}

export function removeAdminToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('npgrand_admin_token');
    localStorage.removeItem('npgrand_admin_user');
  }
}

async function adminFetch(endpoint, options = {}) {
  const token = getAdminToken();
  const headers = {
    ...(options.headers || {})
  };

  // Only set application/json if not sending FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data.data !== undefined ? data.data : data;
}

// Authentication
export async function loginAdmin(email, password) {
  return adminFetch('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

// Stats & Analytics
export async function getAdminStats() {
  return adminFetch('/admin/stats');
}

export async function getAdminDashboardAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/stats/analytics${query ? `?${query}` : ''}`);
}

// Products
export async function getAdminProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/products${query ? `?${query}` : ''}`);
}

export async function getAdminProductById(id) {
  return adminFetch(`/products/${id}`);
}


export async function createAdminProduct(formData) {
  return adminFetch('/admin/products', {
    method: 'POST',
    body: formData
  });
}

export async function updateAdminProduct(id, formData) {
  return adminFetch(`/admin/products/${id}`, {
    method: 'PUT',
    body: formData
  });
}

export async function deleteAdminProduct(id) {
  return adminFetch(`/admin/products/${id}`, {
    method: 'DELETE'
  });
}

export async function duplicateAdminProduct(id) {
  return adminFetch(`/admin/products/${id}/duplicate`, {
    method: 'POST'
  });
}

export async function deleteProductImage(productId, imageId) {
  return adminFetch(`/admin/products/${productId}/images/${imageId}`, {
    method: 'DELETE'
  });
}

export async function replaceProductImage(productId, imageId, formData) {
  return adminFetch(`/admin/products/${productId}/images/${imageId}/replace`, {
    method: 'PUT',
    body: formData
  });
}

export async function setPrimaryProductImage(productId, imageId) {
  return adminFetch(`/admin/products/${productId}/images/${imageId}/primary`, {
    method: 'PUT'
  });
}

export async function uploadProductGalleryImage(productId, formData) {
  return adminFetch(`/admin/products/${productId}/images`, {
    method: 'POST',
    body: formData
  });
}

// Categories
export async function getAdminCategories() {
  return adminFetch('/categories');
}

export async function createAdminCategory(formData) {
  return adminFetch('/admin/categories', {
    method: 'POST',
    body: formData
  });
}

export async function updateAdminCategory(id, formData) {
  return adminFetch(`/admin/categories/${id}`, {
    method: 'PUT',
    body: formData
  });
}

export async function updateCategoryBanner(categoryId, bannerUrl, bannerLink) {
  const formData = new FormData();
  if (bannerUrl !== undefined) formData.append('banner_image', bannerUrl || '');
  if (bannerLink !== undefined) formData.append('banner_link', bannerLink || '');
  return adminFetch(`/admin/categories/${categoryId}`, {
    method: 'PUT',
    body: formData
  });
}

export async function deleteAdminCategory(id) {
  return adminFetch(`/admin/categories/${id}`, {
    method: 'DELETE'
  });
}

// Orders
export async function getAdminOrders(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/orders${query ? `?${query}` : ''}`);
}

export async function updateOrderStatus(id, statusData) {
  return adminFetch(`/admin/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(statusData)
  });
}

export async function deleteAdminOrder(id, restock = true) {
  return adminFetch(`/admin/orders/${id}?restock=${restock}`, {
    method: 'DELETE'
  });
}

export async function updateAdminPOSOrderItems(id, data) {
  return adminFetch(`/admin/orders/${id}/pos-items`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// CMS & Homepage Sections (NEW)
export async function getAdminCMSSections() {
  return adminFetch('/admin/cms/sections');
}

export async function reorderAdminCMSSections(order) {
  return adminFetch('/admin/cms/sections-reorder', {
    method: 'PUT',
    body: JSON.stringify({ order })
  });
}

export async function updateAdminCMSSection(sectionKey, data) {
  return adminFetch(`/admin/cms/sections/${sectionKey}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function uploadCMSMedia(formData) {
  return adminFetch('/admin/cms/upload', {
    method: 'POST',
    body: formData
  });
}

// Delivery Settings (NEW)
export async function getAdminDeliverySettings() {
  return adminFetch('/admin/cms/delivery-settings');
}

export async function updateAdminDeliverySettings(data) {
  return adminFetch('/admin/cms/delivery-settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

// Banners
export async function getAdminBanners() {
  return adminFetch('/admin/banners');
}

export async function createAdminBanner(formData) {
  return adminFetch('/admin/banners', {
    method: 'POST',
    body: formData
  });
}

export async function updateAdminBanner(id, formData) {
  return adminFetch(`/admin/banners/${id}`, {
    method: 'PUT',
    body: formData
  });
}

export async function deleteAdminBanner(id) {
  return adminFetch(`/admin/banners/${id}`, {
    method: 'DELETE'
  });
}

// Coupons
export async function getAdminCoupons() {
  return adminFetch('/admin/coupons');
}

export async function createAdminCoupon(data) {
  return adminFetch('/admin/coupons', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteAdminCoupon(id) {
  return adminFetch(`/admin/coupons/${id}`, {
    method: 'DELETE'
  });
}

// Blogs
export async function getAdminBlogs() {
  return adminFetch('/admin/blogs');
}

export async function createAdminBlog(formData) {
  return adminFetch('/admin/blogs', {
    method: 'POST',
    body: formData
  });
}

export async function updateAdminBlog(id, formData) {
  return adminFetch(`/admin/blogs/${id}`, {
    method: 'PUT',
    body: formData
  });
}

export async function deleteAdminBlog(id) {
  return adminFetch(`/admin/blogs/${id}`, {
    method: 'DELETE'
  });
}

// Messages & Newsletter
export async function getAdminMessages() {
  return adminFetch('/admin/messages');
}

export async function getAdminSubscribers() {
  return adminFetch('/admin/subscribers');
}

// Store Settings
export async function getAdminStoreSettings() {
  return adminFetch('/admin/settings');
}

export async function updateAdminStoreSettings(formData) {
  return adminFetch('/admin/settings', {
    method: 'PUT',
    body: formData
  });
}

// Customers & Registered Users
export async function getAdminCustomers(search = '') {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return adminFetch(`/admin/customers${query}`);
}

export async function getAdminCustomerById(id) {
  return adminFetch(`/admin/customers/${id}`);
}

export async function createAdminCustomer(data) {
  return adminFetch('/admin/customers', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateAdminCustomer(id, data) {
  return adminFetch(`/admin/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteAdminCustomer(id) {
  return adminFetch(`/admin/customers/${id}`, {
    method: 'DELETE'
  });
}

export async function resetAdminCustomerPassword(id, newPassword) {
  return adminFetch(`/admin/customers/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword })
  });
}

// Barcodes & Label Generation
export async function getProductBarcodes(productId) {
  return adminFetch(`/admin/products/${productId}/barcodes`);
}

export async function generateProductBarcodes(productId) {
  return adminFetch(`/admin/products/${productId}/barcodes/generate`, {
    method: 'POST'
  });
}

export async function lookupBarcode(code) {
  return adminFetch(`/admin/barcodes/lookup?code=${encodeURIComponent(code)}`);
}

export async function deactivateBarcode(id) {
  return adminFetch(`/admin/barcodes/${id}/deactivate`, {
    method: 'PUT'
  });
}

// POS Billing Counter
export async function createAdminPOSOrder(data) {
  return adminFetch('/admin/pos/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function processAdminOrderReturn(orderId, data) {
  return adminFetch(`/admin/orders/${orderId}/return`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

// Inventory Tracking & Audit Trail
export async function getAdminInventoryTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/inventory/transactions${query ? '?' + query : ''}`);
}

export async function getAdminVariantStock(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/inventory/variants${query ? '?' + query : ''}`);
}

export async function adjustAdminVariantStock(data) {
  return adminFetch('/admin/inventory/variants/stock', {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function getAdminAllBarcodes(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/barcodes${query ? '?' + query : ''}`);
}

export async function lookupCustomerByPhone(phone) {
  return adminFetch(`/admin/customers/lookup?phone=${encodeURIComponent(phone)}`);
}

// Vendors & Suppliers
export async function getAdminVendors() {
  return adminFetch('/admin/vendors');
}

export async function getAdminVendorById(id) {
  return adminFetch(`/admin/vendors/${id}`);
}

export async function createAdminVendor(data) {
  return adminFetch('/admin/vendors', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateAdminVendor(id, data) {
  return adminFetch(`/admin/vendors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteAdminVendor(id) {
  return adminFetch(`/admin/vendors/${id}`, {
    method: 'DELETE'
  });
}

export async function getAdminVendorPurchaseHistory(id) {
  return adminFetch(`/admin/vendors/${id}/purchase-history`);
}

// Purchase Bills
export async function getAdminPurchaseBills(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/purchase-bills${query ? `?${query}` : ''}`);
}

export async function getAdminOutstandingPurchaseBills(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/purchase-bills/outstanding${query ? `?${query}` : ''}`);
}

export async function getAdminPurchaseBillById(id) {
  return adminFetch(`/admin/purchase-bills/${id}`);
}

export async function getNextPurchaseBillNumber() {
  return adminFetch('/admin/purchase-bills/next-number');
}

export async function createAdminPurchaseBill(data) {
  return adminFetch('/admin/purchase-bills', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateAdminPurchaseBill(id, data) {
  return adminFetch(`/admin/purchase-bills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function confirmAdminPurchaseBill(id) {
  return adminFetch(`/admin/purchase-bills/${id}/confirm`, {
    method: 'POST'
  });
}

export async function addAdminPurchaseBillPayment(id, data) {
  return adminFetch(`/admin/purchase-bills/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function deleteAdminPurchaseBill(id) {
  return adminFetch(`/admin/purchase-bills/${id}`, {
    method: 'DELETE'
  });
}

// POS Billing Hold / Resume
export async function getHeldBills(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/held-bills${query ? `?${query}` : ''}`);
}

export async function getHeldBillById(id) {
  return adminFetch(`/admin/held-bills/${id}`);
}

export async function holdBill(data) {
  return adminFetch('/admin/held-bills', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateHeldBill(id, data) {
  return adminFetch(`/admin/held-bills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function completeHeldBill(id, data = {}) {
  return adminFetch(`/admin/held-bills/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function cancelHeldBill(id) {
  return adminFetch(`/admin/held-bills/${id}`, {
    method: 'DELETE'
  });
}

// Sales Persons / Staff
export async function getAdminSalespersons(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/salespersons${query ? '?' + query : ''}`);
}

export async function getAdminSalespersonReport(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/salespersons/report${query ? '?' + query : ''}`);
}

export async function createAdminSalesperson(data) {
  return adminFetch('/admin/salespersons', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateAdminSalesperson(id, data) {
  return adminFetch(`/admin/salespersons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

export async function deleteAdminSalesperson(id) {
  return adminFetch(`/admin/salespersons/${id}`, {
    method: 'DELETE'
  });
}

// Audit & Activity Logs
export async function getAdminAuditLogs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/audit-logs${query ? '?' + query : ''}`);
}

// Product Aging & Slow-Moving Stock Alerts
export async function getAdminProductAgingAlerts(params = {}) {
  const query = new URLSearchParams(params).toString();
  return adminFetch(`/admin/dashboard/aging${query ? '?' + query : ''}`);
}



