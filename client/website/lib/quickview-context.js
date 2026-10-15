'use client';

import React, { createContext, useContext, useState } from 'react';

const QuickViewContext = createContext(null);

export function QuickViewProvider({ children }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  const openQuickView = (product) => {
    setSelectedProduct(product);
  };

  const closeQuickView = () => {
    setSelectedProduct(null);
  };

  return (
    <QuickViewContext.Provider
      value={{
        selectedProduct,
        openQuickView,
        closeQuickView
      }}
    >
      {children}
    </QuickViewContext.Provider>
  );
}

export function useQuickView() {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error('useQuickView must be used within a QuickViewProvider');
  return ctx;
}

