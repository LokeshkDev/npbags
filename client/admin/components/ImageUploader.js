'use client';

import React, { useState, useRef } from 'react';
import { Icon } from './Icons';

export function ImageUploader({ label = 'Upload Image', currentImage = '', onFileSelect }) {
  const [preview, setPreview] = useState(currentImage);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      if (onFileSelect) onFileSelect(file);
    }
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
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="upload" size={16} />
            <span>Choose File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            Supports PNG, JPEG, WebP (Max 5MB)
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImageUploader;
