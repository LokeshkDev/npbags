'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * useScannerInput Hook
 * Distinguishes between human typing and hardware USB/Bluetooth barcode scanner bursts.
 * Automatically recognizes 'NP-' and 'SKU-' prefixed barcodes.
 * For NP Grand Shopping (https://www.npgrandshopping.com)
 */
export default function useScannerInput(onScan, options = {}) {
  const {
    debounceMs = 400,
    minLength = 3,
    maxLength = 1024, // Support long 2D QR codes (URLs, JSON, unicode payloads)
    charIntervalThreshold = 65, // ms between characters from hardware scanner
    enabled = true
  } = options;

  const bufferRef = useRef('');
  const timestampsRef = useRef([]);
  const lastScanTimeRef = useRef(0);
  const timeoutRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    const activeEl = document.activeElement;
    // Let dedicated per-variant barcode inputs handle their own scans
    if (activeEl?.getAttribute('data-variant-scan') === 'true') return;
    const isScanCaptureEl =
      activeEl?.getAttribute('data-scan-capture') === 'true' ||
      activeEl?.id === 'pos-barcode-scanner-input' ||
      activeEl?.id === 'pos-main-search-input';
    const isNoScanEl = activeEl?.getAttribute('data-no-scan') === 'true';
    const isInputField = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    const now = Date.now();

    // Check for scanner terminator (Enter or Tab)
    if (e.key === 'Enter' || e.key === 'Tab') {
      const code = bufferRef.current.trim();
      const timestamps = timestampsRef.current;
      const isFast = isFastBurst(timestamps, charIntervalThreshold);

      // If typing in a no-scan input (e.g. customer mobile number) or regular input and NOT a fast hardware burst:
      if ((isNoScanEl || (isInputField && !isScanCaptureEl)) && !isFast) {
        bufferRef.current = '';
        timestampsRef.current = [];
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        return;
      }

      // Recognize Barcodes & 2D QR Codes (URLs, JSON payloads, NP-/SKU- codes, or fast burst)
      const isRecognizedBarcodeOrQR =
        code.toUpperCase().includes('NP-') ||
        code.toUpperCase().includes('SKU-') ||
        code.startsWith('{') ||
        code.startsWith('[') ||
        /^https?:\/\//i.test(code) ||
        /^(?:barcode|code|qr|sku)\s*[:=-]/i.test(code);

      // Trigger if fast burst OR recognized code OR scan input is active
      if (
        code.length >= minLength &&
        code.length <= maxLength &&
        (isFast || isScanCaptureEl || isRecognizedBarcodeOrQR)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (now - lastScanTimeRef.current > debounceMs) {
          lastScanTimeRef.current = now;
          if (typeof onScan === 'function') {
            onScan(code);
          }
        }
      }

      // Reset buffer
      bufferRef.current = '';
      timestampsRef.current = [];
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    // Capture printable characters (alphanumeric, punctuation, spaces, JSON, URLs, QR unicode)
    if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      bufferRef.current += e.key;
      timestampsRef.current.push(now);

      // Clear buffer if no subsequent char arrives within 350ms (human typing)
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = '';
        timestampsRef.current = [];
      }, 350);

      // Buffer overflow prevention
      if (bufferRef.current.length > maxLength) {
        bufferRef.current = '';
        timestampsRef.current = [];
      }
    }
  }, [onScan, debounceMs, minLength, maxLength, charIntervalThreshold, enabled]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleKeyDown, enabled]);
}

// Determines if 50%+ of character gaps occurred within the threshold
function isFastBurst(timestamps, threshold) {
  if (timestamps.length < 3) return false;
  let fastCount = 0;
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] - timestamps[i - 1] <= threshold) {
      fastCount++;
    }
  }
  return fastCount / (timestamps.length - 1) >= 0.5;
}

