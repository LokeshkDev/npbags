'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';
import {
  captureVideoFrame,
  getCameraErrorMessage,
  isCameraSupported,
  isMobileDevice,
  isSecureCameraContext
} from '../lib/imageCapture';

/**
 * Full-screen webcam capture dialog.
 * - Desktop: live getUserMedia preview with capture + camera switch.
 * - Phone: same preview, plus a "Use phone camera" button that opens the
 *   native camera app through a capture-enabled file input.
 */
export function CameraCaptureModal({ isOpen, onClose, onCapture, title = 'Take Photo' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeInputRef = useRef(null);

  const [facingMode, setFacingMode] = useState('environment');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [capturedFile, setCapturedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async (facing) => {
    setError('');
    setStarting(true);
    stopStream();

    if (!isSecureCameraContext()) {
      setError('Camera access requires HTTPS. Open the admin panel over HTTPS, or use file upload.');
      setStarting(false);
      return;
    }
    if (!isCameraSupported()) {
      setError('This browser does not support direct camera capture. Use file upload instead.');
      setStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setError(getCameraErrorMessage(err));
      stopStream();
    } finally {
      setStarting(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedFile(null);
      setPreviewUrl('');
      setError('');
      return;
    }
    setCapturedFile(null);
    setPreviewUrl('');
    startCamera(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    setError('');
    try {
      const file = await captureVideoFrame(videoRef.current);
      setCapturedFile(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setError(err.message || 'Could not capture the photo.');
    } finally {
      setCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    startCamera(facingMode);
  };

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setCapturedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    startCamera(next);
  };

  const handleUsePhoto = () => {
    if (!capturedFile) return;
    onCapture?.(capturedFile);
    stopStream();
    onClose?.();
  };

  const handleNativeFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      onCapture?.(file);
      stopStream();
      onClose?.();
    }
    e.target.value = '';
  };

  if (!isOpen) return null;

  const showNativeButton = isMobileDevice() || Boolean(error);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 12000,
        padding: '16px'
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          background: '#0f172a',
          color: '#f8fafc',
          borderRadius: '14px',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '15px' }}>
            <Icon name="camera" size={18} />
            <span>{title}</span>
          </div>
          <button
            type="button"
            onClick={() => { stopStream(); onClose?.(); }}
            aria-label="Close camera"
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: '4px' }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div style={{ position: 'relative', background: '#000000', aspectRatio: '4 / 3', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {capturedFile && previewUrl ? (
            <img src={previewUrl} alt="Captured preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000000' }}
            />
          )}

          {starting && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', fontSize: '13px', fontWeight: 700 }}>
              Starting camera…
            </div>
          )}
        </div>

        {error && (
          <div style={{ margin: '12px 18px 0', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', lineHeight: 1.45 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '16px 18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!capturedFile && (
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={handleSwitchCamera}
                disabled={starting || Boolean(error)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
              >
                <Icon name="cameraSwitch" size={16} />
                <span>Switch Camera</span>
              </button>
            )}

            {showNativeButton && (
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => nativeInputRef.current?.click()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#1e293b', color: '#e2e8f0', borderColor: '#334155' }}
              >
                <Icon name="camera" size={16} />
                <span>Phone Camera</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            {capturedFile ? (
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={handleRetake}
                  style={{ background: 'transparent', color: '#e2e8f0', borderColor: '#475569' }}
                >
                  Retake
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleUsePhoto}
                >
                  Use Photo
                </button>
              </>
            ) : (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={handleCapture}
                disabled={starting || capturing || Boolean(error)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '130px', justifyContent: 'center' }}
              >
                <Icon name="camera" size={16} />
                <span>{capturing ? 'Capturing…' : 'Capture'}</span>
              </button>
            )}
          </div>
        </div>

        <input
          ref={nativeInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleNativeFile}
        />
      </div>
    </div>
  );
}

export default CameraCaptureModal;
