'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Shared, persisted settings for the 50×12mm jewellery tag print engine.
 * Kept in localStorage so every print entry point (Barcodes, Products,
 * Vendors) uses the same calibration.
 */
export const LABEL_SETTINGS_KEYS = {
  pitchMm: 'npgrand_jewel_pitch_mm',
  offsetX: 'npgrand_jewel_offset_x',
  offsetY: 'npgrand_jewel_offset_y',
  continuous: 'npgrand_jewel_continuous',
  normalOffsetY: 'npgrand_normal_offset_y',
  normalOffsetX: 'npgrand_normal_offset_x',
  normalHeaderPreset: 'npgrand_normal_header_preset'
};

export const LABEL_SETTINGS_DEFAULTS = {
  pitchMm: 12.4, // 12mm label height + 0.4mm physical gap between stickers
  offsetX: 0,
  offsetY: 0,
  continuous: true,
  normalOffsetY: 7.0, // 7.0mm top offset to print below pre-printed 'NP SIGNATURE' header
  normalOffsetX: 0,
  normalHeaderPreset: 'preprinted'
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
    const storedNormalY = window.localStorage.getItem(LABEL_SETTINGS_KEYS.normalOffsetY);
    const storedNormalX = window.localStorage.getItem(LABEL_SETTINGS_KEYS.normalOffsetX);
    const storedNormalPreset = window.localStorage.getItem(LABEL_SETTINGS_KEYS.normalHeaderPreset);

    // If not set or stored as legacy 12mm without gap, update to 12.4mm (12mm tag + 0.4mm gap)
    const effectivePitch = (storedPitch === null || storedPitch === '12') ? 12.4 : clampNumber(storedPitch, 12, 30, 12.4);
    return {
      pitchMm: effectivePitch,
      offsetX: clampNumber(storedX, -6, 6, 0),
      offsetY: clampNumber(storedY, -6, 6, 0),
      continuous: storedContinuous === null ? LABEL_SETTINGS_DEFAULTS.continuous : storedContinuous === '1',
      normalOffsetY: storedNormalY === null ? LABEL_SETTINGS_DEFAULTS.normalOffsetY : clampNumber(storedNormalY, 0, 15, LABEL_SETTINGS_DEFAULTS.normalOffsetY),
      normalOffsetX: clampNumber(storedNormalX, -5, 5, 0),
      normalHeaderPreset: storedNormalPreset || LABEL_SETTINGS_DEFAULTS.normalHeaderPreset
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
    if (partial.normalOffsetY !== undefined) {
      window.localStorage.setItem(
        LABEL_SETTINGS_KEYS.normalOffsetY,
        String(clampNumber(partial.normalOffsetY, 0, 15, 7.0))
      );
    }
    if (partial.normalOffsetX !== undefined) {
      window.localStorage.setItem(
        LABEL_SETTINGS_KEYS.normalOffsetX,
        String(clampNumber(partial.normalOffsetX, -5, 5, 0))
      );
    }
    if (partial.normalHeaderPreset !== undefined) {
      window.localStorage.setItem(LABEL_SETTINGS_KEYS.normalHeaderPreset, String(partial.normalHeaderPreset));
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
