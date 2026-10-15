import { DEMO_SETTINGS, DEMO_DELIVERY, DEMO_CMS_SECTIONS, DEMO_PRODUCTS, DEMO_CATEGORIES } from './demo-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function safeFetch(endpoint, options = {}, fallback = null) {
  try {
    const url = `${API_BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      next: { revalidate: 10 }
    });

    if (!res.ok) {
      if (fallback !== null) return fallback;
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.data !== undefined ? data.data : data;
  } catch (error) {
    if (fallback !== null) return fallback;
    throw error;
  }
}

export async function getCMSSections() {
  return safeFetch('/cms/sections', {}, DEMO_CMS_SECTIONS);
}

export async function getDeliverySettings() {
  return safeFetch('/cms/delivery-settings', {}, DEMO_DELIVERY);
}

export async function getStoreSettings() {
  return safeFetch('/settings', {}, DEMO_SETTINGS);
}

export async function getProducts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = `/products${query ? `?${query}` : ''}`;
  const fallback = { products: DEMO_PRODUCTS, pagination: { total: DEMO_PRODUCTS.length, page: 1, limit: 24, pages: 1 } };
  return safeFetch(endpoint, {}, fallback);
}

export async function getProductByIdOrSlug(idOrSlug) {
  const fallback = DEMO_PRODUCTS.find(p => p.id === idOrSlug || p.slug === idOrSlug) || DEMO_PRODUCTS[0];
  return safeFetch(`/products/${idOrSlug}`, {}, fallback);
}

export async function getCategories() {
  return safeFetch('/categories', {}, DEMO_CATEGORIES);
}

export async function createOrder(orderData, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return safeFetch('/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
    headers
  });
}

export async function validateCoupon(code, subtotal) {
  return safeFetch('/orders/validate-coupon', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal })
  });
}

export async function submitContact(data) {
  return safeFetch('/contact/message', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function subscribeNewsletter(email) {
  return safeFetch('/contact/newsletter', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function loginUser(email, password) {
  return safeFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function registerUser(userData) {
  return safeFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function getMyProfile(token) {
  return safeFetch('/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

