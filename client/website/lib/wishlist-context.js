'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [wishlist, setWishlist] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('storefront_wishlist');
      if (saved) {
        setWishlist(JSON.parse(saved));
      }
    } catch (e) {
      setWishlist([]);
    }
  }, []);

  const saveWishlist = (newList) => {
    setWishlist(newList);
    try {
      localStorage.setItem('storefront_wishlist', JSON.stringify(newList));
    } catch (e) {}
  };

  const toggleWishlist = (product) => {
    const exists = wishlist.some(item => item.id === product.id);
    let updated;
    if (exists) {
      updated = wishlist.filter(item => item.id !== product.id);
    } else {
      updated = [...wishlist, product];
    }
    saveWishlist(updated);
  };

  const isInWishlist = (productId) => {
    return wishlist.some(item => item.id === productId);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistCount: wishlist.length,
        toggleWishlist,
        isInWishlist
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}

