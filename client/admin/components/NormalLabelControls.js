'use client';

import React from 'react';
import { useLabelSettings } from '../lib/labelSettings';

const OFFSET_Y_STEPS = [0.5, 5.0, 6.0, 6.5, 7.0, 7.5, 8.0, 9.0];
const OFFSET_X_STEPS = [-2, -1, 0, 1, 2];

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
        padding: '3px 8px',
        borderRadius: '5px',
        border: active ? '1.5px solid #1d4ed8' : '1px solid #cbd5e1',
        background: active ? '#1d4ed8' : '#fff',
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
 * Shared 35×25mm 3-Up normal sticker calibration panel.
 * Allows instant 1-click alignment for pre-printed rolls (NP SIGNATURE header)
 * or plain white sticker rolls, with live X/Y nudging.
 */
export function NormalLabelControls({ style }) {
  const [settings, updateSettings] = useLabelSettings();
  const currentY = settings.normalOffsetY !== undefined ? Number(settings.normalOffsetY) : 7.0;
  const currentX = settings.normalOffsetX !== undefined ? Number(settings.normalOffsetX) : 0;
  const isPreprinted = Math.abs(currentY - 7.0) <= 1.2;

  return (
    <div
      style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '7px',
        padding: '10px 12px',
        fontSize: '11.5px',
        color: '#166534',
        ...style
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <span>
          <strong>35×25mm Sticker Roll Alignment:</strong> Adjust top margin so barcodes print cleanly below your pre-printed header.
        </span>
        <span style={{ fontSize: '11px', fontWeight: 800, background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
          Top Margin: {currentY}mm · Nudge X: {formatStep(currentX)}
        </span>
      </div>

      {/* Preset Buttons */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => updateSettings({ normalOffsetY: 7.0, normalHeaderPreset: 'preprinted' })}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: isPreprinted ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
            background: isPreprinted ? '#16a34a' : '#ffffff',
            color: isPreprinted ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: '11px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          🏷️ Pre-printed Header (NP SIGNATURE) · 7.0mm
        </button>

        <button
          type="button"
          onClick={() => updateSettings({ normalOffsetY: 0.5, normalHeaderPreset: 'plain' })}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: currentY < 2.0 ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
            background: currentY < 2.0 ? '#16a34a' : '#ffffff',
            color: currentY < 2.0 ? '#ffffff' : '#334155',
            fontWeight: 800,
            fontSize: '11px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          ⬜ Plain White Sticker (No Header) · 0.5mm
        </button>
      </div>

      {/* Fine-tuning Y nudge */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 800 }}>Top offset:</span>
        {OFFSET_Y_STEPS.map((step) => (
          <StepButton
            key={`ny-${step}`}
            active={Math.abs(currentY - step) < 0.05}
            onClick={() => updateSettings({ normalOffsetY: step })}
          >
            {step}mm
          </StepButton>
        ))}
        <input
          type="number"
          min="0"
          max="15"
          step="0.1"
          value={currentY}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (Number.isFinite(val)) updateSettings({ normalOffsetY: Math.max(0, Math.min(15, val)) });
          }}
          style={{
            width: '60px',
            padding: '2px 5px',
            borderRadius: '4px',
            border: '1px solid #cbd5e1',
            fontSize: '11px',
            fontWeight: 800,
            textAlign: 'center'
          }}
          title="Manual millimeter top margin"
        />
      </div>

      {/* X nudge */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 800 }}>X nudge:</span>
        {OFFSET_X_STEPS.map((step) => (
          <StepButton
            key={`nx-${step}`}
            active={currentX === step}
            onClick={() => updateSettings({ normalOffsetX: step })}
          >
            {formatStep(step)}
          </StepButton>
        ))}
      </div>
    </div>
  );
}

export default NormalLabelControls;
