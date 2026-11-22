'use client';

import React, { useRef, useState } from 'react';
import { Icon } from './Icons';
import { CameraCaptureModal } from './CameraCaptureModal';
import { compressImageFile } from '../lib/imageCapture';

export function ImageUploader({
  label = 'Upload Image',
  currentImage = '',
  onFileSelect,
  enableCamera = true
}) {
  const [preview, setPreview] = useState(currentImage);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const applyFile = async (file) => {
    if (!file) return;
    setProcessing(true);
    try {
      const prepared = await compressImageFile(file);
      const objectUrl = URL.createObjectURL(prepared);
      setPreview(objectUrl);
      if (onFileSelect) onFileSelect(prepared);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    applyFile(file);
    e.target.value = '';
  };

  const handleCaptured = (file) => {
    applyFile(file);
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '8px',
            border: '1px dashed var(--line)',
            background: '#fafbfc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="image" size={28} style={{ color: 'var(--muted)' }} />
          )}
        </div>

        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="upload" size={16} />
              <span>{processing ? 'Preparing…' : 'Choose File'}</span>
            </button>

            {enableCamera && (
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setCameraOpen(true)}
                disabled={processing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon name="camera" size={16} />
                <span>Take Photo</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            Supports PNG, JPEG, WebP (Max 10MB) · Photos are optimised automatically
          </div>
        </div>
      </div>

      {enableCamera && (
        <CameraCaptureModal
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCaptured}
        />
      )}
    </div>
  );
}

export default ImageUploader;
