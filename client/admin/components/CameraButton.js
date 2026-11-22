'use client';

import React, { useState } from 'react';
import { Icon } from './Icons';
import { CameraCaptureModal } from './CameraCaptureModal';
import { compressImageFile } from '../lib/imageCapture';

/**
 * Drop-in camera capture button for places that already have a raw
 * <input type="file">. Emits a compressed File through onFileSelect.
 */
export function CameraButton({
  onFileSelect,
  label = 'Take Photo',
  title = 'Capture photo with webcam / phone',
  disabled = false,
  maxDim = 1800,
  className = 'admin-btn admin-btn-outline',
  style,
  iconOnly = false,
  children
}) {
  const [open, setOpen] = useState(false);

  const handleCapture = async (file) => {
    if (!file) return;
    const prepared = await compressImageFile(file, { maxDim });
    onFileSelect?.(prepared);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={title}
        aria-label={title}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...style }}
      >
        <Icon name="camera" size={14} />
        {!iconOnly && <span>{children || label}</span>}
      </button>

      <CameraCaptureModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCapture={handleCapture}
        title={title}
      />
    </>
  );
}

export default CameraButton;
