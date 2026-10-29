'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const POSModalContext = createContext({
  isPOSOpen: false,
  editingOrder: null,
  openPOS: (orderToEdit = null) => {},
  closePOS: () => {},
  togglePOS: () => {},
  setEditingOrder: () => {}
});

export function POSModalProvider({ children }) {
  const [isPOSOpen, setIsPOSOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);

  const openPOS = useCallback((orderToEdit = null) => {
    setEditingOrder(orderToEdit || null);
    setIsPOSOpen(true);
  }, []);

  const closePOS = useCallback(() => {
    setEditingOrder(null);
    setIsPOSOpen(false);
  }, []);

  const togglePOS = useCallback(() => {
    setIsPOSOpen(prev => {
      if (prev) setEditingOrder(null);
      return !prev;
    });
  }, []);

  // Keyboard shortcut: ESC to close POS popup
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isPOSOpen) {
        closePOS();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPOSOpen, closePOS]);

  return (
    <POSModalContext.Provider value={{ isPOSOpen, editingOrder, openPOS, closePOS, togglePOS, setEditingOrder }}>
      {children}
    </POSModalContext.Provider>
  );
}

export function usePOSModal() {
  const context = useContext(POSModalContext);
  if (!context) {
    throw new Error('usePOSModal must be used within a POSModalProvider');
  }
  return context;
}

export default POSModalContext;
