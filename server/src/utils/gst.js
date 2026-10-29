/**
 * Indian Retail & Fashion GST Calculation Engine
 * For NP Grand Shopping (https://www.npgrandshopping.com)
 *
 * Tax Rules:
 * - Bags / Luggage / Wallets (HSN 4202): 18% GST standard
 * - Apparel & Garments (HSN 6204, 6109): <= ₹2,500 -> 5% | > ₹2,500 -> 18%
 * - Intra-State (Tamil Nadu): Equal CGST (half) + SGST (half)
 * - Inter-State (Outside TN): Full IGST
 */

const APPAREL_GST_THRESHOLD = 2500;
const GST_RATE_LOW = 5;
const GST_RATE_HIGH = 18;
const DEFAULT_HSN_CODE = '4202';
const DEFAULT_STORE_STATE = 'Tamil Nadu';

function getProductGstRate(unitPrice, hsn = DEFAULT_HSN_CODE) {
  if (String(hsn).trim() === '4202') return GST_RATE_HIGH; // 18% standard for bags/accessories
  const price = Number(unitPrice) || 0;
  return price <= APPAREL_GST_THRESHOLD ? GST_RATE_LOW : GST_RATE_HIGH;
}

function calculateItemTax({
  price = 0,
  quantity = 1,
  discount = 0,
  isGstInclusive = true,
  isInterState = false,
  hsnCode = DEFAULT_HSN_CODE,
  customGstRate = null,
} = {}) {
  const unitPrice = Number(price) || 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const gstRate = customGstRate !== null && customGstRate !== undefined
    ? Number(customGstRate)
    : getProductGstRate(unitPrice, hsnCode);

  const rawTotal = Math.round(unitPrice * qty * 100) / 100;
  const itemDiscount = Math.min(Number(discount) || 0, rawTotal);
  const discountedTotal = Math.max(0, Math.round((rawTotal - itemDiscount) * 100) / 100);

  let taxableAmount = 0;
  let totalTax = 0;
  let lineTotal = 0;

  if (isGstInclusive) {
    taxableAmount = Math.round((discountedTotal / (1 + gstRate / 100)) * 100) / 100;
    totalTax = Math.round((discountedTotal - taxableAmount) * 100) / 100;
    lineTotal = discountedTotal;
  } else {
    taxableAmount = discountedTotal;
    totalTax = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
    lineTotal = Math.round((taxableAmount + totalTax) * 100) / 100;
  }

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstAmount = totalTax;
  } else {
    cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;
  }

  return {
    unitPrice,
    quantity: qty,
    hsnCode,
    gstRate,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    lineTotal,
  };
}

function isInterStateCheck(stateStr) {
  if (!stateStr) return false;
  const s = String(stateStr).trim().toLowerCase();
  return !s.includes('tamil nadu') && !s.includes('tn') && !s.includes('counter') && !s.includes('in-store');
}

function calculateOrderTax({
  items = [],
  discountAmount = 0,
  shippingAmount = 0,
  isGstInclusive = true,
  shippingState = DEFAULT_STORE_STATE
}) {
  const interState = isInterStateCheck(shippingState);
  let subtotal = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTax = 0;

  const processedItems = items.map((it) => {
    const tax = calculateItemTax({
      price: it.price,
      quantity: it.quantity || it.qty || 1,
      discount: it.discount || 0,
      isGstInclusive,
      isInterState: interState,
      hsnCode: it.hsn_code || DEFAULT_HSN_CODE,
      customGstRate: it.gst_rate || it.gstRate,
    });

    subtotal += (Number(it.price) || 0) * (it.quantity || it.qty || 1);
    totalTaxable += tax.taxableAmount;
    totalCgst += tax.cgstAmount;
    totalSgst += tax.sgstAmount;
    totalIgst += tax.igstAmount;
    totalTax += tax.totalTax;

    return { ...it, ...tax };
  });

  const grandTotal = Math.max(0, subtotal - (Number(discountAmount) || 0) + (Number(shippingAmount) || 0));

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Number(discountAmount) || 0,
    shippingAmount: Number(shippingAmount) || 0,
    taxableAmount: Math.round(totalTaxable * 100) / 100,
    cgstAmount: Math.round(totalCgst * 100) / 100,
    sgstAmount: Math.round(totalSgst * 100) / 100,
    igstAmount: Math.round(totalIgst * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    items: processedItems,
  };
}

module.exports = {
  APPAREL_GST_THRESHOLD,
  GST_RATE_LOW,
  GST_RATE_HIGH,
  DEFAULT_HSN_CODE,
  DEFAULT_STORE_STATE,
  getProductGstRate,
  calculateItemTax,
  calculateOrderTax,
  isInterStateCheck
};

