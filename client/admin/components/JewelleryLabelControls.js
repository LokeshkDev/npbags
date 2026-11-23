'use client';

import React from 'react';
import { useLabelSettings } from '../lib/labelSettings';
import { printJewelleryCalibration } from '../lib/barcodeLabel';

const OFFSET_Y_STEPS = [-5, -3, -1, 0, 0.5, 1, 2, 3, 5];
const OFFSET_X_STEPS = [-3, -1.5, -0.5, 0, 0.5, 1.5, 3];

function formatStep(step) {
  if (step === 0) return '0mm';
  return `${step > 0 ? '+' : ''}${step}mm`;
}

function StepButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '3px 9px',
        borderRadius: '5px',
        border: active ? '1.5px solid #b45309' : '1px solid #cbd5e1',
        background: active ? '#b45309' : '#fff',
        color: active ? '#fff' : '#334155',
        fontWeight: 800,
        fontSize: '11px',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}

/**
 * Shared 80×12mm jewellery tag calibration panel.
 * Used by Barcodes, Products and Vendors so every print entry point shares
 * the same pitch / offset / continuous-strip settings.
 */
export function JewelleryLabelControls({ style, showCalibration = true }) {
  const [settings, updateSettings] = useLabelSettings();

  return (
    <div
      style={{
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: '7px',
        padding: '10px 12px',
        fontSize: '11.5px',
        color: '#92400e',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <span>
          <strong>Tag calibration:</strong> nudge content, set the real feed pitch, or use continuous mode if tags drift after the first.
        </span>
        <span style={{ fontSize: '11px', fontWeight: 800, background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
          X: {formatStep(settings.offsetX)} · Y: {formatStep(settings.offsetY)} · Pitch: {settings.pitchMm}mm
        </span>
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '7px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 800 }}>Y nudge:</span>
        {OFFSET_Y_STEPS.map((step) => (
          <StepButton
            key={`y-${step}`}
            active={settings.offsetY === step}
            onClick={() => updateSettings({ offsetY: step })}
          >
            {formatStep(step)}
          </StepButton>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 800 }}>X nudge:</span>
        {OFFSET_X_STEPS.map((step) => (
          <StepButton
            key={`x-${step}`}
            active={settings.offsetX === step}
            onClick={() => updateSettings({ offsetX: step })}
          >
            {formatStep(step)}
          </StepButton>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#92400e' }}>Label pitch / feed (mm):</label>
        <input
          type="number"
          min="12"
          max="30"
          step="0.1"
          value={settings.pitchMm}
          onChange={(e) => {
            const v = Number(e.target.value);
            const next = Number.isFinite(v) ? Math.max(12, Math.min(30, v)) : 12.4;
            updateSettings({ pitchMm: next });
          }}
          style={{ width: '74px', padding: '3px 6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: '12px' }}
        />
        <button
          type="button"
          onClick={() => updateSettings({ pitchMm: 12.4 })}
          style={{
            padding: '2px 8px',
            borderRadius: '5px',
            border: settings.pitchMm === 12.4 ? '1.5px solid #b45309' : '1px solid #cbd5e1',
            background: settings.pitchMm === 12.4 ? '#b45309' : '#fff',
            color: settings.pitchMm === 12.4 ? '#fff' : '#334155',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          12.4mm (Default: 12mm Tag + 0.4mm Gap)
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ pitchMm: 12.0 })}
          style={{
            padding: '2px 8px',
            borderRadius: '5px',
            border: settings.pitchMm === 12.0 ? '1.5px solid #b45309' : '1px solid #cbd5e1',
            background: settings.pitchMm === 12.0 ? '#b45309' : '#fff',
            color: settings.pitchMm === 12.0 ? '#fff' : '#334155',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          12.0mm
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.continuous}
            onChange={(e) => updateSettings({ continuous: e.target.checked })}
            style={{ width: '14px', height: '14px' }}
          />
          Continuous strip (one long page)
        </label>
        {showCalibration && (
          <button
            type="button"
            onClick={() => printJewelleryCalibration({ count: 10 })}
            style={{
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid #b45309',
              background: '#fff',
              color: '#b45309',
              fontWeight: 800,
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Print calibration test (10 tags)
          </button>
        )}
      </div>

      <div style={{ fontSize: '10.5px', color: '#78350f', marginTop: '7px' }}>
        In the print dialog choose <strong>Margins: None</strong> and <strong>Scale: 100%</strong> (disable “Fit to page”).
      </div>
    </div>
  );
}

export default JewelleryLabelControls;
