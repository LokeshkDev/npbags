'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(499);

  // Initialize cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('storefront_cart');
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch (e) {
      setCart([]);
    }

    // Fetch delivery settings for free delivery threshold
    fetch('http://localhost:5000/api/cms/delivery-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.data && data.data.free_delivery_threshold) {
          setFreeShippingThreshold(parseFloat(data.data.free_delivery_threshold));
        }
      })
      .catch(() => {});
  }, []);

  const saveCart = (newCart) => {
    setCart(newCart);
    try {
      localStorage.setItem('storefront_cart', JSON.stringify(newCart));
    } catch (e) {}
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 2800);
  };

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen(prev => !prev);

  const addToCart = (product, options = {}) => {
    const qtyToAdd = typeof options === 'number' ? options : (options.qty || 1);
    const size = (typeof options === 'object' && options.size) || (product.sizes && product.sizes[0]) || '';
    const color = (typeof options === 'object' && options.color) || (product.colors && product.colors[0] ? product.colors[0].name : '');
    const image = (typeof options === 'object' && options.image) || product.primary_image || (product.images && product.images[0]) || (product.gallery && product.gallery[0]) || (product.colors && product.colors[0]?.img) || product.image || '';

    const price = product.sale_price > 0 && product.sale_price < product.price
      ? parseFloat(product.sale_price)
      : parseFloat(product.price);

    const existingIndex = cart.findIndex(
      item => item.id === product.id && item.size === size && item.color === color
    );

    let updatedCart;
    if (existingIndex > -1) {
      updatedCart = [...cart];
      updatedCart[existingIndex].qty += qtyToAdd;
    } else {
      updatedCart = [
        ...cart,
        {
          id: product.id,
          slug: product.slug || product.id,
          name: product.name,
          price,
          originalPrice: parseFloat(product.price),
          size,
          color,
          image,
          qty: qtyToAdd
        }
      ];
    }

    saveCart(updatedCart);
    showToast(`${product.name} added to your bag`);
    openCart();
  };

  const updateQty = (index, newQty) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const updated = [...cart];
    updated[index].qty = newQty;
    saveCart(updated);
  };

  const removeFromCart = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  return (
    <CartContext.Provider
      value={{
        cart,
        count,
        subtotal,
        freeShippingThreshold,
        remainingForFreeShipping,
        freeShippingProgress,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
        addToCart,
        updateQty,
        removeFromCart,
        clearCart,
        toast,
        showToast
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

