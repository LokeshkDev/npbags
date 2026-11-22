'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Shared, persisted settings for the 80×12mm jewellery tag print engine.
 * Kept in localStorage so every print entry point (Barcodes, Products,
 * Vendors) uses the same calibration.
 */
export const LABEL_SETTINGS_KEYS = {
  pitchMm: 'npgrand_jewel_pitch_mm',
  offsetX: 'npgrand_jewel_offset_x',
  offsetY: 'npgrand_jewel_offset_y',
  continuous: 'npgrand_jewel_continuous'
};

export const LABEL_SETTINGS_DEFAULTS = {
  pitchMm: 12,
  offsetX: 0,
  offsetY: 0,
  continuous: false
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function getLabelSettings() {
  if (typeof window === 'undefined') return { ...LABEL_SETTINGS_DEFAULTS };
  try {
    const storedPitch = window.localStorage.getItem(LABEL_SETTINGS_KEYS.pitchMm);
    const storedX = window.localStorage.getItem(LABEL_SETTINGS_KEYS.offsetX);
    const storedY = window.localStorage.getItem(LABEL_SETTINGS_KEYS.offsetY);
    const storedContinuous = window.localStorage.getItem(LABEL_SETTINGS_KEYS.continuous);
    return {
      pitchMm: clampNumber(storedPitch, 12, 30, 12),
      offsetX: clampNumber(storedX, -6, 6, 0),
      offsetY: clampNumber(storedY, -6, 6, 0),
      continuous: storedContinuous === '1'
    };
  } catch {
    return { ...LABEL_SETTINGS_DEFAULTS };
  }
}

export function saveLabelSettings(partial = {}) {
  if (typeof window === 'undefined') return;
  try {
    if (partial.pitchMm !== undefined) {
      window.localStorage.setItem(
        LABEL_SETTINGS_KEYS.pitchMm,
        String(clampNumber(partial.pitchMm, 12, 30, 12))
      );
    }
    if (partial.offsetX !== undefined) {
      window.localStorage.setItem(
        LABEL_SETTINGS_KEYS.offsetX,
        String(clampNumber(partial.offsetX, -6, 6, 0))
      );
    }
    if (partial.offsetY !== undefined) {
      window.localStorage.setItem(
        LABEL_SETTINGS_KEYS.offsetY,
        String(clampNumber(partial.offsetY, -6, 6, 0))
      );
    }
    if (partial.continuous !== undefined) {
      window.localStorage.setItem(LABEL_SETTINGS_KEYS.continuous, partial.continuous ? '1' : '0');
    }
  } catch {}
}

export function useLabelSettings() {
  const [settings, setSettings] = useState(() => getLabelSettings());

  useEffect(() => {
    setSettings(getLabelSettings());
  }, []);

  const updateSettings = useCallback((partial) => {
    saveLabelSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return [settings, updateSettings];
}

export default useLabelSettings;
