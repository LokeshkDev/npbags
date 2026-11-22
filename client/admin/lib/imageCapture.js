'use client';

/**
 * Shared helpers for capturing photos from a webcam / phone camera and
 * preparing them for the existing multipart upload endpoints.
 */

export function isSecureCameraContext() {
  if (typeof window === 'undefined') return false;
  const host = window.location?.hostname || '';
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return Boolean(window.isSecureContext) || isLocalhost;
}

export function isCameraSupported() {
  if (typeof navigator === 'undefined') return false;
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile|windows phone/i.test(navigator.userAgent || '');
}

export function getCameraErrorMessage(error) {
  const name = error?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in your browser, or upload a photo instead.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. You can upload a photo instead.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app. Close it and try again.';
    case 'OverconstrainedError':
      return 'The requested camera is not available. Try switching cameras.';
    case 'SecurityError':
      return 'Camera access requires HTTPS. Open the admin panel over HTTPS or use file upload.';
    default:
      return error?.message || 'Could not open the camera. Please try again or upload a photo.';
  }
}

function makeFileName(originalName = 'photo', ext = '.jpg') {
  const base = String(originalName).replace(/\.[^.]+$/, '') || 'photo';
  return `${base}-${Date.now()}${ext}`;
}

function fitWithin(width, height, maxDim) {
  if (!width || !height) return { width: 0, height: 0 };
  if (width <= maxDim && height <= maxDim) return { width, height };
  const ratio = Math.min(maxDim / width, maxDim / height);
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.88) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the captured image.'))),
      type,
      quality
    );
  });
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the HTMLImageElement path below.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read.'));
    };
    img.src = url;
  });
}

/**
 * Downscale/compress a picked image so phone photos stay under the server's
 * 10MB multipart limit. SVG/GIF are passed through untouched.
 */
export async function compressImageFile(file, { maxDim = 1600, quality = 0.88 } = {}) {
  if (!file || typeof document === 'undefined') return file;
  const type = file.type || '';
  if (!type.startsWith('image/') || type === 'image/svg+xml' || type === 'image/gif') {
    return file;
  }

  try {
    const bitmap = await loadBitmap(file);
    const sourceW = bitmap.width || bitmap.naturalWidth || 0;
    const sourceH = bitmap.height || bitmap.naturalHeight || 0;
    const { width, height } = fitWithin(sourceW, sourceH, maxDim);
    if (!width || !height) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (typeof bitmap.close === 'function') bitmap.close();

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    if (blob.size >= file.size && type === 'image/jpeg') {
      return file;
    }
    return new File([blob], makeFileName(file.name, '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

/**
 * Grab the current video frame as a compressed JPEG File.
 */
export async function captureVideoFrame(video, { maxDim = 1600, quality = 0.88 } = {}) {
  if (!video || typeof document === 'undefined') {
    throw new Error('Camera preview is not ready yet.');
  }
  const sourceW = video.videoWidth || 0;
  const sourceH = video.videoHeight || 0;
  if (!sourceW || !sourceH) {
    throw new Error('Camera preview is not ready yet.');
  }

  const { width, height } = fitWithin(sourceW, sourceH, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not capture the photo.');
  ctx.drawImage(video, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return new File([blob], makeFileName('camera', '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now()
  });
}
