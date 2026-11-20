/**
 * Universal Barcode & QR Code extraction and detection utility
 * For NP Grand Shopping (https://www.npgrandshopping.com)
 *
 * Supports:
 *  - Standard 1D Barcodes (e.g. NP-1048, 8901234567890)
 *  - 2D QR Codes containing plain text (e.g. NP-1048)
 *  - 2D QR Codes containing URLs (e.g. https://npgrandshopping.com/product/NP-1048?barcode=NP-1048)
 *  - 2D QR Codes containing JSON (e.g. {"barcode": "NP-1048"} or {"code": "NP-1048"})
 *  - Prefixed scanner outputs (e.g. BARCODE: NP-1048, QR: NP-1048)
 */

export function extractScanCode(raw) {
  if (raw === null || raw === undefined) return '';
  let str = Array.isArray(raw) ? raw[0] : String(raw);
  str = str.trim();
  if (!str) return '';

  // Strip wrapping single or double quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }

  // 1. JSON QR Code (e.g. {"barcode":"NP-1048"} or [{"code":"NP-1048"}])
  if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
    try {
      const parsed = JSON.parse(str);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (obj && typeof obj === 'object') {
        const keys = ['barcode', 'code', 'sku', 'product_id', 'productId', 'id', 'item_code', 'text', 'data'];
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim()) {
            return String(obj[k]).trim();
          }
        }
      }
    } catch (_) {
      // Not valid JSON, continue with other parsers
    }
  }

  // 2. URL QR Code (e.g. https://npgrandshopping.com/product/NP-1048?barcode=NP-1048)
  if (/^https?:\/\//i.test(str)) {
    try {
      const url = new URL(str);
      // Check query params first
      for (const k of ['barcode', 'code', 'sku', 'id', 'p', 'product_id', 'pid']) {
        const val = url.searchParams.get(k);
        if (val && val.trim()) return val.trim();
      }
      // Check last pathname segment
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        const last = decodeURIComponent(segments[segments.length - 1]).trim();
        if (last && last.length >= 2) return last;
      }
    } catch (_) {
      // Malformed URL, fall through
    }
  }

  // 3. Prefixed QR Code (e.g. "BARCODE: NP-1048", "CODE: NP-1048", "QR: NP-1048")
  const prefixMatch = str.match(/^(?:barcode|code|qr|sku)\s*[:=-]\s*([^\s]+)/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }

  // 4. Pattern match for standard NP- or SKU- barcode inside longer string
  const npMatch = str.match(/\b((?:NP|SKU)-[A-Za-z0-9_-]+)\b/i);
  if (npMatch && npMatch[1]) {
    return npMatch[1].trim();
  }

  return str;
}

export function looksLikeBarcodeOrQR(value) {
  const text = String(value || '').trim();
  if (!text) return false;

  // JSON or URL QR codes
  if (text.startsWith('{') || text.startsWith('[')) return true;
  if (/^https?:\/\//i.test(text)) return true;
  if (/^(?:barcode|code|qr|sku)\s*[:=-]/i.test(text)) return true;

  // Extracted code matches recognized barcode pattern
  const extracted = extractScanCode(text);
  if (extracted && extracted !== text) return true;

  // Standard barcode patterns
  if (/^(NP|SKU)-/i.test(text)) return true;
  if (/^\d{4,}$/.test(text)) return true;

  // General alphanumeric barcode tokens (without spaces, 4+ chars, at least some digits)
  if (!/\s/.test(text) && /^[0-9A-Za-z][0-9A-Za-z\-_./#:?=&%{}",@+~]{3,}$/.test(text)) {
    return (text.match(/\d/g) || []).length >= 3;
  }

  return false;
}
