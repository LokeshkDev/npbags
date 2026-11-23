'use client';

import React, { useEffect, useRef, useId } from 'react';
import { Icon } from './Icons';

const openModalCloseFns = [];

function emitTopmostModalClose() {
  const top = openModalCloseFns[openModalCloseFns.length - 1];
  if (!top) return;
  const idx = openModalCloseFns.lastIndexOf(top);
  if (idx >= 0) openModalCloseFns.splice(idx, 1);
  top();
}

export function Modal({ isOpen, onClose, title, children, maxWidth = '640px', maxHeight, height, fullScreen = true }) {
  const titleId = React.useId().replace(/[^a-zA-Z0-9-_]/g, '');
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => onCloseRef.current?.();
    openModalCloseFns.push(close);
    return () => {
      const idx = openModalCloseFns.indexOf(close);
      if (idx >= 0) openModalCloseFns.splice(idx, 1);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      emitTopmostModalClose();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement;
    const focusTimer = setTimeout(() => {
      if (panelRef.current) {
        panelRef.current.focus();
        const focusables = panelRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusables[0];
        if (first && typeof first.focus === 'function') first.focus();
      }
    }, 30);
    return () => {
      clearTimeout(focusTimer);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch (err) { /* restore focus */ }
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={fullScreen ? 'modal-dialog modal-dialog--fullscreen' : 'modal-dialog'}
        style={fullScreen ? { position: 'fixed', inset: 0, width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100%', borderRadius: 0 } : { maxWidth, ...(maxHeight ? { maxHeight } : {}), ...(height ? { height } : {}) }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
