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
    debounceMs = 500,
    minLength = 3,
    maxLength = 50,
    charIntervalThreshold = 60, // ms between characters from hardware scanner
    enabled = true
  } = options;

  const bufferRef = useRef('');
  const timestampsRef = useRef([]);
  const lastScanTimeRef = useRef(0);
  const timeoutRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    const activeEl = document.activeElement;
    const isScanCaptureEl =
      activeEl?.getAttribute('data-scan-capture') === 'true' ||
      activeEl?.id === 'pos-barcode-scanner-input' ||
      activeEl?.id === 'pos-main-search-input';

    const now = Date.now();

    // Check for scanner terminator (Enter or Tab)
    if (e.key === 'Enter' || e.key === 'Tab') {
      const code = bufferRef.current.trim();
      const timestamps = timestampsRef.current;
      const isFast = isFastBurst(timestamps, charIntervalThreshold);

      // Trigger if fast burst OR has barcode prefix NP- OR scan input is active
      if (
        code.length >= minLength &&
        code.length <= maxLength &&
        (isFast || isScanCaptureEl || code.toUpperCase().startsWith('NP-') || code.toUpperCase().startsWith('SKU-'))
      ) {
        if (now - lastScanTimeRef.current > debounceMs) {
          e.preventDefault();
          e.stopPropagation();
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

    // Capture alphanumeric & barcode punctuation
    if (e.key && e.key.length === 1 && /[0-9a-zA-Z\-_./#]/.test(e.key)) {
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

