'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePOSModal } from '../lib/pos-modal-context';
import useScannerInput from '../hooks/useScannerInput';
import {
  lookupBarcode,
  createAdminPOSOrder,
  updateAdminPOSOrderItems,
  getAdminStoreSettings,
  getAdminProducts,
  lookupCustomerByPhone,
  getAdminSalespersons,
  createAdminSalesperson,
  updateAdminSalesperson,
  deleteAdminSalesperson
} from '../lib/api';

export function POSBillingModal() {
  const { isPOSOpen, closePOS, editingOrder, setEditingOrder } = usePOSModal();

  const [cart, setCart] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: '' }

  // Autocomplete suggestions
  const [allProducts, setAllProducts] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Custom Product modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: '',
    mrp: '',
    price: '',
    quantity: 1
  });

  // Customer info
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerFoundBadge, setCustomerFoundBadge] = useState(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card'
  const [receivedAmount, setReceivedAmount] = useState('');
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [discountInput, setDiscountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sales Staff Attribution
  const [salespersons, setSalespersons] = useState([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffCommission, setNewStaffCommission] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffCommission, setEditStaffCommission] = useState('');

  // Completed order & receipt modal
  const [completedOrder, setCompletedOrder] = useState(null);
  const [thermalSettings, setThermalSettings] = useState({
    paperWidth: '80mm', // '80mm' | '58mm'
    copies: 1, // 1 | 2
    density: '300bol', // '300bol' (Pure Black 300 DPI High-Density Bold) | 'standard'
    autoPrint: false
  });
  const [storeSettings, setStoreSettings] = useState({
    store_name: 'NP Grand Shopping',
    phone: '+91 97909 04504',
    address: 'Madambakkam Main Road, Chennai 600073',
    website: 'https://www.npgrandshopping.com'
  });

  // Sync fixed thermal printer settings from localStorage
  useEffect(() => {
    const loadSavedSettings = () => {
      try {
        const saved = localStorage.getItem('np_thermal_settings');
        if (saved) {
          setThermalSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
        }
      } catch (e) {}
    };

    loadSavedSettings();
    window.addEventListener('np_thermal_settings_updated', loadSavedSettings);
    return () => window.removeEventListener('np_thermal_settings_updated', loadSavedSettings);
  }, []);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const customerPhoneInputRef = useRef(null);

  // Load sales staff members
  const loadSalesStaff = () => {
    getAdminSalespersons()
      .then(data => {
        if (Array.isArray(data)) {
          setSalespersons(data);
          if (data.length > 0 && !selectedSalespersonId) {
            setSelectedSalespersonId(String(data[0].id));
          }
        }
      })
      .catch(() => {});
  };

  // Load catalog products for POS search & autocomplete
  const loadCatalogProducts = () => {
    getAdminProducts({ limit: 500 })
      .then(res => {
        const list = res?.products || res?.data?.products || (Array.isArray(res) ? res : []);
        if (Array.isArray(list) && list.length > 0) {
          setAllProducts(list);
        }
      })
      .catch(err => {
        console.warn('Could not load products for POS:', err);
      });
  };

  // Keyboard Autofocus: User instructed to FIRST focus keyboard on customer phone number
  useEffect(() => {
    if (isPOSOpen) {
      loadSalesStaff();
      loadCatalogProducts();
      setTimeout(() => {
        if (customerPhoneInputRef.current) {
          customerPhoneInputRef.current.focus();
          customerPhoneInputRef.current.select();
        }
      }, 120);
    }
  }, [isPOSOpen]);

  // Pre-populate bill data when opened in Edit Mode
  useEffect(() => {
    if (editingOrder) {
      setCustomerName(editingOrder.customer_name || 'Walk-in Customer');
      setCustomerPhone(editingOrder.customer_phone || '');
      setCustomerEmail(editingOrder.customer_email || '');
      setPaymentMethod(editingOrder.payment_method || 'Cash');
      setDiscountType(editingOrder.discount_type || 'flat');
      setDiscountInput(
        editingOrder.discount_value !== undefined && editingOrder.discount_value !== null
          ? String(editingOrder.discount_value)
          : (editingOrder.discount ? String(editingOrder.discount) : '')
      );
      if (editingOrder.sales_person_id) {
        setSelectedSalespersonId(String(editingOrder.sales_person_id));
      }
      setReceivedAmount(editingOrder.received_amount ? String(editingOrder.received_amount) : '');

      const parsedItems = Array.isArray(editingOrder.items)
        ? editingOrder.items.map(item => ({
            product_id: item.product_id || item.id,
            product_name: item.product_name || item.name,
            barcode: item.barcode || `NP-${item.product_id || item.id}`,
            barcode_short_name: item.product_name || item.name,
            price: Number(item.price) || 0,
            regular_price: Number(item.price) || 0,
            image: item.image || item.image_url || null,
            variant: item.sku ? { sku: item.sku, size: item.size, color: item.color } : null,
            sales_person_id: item.sales_person_id ? String(item.sales_person_id) : (editingOrder.sales_person_id ? String(editingOrder.sales_person_id) : ''),
            sales_person_name: item.sales_person_name || editingOrder.sales_person_name || null,
            quantity: Number(item.quantity) || 1,
            stock_quantity: 50
          }))
        : [];
      setCart(parsedItems);
      setCompletedOrder(null);
      showToast(`Editing Bill #${editingOrder.order_number || editingOrder.id}`, 'info', 3000);
    }
  }, [editingOrder]);

  // Load store settings and catalog products on mount for instant autocomplete
  useEffect(() => {
    getAdminStoreSettings()
      .then(res => {
        if (res) {
          setStoreSettings(prev => ({
            ...prev,
            store_name: res.store_name || prev.store_name,
            phone: res.phone || prev.phone,
            address: res.address || prev.address
          }));
        }
      })
      .catch(() => {});

    getAdminProducts({ limit: 250 })
      .then(res => {
        const list = res?.products || res || [];
        if (Array.isArray(list)) setAllProducts(list);
      })
      .catch(() => {});
  }, []);

  // Show status notification
  const showToast = (text, type = 'info', duration = 2500) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, duration);
  };

  // Autocomplete Suggestions computation (instant live trigger on typing or fast picks on focus)
  const suggestions = useMemo(() => {
    if (!searchInput || !searchInput.trim()) {
      return allProducts.slice(0, 8).map(p => ({
        product: p,
        matchedVariant: null
      }));
    }
    const q = searchInput.trim().toLowerCase();

    const matches = [];
    for (const p of allProducts) {
      const pName = (p.name || '').toLowerCase();
      const pBarcode = (p.barcode || '').toLowerCase();
      const pShort = (p.barcode_short_name || '').toLowerCase();
      const pCat = (p.category_name || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      const pSlug = (p.slug || '').toLowerCase();
      const pId = String(p.id || '').toLowerCase();

      let matchedVariant = null;
      if (Array.isArray(p.variants)) {
        matchedVariant = p.variants.find(v =>
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          (v.color_name && v.color_name.toLowerCase().includes(q)) ||
          (v.size_name && v.size_name.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q))
        );
      }

      if (
        pName.includes(q) ||
        pBarcode.includes(q) ||
        pShort.includes(q) ||
        pCat.includes(q) ||
        pSku.includes(q) ||
        pSlug.includes(q) ||
        pId.includes(q) ||
        matchedVariant
      ) {
        matches.push({
          product: p,
          matchedVariant
        });
      }

      if (matches.length >= 15) break;
    }
    return matches;
  }, [allProducts, searchInput]);

  // Click outside suggestions dropdown listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Customer Phone Lookup Effect (supports raw 10 digits or with +91)
  useEffect(() => {
    const raw = customerPhone.replace(/\D/g, '');
    const clean = raw.length >= 10 ? raw.slice(-10) : raw;
    if (clean.length === 10) {
      lookupCustomerByPhone(clean)
        .then(cust => {
          if (cust && cust.name) {
            setCustomerName(cust.name);
            if (cust.email) setCustomerEmail(cust.email);
            setCustomerFoundBadge(cust.name);
            showToast(`Existing Customer Recognized: ${cust.name}`, 'info', 3000);
          } else {
            setCustomerFoundBadge(null);
          }
        })
        .catch(() => setCustomerFoundBadge(null));
    } else {
      setCustomerFoundBadge(null);
    }
  }, [customerPhone]);

  // Add product to cart helper
  const handleAddItemToCart = (item) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(ci =>
        ci.product_id === item.product_id &&
        (ci.variant?.id ? ci.variant.id === item.variant?.id : ci.barcode === item.barcode)
      );

      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      } else {
        return [
          ...prev,
          {
            product_id: item.product_id,
            product_name: item.product_name,
            barcode: item.barcode || `NP-${item.product_id}`,
            barcode_short_name: item.barcode_short_name || item.product_name,
            price: Number(item.price) || 0,
            regular_price: Number(item.regular_price) || Number(item.price) || 0,
            hsn_code: item.hsn_code || '4202',
            image: item.image,
            variant: item.variant || null,
            quantity: Number(item.quantity) || 1,
            stock_quantity: item.stock_quantity !== undefined ? item.stock_quantity : 50
          }
        ];
      }
    });

    showToast(`Added: ${item.product_name} [${item.barcode || 'ITEM'}]`, 'success', 2200);
  };

  // Add Custom Product to cart (Supports Name, MRP, Selling Price, and instant Enter key submit)
  const handleAddCustomProduct = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!customItem.name.trim()) {
      alert('Please enter a product name.');
      return;
    }

    const mrpNum = parseFloat(customItem.mrp) || 0;
    const sellingPriceNum = parseFloat(customItem.price) || (mrpNum > 0 ? mrpNum : 0);

    if (sellingPriceNum <= 0) {
      alert('Please enter a valid selling price or MRP.');
      return;
    }

    const effectiveMrp = mrpNum > 0 ? mrpNum : sellingPriceNum;

    const newItem = {
      product_id: `custom-${Date.now()}`,
      product_name: customItem.name.trim(),
      barcode: `CUSTOM-${Date.now().toString().slice(-4)}`,
      barcode_short_name: customItem.name.trim(),
      price: sellingPriceNum,
      mrp: effectiveMrp,
      regular_price: effectiveMrp,
      quantity: Math.max(1, parseInt(customItem.quantity, 10) || 1),
      variant: null
    };

    handleAddItemToCart(newItem);
    setIsCustomModalOpen(false);
    setCustomItem({ name: '', mrp: '', price: '', quantity: 1 });
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  // Staff Quick-Add Handler
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      showToast('Please enter staff name', 'error');
      return;
    }
    try {
      setSavingStaff(true);
      const res = await createAdminSalesperson({
        name: newStaffName.trim(),
        phone: newStaffPhone.trim() || null,
        commission_rate: newStaffCommission ? parseFloat(newStaffCommission) : 0
      });
      showToast(`Sales staff "${newStaffName.trim()}" added successfully!`, 'success');
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffCommission('');
      loadSalesStaff();
      if (res && res.id) {
        setSelectedSalespersonId(String(res.id));
      }
      setIsStaffModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Failed to add staff', 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  // Staff Edit Handlers
  const startEditStaff = (staff) => {
    setEditingStaffId(staff.id);
    setEditStaffName(staff.name || '');
    setEditStaffPhone(staff.phone || '');
    setEditStaffCommission(staff.commission_percent !== undefined ? String(staff.commission_percent) : (staff.commission_rate !== undefined ? String(staff.commission_rate) : '0'));
  };

  const handleUpdateStaff = async (staffId) => {
    if (!editStaffName.trim()) {
      showToast('Staff name is required', 'error');
      return;
    }
    try {
      setSavingStaff(true);
      await updateAdminSalesperson(staffId, {
        name: editStaffName.trim(),
        phone: editStaffPhone.trim() || null,
        commission_percent: editStaffCommission ? parseFloat(editStaffCommission) : 0
      });
      showToast(`Staff "${editStaffName.trim()}" updated successfully!`, 'success');
      setEditingStaffId(null);
      loadSalesStaff();
    } catch (err) {
      showToast(err.message || 'Failed to update staff', 'error');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (!window.confirm(`Are you sure you want to delete sales staff "${staff.name}"?`)) return;
    try {
      await deleteAdminSalesperson(staff.id);
      showToast(`Sales staff "${staff.name}" deleted.`, 'info');
      if (selectedSalespersonId === String(staff.id)) {
        setSelectedSalespersonId('');
      }
      loadSalesStaff();
    } catch (err) {
      showToast(err.message || 'Failed to delete staff', 'error');
    }
  };

  // Barcode / Scanner Hook Handler
  const handleBarcodeScanned = async (scannedCode) => {
    if (!scannedCode || !scannedCode.trim()) return;
    setSearching(true);
    setShowSuggestions(false);
    try {
      const res = await lookupBarcode(scannedCode.trim());
      if (res) {
        handleAddItemToCart(res);
        setSearchInput('');
      } else {
        showToast(`Barcode not found: ${scannedCode}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err.message || 'Item not found'}`, 'error');
    } finally {
      setSearching(false);
      searchInputRef.current?.focus();
    }
  };

  // Attach hardware scanner hook when POS popup is open
  useScannerInput(handleBarcodeScanned, { enabled: isPOSOpen && !completedOrder });

  // Manual search submit
  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (suggestions.length > 0) {
      const pickIndex = highlightedIndex >= 0 ? highlightedIndex : 0;
      const item = suggestions[pickIndex];
      if (item && item.product) {
        handlePickSuggestion(item.product, item.matchedVariant);
        return;
      }
    }
    if (searchInput.trim()) {
      handleBarcodeScanned(searchInput.trim());
    }
  };

  // Pick an autocomplete suggestion
  const handlePickSuggestion = (prod, variant = null) => {
    const price = variant && variant.price ? variant.price : (prod.sale_price > 0 ? prod.sale_price : prod.price);
    const barcode = variant?.barcode || prod.barcode || `NP-${prod.id}`;

    handleAddItemToCart({
      product_id: prod.id,
      product_name: prod.name,
      barcode: barcode,
      barcode_short_name: prod.barcode_short_name || prod.name,
      price: Number(price) || 0,
      regular_price: Number(prod.price) || Number(price) || 0,
      hsn_code: prod.hsn_code || '4202',
      image: variant?.image_url || prod.image,
      variant: variant || null,
      quantity: 1
    });

    setSearchInput('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    searchInputRef.current?.focus();
  };

  // Cart quantity adjustments
  const updateQuantity = (index, delta) => {
    setCart(prev => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index].quantity = newQty;
      }
      return copy;
    });
  };

  const removeItem = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from current billing cart?')) {
      setCart([]);
      setDiscountInput('');
      setDiscountType('flat');
      setReceivedAmount('');
      customerPhoneInputRef.current?.focus();
    }
  };

  // Cart financial calculations (Flat vs % discount, GST 18% inclusive standard)
  const cartFinancials = useMemo(() => {
    const rawSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const parsedDiscountVal = parseFloat(discountInput) || 0;

    let disc = 0;
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, parsedDiscountVal));
      disc = Math.round(((rawSubtotal * pct) / 100) * 100) / 100;
    } else {
      disc = Math.min(Math.max(0, parsedDiscountVal), rawSubtotal);
    }

    const grandTotal = Math.max(0, rawSubtotal - disc);

    const gstRate = 18;
    const taxableAmount = Math.round((grandTotal / (1 + (gstRate / 100))) * 100) / 100;
    const totalTax = Math.round((grandTotal - taxableAmount) * 100) / 100;
    const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

    const received = Number(receivedAmount) > 0 ? Number(receivedAmount) : 0;
    const changeDue = Math.max(0, received - grandTotal);

    return {
      rawSubtotal,
      discountAmount: disc,
      discountType,
      discountValue: parsedDiscountVal,
      grandTotal,
      taxableAmount,
      totalTax,
      cgstAmount,
      sgstAmount,
      received,
      changeDue
    };
  }, [cart, discountType, discountInput, receivedAmount]);

  // Handle Checkout & Order Submission
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Scan items to begin billing.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const chosenStaff = salespersons.find(s => String(s.id) === String(selectedSalespersonId));
      const payload = {
        customer_name: customerName.trim() || 'Walk-in Customer',
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        payment_method: paymentMethod,
        discount_amount: cartFinancials.discountAmount,
        discount_type: discountType,
        discount_value: cartFinancials.discountValue,
        sales_person_id: chosenStaff ? chosenStaff.id : null,
        sales_person_name: chosenStaff ? chosenStaff.name : null,
        received_amount: paymentMethod === 'Cash' ? (Number(receivedAmount) || cartFinancials.grandTotal) : cartFinancials.grandTotal,
        items: cart.map(item => {
          const itemStaff = item.sales_person_id ? salespersons.find(s => String(s.id) === String(item.sales_person_id)) : chosenStaff;
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            barcode: item.barcode,
            price: item.price,
            quantity: item.quantity,
            sku: item.variant?.sku || null,
            size: item.variant?.size || null,
            color: item.variant?.color || null,
            sales_person_id: itemStaff ? itemStaff.id : null,
            sales_person_name: itemStaff ? itemStaff.name : null,
            image: item.image
          };
        })
      };

      let orderObj = null;
      if (editingOrder && editingOrder.id) {
        // Edit Mode: update existing POS order
        const res = await updateAdminPOSOrderItems(editingOrder.id, payload);
        const updatedData = res?.data || res || editingOrder;
        orderObj = {
          ...editingOrder,
          ...updatedData,
          items: cart,
          store: storeSettings,
          changeDue: cartFinancials.changeDue
        };
        showToast(`Bill #${editingOrder.order_number || editingOrder.id} updated successfully!`, 'success', 3000);
      } else {
        // New Sale Mode: create fresh POS order
        const res = await createAdminPOSOrder(payload);
        orderObj = {
          ...res,
          items: cart,
          store: storeSettings,
          changeDue: cartFinancials.changeDue
        };
      }

      // Broadcast event so recent walk-in tables in /pos and /orders refresh immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('np_order_updated', { detail: orderObj }));
      }

      setCompletedOrder(orderObj);
      setCart([]);
      setDiscountAmount(0);
      setReceivedAmount('');
      if (setEditingOrder) setEditingOrder(null);

      // If auto-print is enabled in fixed thermal settings, trigger print directly
      if (thermalSettings.autoPrint) {
        setTimeout(() => {
          printThermalReceipt(orderObj, thermalSettings);
        }, 250);
      }
    } catch (err) {
      alert(`Checkout failed: ${err.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut listener (F2: search, F4: pay, F7: custom item, F9: clear, ESC: close)
  useEffect(() => {
    if (!isPOSOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleCheckout();
      } else if (e.key === 'F7') {
        e.preventDefault();
        setCustomItem({ name: searchInput.trim() || '', mrp: '', price: '', quantity: 1 });
        setIsCustomModalOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'Escape') {
        if (isStaffModalOpen) {
          setIsStaffModalOpen(false);
        } else if (isCustomModalOpen) {
          setIsCustomModalOpen(false);
        } else if (completedOrder) {
          setCompletedOrder(null);
        } else if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          closePOS();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPOSOpen, cart, cartFinancials, isCustomModalOpen, isStaffModalOpen, completedOrder, showSuggestions, closePOS, searchInput]);

  // Thermal Receipt Printing (Standard ESC/POS HTML) - Pure Solid Black #000000 with 300 Bold Density
  const printThermalReceipt = (orderData, overrideSettings) => {
    const order = orderData || completedOrder;
    if (!order) return;

    const settings = { ...thermalSettings, ...(overrideSettings || {}) };
    const items = order.items || [];
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('en-IN');
    const orderNo = order.order_number || order.order?.order_number || `POS-${Date.now().toString().slice(-6)}`;
    const is58mm = settings.paperWidth === '58mm';
    const bodyWidth = is58mm ? '52mm' : '72mm';
    const fontSize = is58mm ? '10px' : '11.5px';
    const is300Bol = settings.density === '300bol';

    const renderReceiptBody = (copyLabel = 'CUSTOMER COPY') => `
      <div class="receipt-section">
        <div class="center">
          <div class="store-title">${storeSettings.store_name}</div>
          <div class="subtext">${storeSettings.address}</div>
          <div class="subtext">Phone: ${storeSettings.phone}</div>
          <div class="subtext">${storeSettings.website}</div>
          <div class="divider"></div>
          <div class="bold" style="font-size: 12px; letter-spacing: 0.5px;">TAX INVOICE / POS RECEIPT</div>
          <div class="subtext bold" style="font-size: 10px; margin-top: 2px;">[ ${copyLabel} ]</div>
        </div>

        <div class="divider"></div>
        <div class="flex-row"><span>Bill No:</span><span class="bold">${orderNo}</span></div>
        <div class="flex-row"><span>Date:</span><span class="bold">${dateStr}</span></div>
        <div class="flex-row"><span>Customer:</span><span class="bold">${order.customer_name || customerName}</span></div>
        ${(order.customer_phone || customerPhone) ? `<div class="flex-row"><span>Phone:</span><span class="bold">${order.customer_phone || customerPhone}</span></div>` : ''}
        ${(order.sales_person_name || salespersons.find(s => String(s.id) === String(selectedSalespersonId))?.name) ? `<div class="flex-row"><span>Sales Staff:</span><span class="bold">${order.sales_person_name || salespersons.find(s => String(s.id) === String(selectedSalespersonId))?.name}</span></div>` : ''}
        <div class="flex-row"><span>Payment:</span><span class="bold">${(order.payment_method || paymentMethod).toUpperCase()}</span></div>
        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 46%;">ITEM</th>
              <th style="width: 14%;" class="right">QTY</th>
              <th style="width: 20%;" class="right">PRICE</th>
              <th style="width: 20%;" class="right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td>
                  <div class="bold">${it.product_name}</div>
                  <div class="subtext">[${it.barcode}]</div>
                </td>
                <td class="right bold">${it.quantity}</td>
                <td class="right bold">${Number(it.price).toFixed(2)}</td>
                <td class="right bold">${(it.quantity * it.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="flex-row"><span>Items Count:</span><span class="bold">${items.reduce((s, i) => s + Number(i.quantity), 0)}</span></div>
        <div class="flex-row"><span>Gross Total:</span><span class="bold">Rs. ${(Number(order.subtotal || cartFinancials.rawSubtotal || (Number(order.total_amount || cartFinancials.grandTotal) + Number(order.discount || order.discount_amount || cartFinancials.discountAmount || 0)))).toFixed(2)}</span></div>
        ${Number(order.discount || order.discount_amount || cartFinancials.discountAmount || 0) > 0 ? `
          <div class="flex-row bold"><span>Discount ${(order.discount_type === 'percent' || discountType === 'percent') ? `(${order.discount_value || discountInput}%)` : ''}:</span><span class="bold">- Rs. ${Number(order.discount || order.discount_amount || cartFinancials.discountAmount).toFixed(2)}</span></div>
        ` : ''}
        <div class="flex-row"><span>Taxable Value:</span><span class="bold">Rs. ${Number(order.taxable_amount || cartFinancials.taxableAmount).toFixed(2)}</span></div>
        <div class="flex-row"><span>CGST (9%):</span><span class="bold">Rs. ${Number(order.cgst_amount || cartFinancials.cgstAmount).toFixed(2)}</span></div>
        <div class="flex-row"><span>SGST (9%):</span><span class="bold">Rs. ${Number(order.sgst_amount || cartFinancials.sgstAmount).toFixed(2)}</span></div>
        <div class="double-divider"></div>
        <div class="flex-row" style="font-size: ${is58mm ? '12px' : '14px'};">
          <span class="bold">NET PAYABLE:</span>
          <span class="bold">Rs. ${Number(order.total_amount || cartFinancials.grandTotal).toFixed(2)}</span>
        </div>
        <div class="double-divider"></div>

        ${paymentMethod === 'Cash' ? `
          <div class="flex-row"><span>Cash Tendered:</span><span class="bold">Rs. ${Number(receivedAmount || order.total_amount || cartFinancials.grandTotal).toFixed(2)}</span></div>
          <div class="flex-row bold"><span>Change Due:</span><span class="bold">Rs. ${Number(order.changeDue || cartFinancials.changeDue).toFixed(2)}</span></div>
          <div class="divider"></div>
        ` : ''}

        <div class="footer-note">
          <div class="bold">GST INCLUSIVE. ALL TAXES ACCOUNTED FOR.</div>
          <div>Items exchangeable within 7 days with bill tag.</div>
          <div class="bold" style="margin-top: 6px;">*** THANK YOU FOR SHOPPING WITH US! ***</div>
        </div>
      </div>
    `;

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS Receipt - ${orderNo}</title>
<style>
  @page {
    size: ${is58mm ? '58mm' : '80mm'} auto;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    border-color: #000000 !important;
    box-sizing: border-box;
  }
  body {
    width: ${bodyWidth};
    margin: 0 auto;
    padding: 4mm 2mm;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: ${fontSize};
    line-height: 1.35;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: ${is300Bol ? '900' : '700'};
    ${is300Bol ? 'text-shadow: 0 0 0.45px #000000; -webkit-font-smoothing: none;' : ''}
  }
  .receipt-section {
    page-break-inside: avoid;
  }
  .center { text-align: center; }
  .bold { font-weight: 900 !important; color: #000000 !important; }
  .store-title {
    font-size: ${is58mm ? '13px' : '16px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
    color: #000000 !important;
  }
  .subtext {
    font-size: 9.5px;
    font-weight: 700;
    color: #000000 !important;
  }
  .divider {
    border-top: 1.5px dashed #000000 !important;
    margin: 5px 0;
  }
  .double-divider {
    border-top: 2.5px solid #000000 !important;
    margin: 5px 0;
  }
  .cut-divider {
    border-top: 2px dashed #000000 !important;
    margin: 16px 0;
    text-align: center;
  }
  .cut-divider span {
    background: #ffffff;
    padding: 0 6px;
    font-size: 9px;
    font-weight: 900;
    position: relative;
    top: -7px;
  }
  .flex-row {
    display: flex;
    justify-content: space-between;
    margin: 2px 0;
    color: #000000 !important;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: ${fontSize};
    margin: 4px 0;
    color: #000000 !important;
  }
  .items-table th {
    text-align: left;
    border-bottom: 1.5px dashed #000000;
    padding: 3px 0;
    font-weight: 900;
    color: #000000 !important;
  }
  .items-table td {
    padding: 3px 0;
    vertical-align: top;
    color: #000000 !important;
  }
  .right { text-align: right; }
  .footer-note {
    font-size: 9.5px;
    margin-top: 8px;
    text-align: center;
    line-height: 1.4;
    color: #000000 !important;
  }
</style>
</head>
<body>
  ${renderReceiptBody('CUSTOMER COPY')}
  ${settings.copies === 2 ? `
    <div class="cut-divider"><span>--- CUT HERE / STORE COPY ---</span></div>
    ${renderReceiptBody('MERCHANT / STORE COPY')}
  ` : ''}
</body>
</html>
    `;

    const printWin = window.open('', '_blank', `width=${is58mm ? 400 : 500},height=650`);
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
        printWin.close();
      }, 400);
    }
  };

  // WhatsApp invoice trigger
  const handleSendWhatsAppInvoice = (order) => {
    const ord = order || completedOrder;
    if (!ord) return;
    const rawPhone = ord.customer_phone || customerPhone;
    if (!rawPhone) {
      alert('Please enter a customer mobile number to send invoice on WhatsApp.');
      return;
    }
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const orderNo = ord.order_number || ord.order?.order_number || 'POS';
    const total = Number(ord.total_amount || cartFinancials.grandTotal).toFixed(2);

    const message = encodeURIComponent(
      `Hello ${ord.customer_name || customerName},\n\n` +
      `Thank you for shopping at *${storeSettings.store_name}*!\n\n` +
      `*Receipt No:* ${orderNo}\n` +
      `*Amount Paid:* Rs. ${total} (${paymentMethod})\n` +
      `*Items:* ${cart.map(c => `${c.product_name} x ${c.quantity}`).join(', ')}\n\n` +
      `We hope you love your purchase. Visit us again at ${storeSettings.website}!`
    );

    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  };

  if (!isPOSOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#0f172a',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, system-ui, sans-serif)'
      }}
    >
      {/* 1. TOP HEADER STRIP (Icon-Free, Full Width) */}
      <header
        style={{
          background: '#0b1120',
          borderBottom: '1px solid #1e293b',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              NP GRAND SHOPPING — POS BILLING COUNTER
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              OMNICHANNEL STORE RETAIL BILLING | {storeSettings.address}
            </div>
          </div>
          {editingOrder ? (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#b45309',
                color: '#ffffff',
                letterSpacing: '0.03em'
              }}
            >
              EDITING BILL #{editingOrder.order_number || editingOrder.id} [IN-PLACE EDIT]
            </span>
          ) : (
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#065935',
                color: '#ffffff',
                letterSpacing: '0.02em'
              }}
            >
              ACTIVE REGISTER
            </span>
          )}
        </div>

        {/* Header Right: Shortcuts & Close Button (No Icons) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '12px' }}>
            <span>[F2] Focus Scan</span>
            <span>[F4] Complete Order</span>
            <span>[F9] Clear Cart</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              closePOS();
            }}
            style={{
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '9px 18px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'background 0.15s ease'
            }}
          >
            CLOSE [ESC]
          </button>
        </div>
      </header>

      {/* Status Banner Notification (No Icons) */}
      {statusMessage && (
        <div
          style={{
            padding: '8px 24px',
            background: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'success' ? '#065935' : '#1e293b',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
            letterSpacing: '0.02em',
            flexShrink: 0
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 2. MAIN 2-COLUMN FULL-SCREEN LAYOUT */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#f1f5f9' }}>
        {/* LEFT COLUMN: SCANNER, CUSTOMER, CART ITEMS (65% Width) */}
        <div
          style={{
            flex: '1 1 65%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #cbd5e1',
            background: '#ffffff',
            overflow: 'hidden'
          }}
        >
          {/* Top Controls: Scanner Bar + Custom Item Button + Customer Inputs */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            {/* Search and Scan Container with Autocomplete Dropdown */}
            <div ref={searchContainerRef} style={{ position: 'relative', zIndex: 100, marginBottom: '12px' }}>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    ref={searchInputRef}
                    id="pos-main-search-input"
                    type="text"
                    placeholder="Scan barcode (NP-XXXX) or type product name, SKU to auto-suggest... [Press Enter]"
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (!showSuggestions && suggestions.length > 0) setShowSuggestions(true);
                        setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedIndex(prev => Math.max(prev - 1, -1));
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 38px 12px 16px',
                      borderRadius: '8px',
                      border: '2px solid #065935',
                      fontSize: '14.5px',
                      fontWeight: 600,
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a'
                    }}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setHighlightedIndex(-1);
                        searchInputRef.current?.focus();
                      }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: '#e2e8f0',
                        border: 'none',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '11px',
                        fontWeight: 900,
                        color: '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Clear search [ESC]"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {searching ? 'SEARCHING...' : 'ADD ITEM [ENTER]'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomItem({ name: searchInput.trim() || '', mrp: '', price: '', quantity: 1 });
                    setIsCustomModalOpen(true);
                  }}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    whiteSpace: 'nowrap'
                  }}
                  title="Add miscellaneous or custom unlisted product [Shortcut F7]"
                >
                  + ADD CUSTOM ITEM [F7]
                </button>
              </form>

              {/* LIVE AUTOCOMPLETE DROPDOWN SUGGESTIONS */}
              {showSuggestions && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '2px solid #065935',
                    boxShadow: '0 14px 36px rgba(0,0,0,0.22)',
                    zIndex: 50,
                    maxHeight: '380px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{searchInput.trim() ? `MATCHING PRODUCTS (${suggestions.length})` : 'POPULAR FAST-BILLING PRODUCTS'}</span>
                    <span style={{ color: '#065935' }}>PRESS ↑↓ ARROWS &amp; ENTER OR CLICK TO ADD</span>
                  </div>

                  {suggestions.length > 0 ? (
                    suggestions.map((item, sIdx) => {
                      const p = item.product;
                      const v = item.matchedVariant;
                      const displayPrice = v && v.price ? v.price : (p.sale_price > 0 ? p.sale_price : p.price);
                      const barcode = v?.barcode || p.barcode || `NP-${p.id}`;
                      const isSelected = sIdx === highlightedIndex;

                      return (
                        <div
                          key={`${p.id}-${v?.id || 'main'}-${sIdx}`}
                          onClick={() => handlePickSuggestion(p, v)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: isSelected ? '#ecfdf5' : '#ffffff',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={() => setHighlightedIndex(sIdx)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {p.primary_image || p.image ? (
                              <img
                                src={p.primary_image || p.image}
                                alt={p.name}
                                style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                              />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: '#065935' }}>
                                NP
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                                {p.name} {v ? `— ${v.color_name || ''} ${v.size_name || ''}` : ''}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                <span style={{ fontWeight: 800, color: '#065935' }}>{barcode}</span>
                                {v?.sku && <span>SKU: {v.sku}</span>}
                                {p.category_name && <span>{p.category_name}</span>}
                                <span style={{ color: (v?.stock_quantity ?? p.stock_quantity ?? 50) > 0 ? '#166534' : '#dc2626', fontWeight: 700 }}>
                                  Stock: {v?.stock_quantity ?? p.stock_quantity ?? 50}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>
                              ₹{Number(displayPrice).toLocaleString('en-IN')}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#065935', background: isSelected ? '#d1fae5' : '#ecfdf5', padding: '2px 7px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                              + ADD TO BILL
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                      No catalog item matches "{searchInput}". You can scan another code or add as custom item below.
                    </div>
                  )}

                  {/* QUICK ADD CUSTOM PRODUCT OPTION IN DROPDOWN */}
                  <div
                    onClick={() => {
                      setCustomItem({ name: searchInput.trim() || 'Custom Item', mrp: '', price: '', quantity: 1 });
                      setIsCustomModalOpen(true);
                      setShowSuggestions(false);
                    }}
                    style={{
                      padding: '11px 16px',
                      background: '#f8fafc',
                      borderTop: '1.5px dashed #cbd5e1',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ecfdf5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#065935' }}>[+]</span>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#065935' }}>
                        {searchInput.trim() ? `Add "${searchInput.trim()}" as Custom Item` : 'Add Custom / Miscellaneous Item'}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', background: '#e2e8f0', padding: '3px 8px', borderRadius: '4px' }}>
                      SHORTCUT [F7]
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Customer & Sales Staff Information (Autofocus on Mobile First per user instruction) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', alignItems: 'end' }}>
              {/* 1. Mobile Phone (FIRST KEYBOARD FOCUS) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#065935' }}>
                    📱 MOBILE (AUTOFOCUS)
                  </label>
                  {customerFoundBadge && (
                    <span style={{ fontSize: '10px', color: '#065935', fontWeight: 800 }}>
                      [{customerFoundBadge}]
                    </span>
                  )}
                </div>
                <input
                  ref={customerPhoneInputRef}
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    }
                  }}
                  placeholder="10-digit mobile [Press Enter to Scan]"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: customerFoundBadge ? '2px solid #065935' : '1.5px solid #065935',
                    background: customerFoundBadge ? '#f0fdf4' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    outlineColor: '#065935'
                  }}
                />
              </div>

              {/* 2. Customer Name */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    CUSTOMER NAME
                  </label>
                  {customerFoundBadge && (
                    <span style={{ fontSize: '10px', color: '#065935', fontWeight: 800 }}>
                      [AUTO-FILLED]
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchInputRef.current?.focus();
                    }
                  }}
                  placeholder="Walk-in Customer"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: customerFoundBadge ? '1.5px solid #065935' : '1px solid #cbd5e1',
                    background: customerFoundBadge ? '#f0fdf4' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}
                />
              </div>

              {/* 3. Salesperson / Staff Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    SALES STAFF
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(true)}
                    style={{ fontSize: '10px', color: '#065935', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    [+ MANAGE STAFF]
                  </button>
                </div>
                <select
                  value={selectedSalespersonId}
                  onChange={(e) => {
                    const spId = e.target.value;
                    setSelectedSalespersonId(spId);
                    const spObj = salespersons.find(s => String(s.id) === String(spId));
                    setCart(prev => prev.map(item => ({
                      ...item,
                      sales_person_id: spId || null,
                      sales_person_name: spObj ? spObj.name : null
                    })));
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">General Counter Staff</option>
                  {salespersons.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      👤 {sp.name} {sp.code ? `(${sp.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Customer Email (Optional) */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                  EMAIL (OPTIONAL)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Cart Items Table Header */}
          <div
            style={{
              padding: '10px 20px',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>BILLING LINE ITEMS ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                style={{
                  background: 'transparent',
                  border: '1px solid #ef4444',
                  color: '#ef4444',
                  borderRadius: '4px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                CLEAR ALL [F9]
              </button>
            )}
          </div>

          {/* Cart Items Scrollable List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  padding: '40px'
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  READY FOR SCANNING OR TYPING
                </div>
                <div style={{ fontSize: '13px', maxWidth: '420px', textAlign: 'center', lineHeight: 1.5 }}>
                  Scan barcode (NP-XXXX), type a product name in the search bar above for instant suggestions, or click <strong>+ ADD CUSTOM ITEM</strong>.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800, textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>#</th>
                    <th style={{ padding: '10px 14px' }}>PRODUCT &amp; BARCODE</th>
                    <th style={{ padding: '10px 14px' }}>STAFF</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>PRICE / MRP</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>QTY</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>TAX (18%)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>TOTAL</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => {
                    const lineTotal = item.price * item.quantity;
                    const lineTaxable = Math.round((lineTotal / 1.18) * 100) / 100;
                    const lineTax = Math.round((lineTotal - lineTaxable) * 100) / 100;

                    return (
                      <tr
                        key={`${item.product_id}-${item.barcode}-${idx}`}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fcfcfc'
                        }}
                      >
                        <td style={{ padding: '12px 14px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.product_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#065935' }}>{item.barcode}</span>
                            {item.variant?.color && <span>Color: {item.variant.color}</span>}
                            {item.variant?.size && <span>Size: {item.variant.size}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select
                            value={item.sales_person_id || selectedSalespersonId || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const spObj = salespersons.find(s => String(s.id) === String(val));
                              setCart(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  sales_person_id: val || null,
                                  sales_person_name: spObj ? spObj.name : null
                                };
                                return copy;
                              });
                            }}
                            style={{
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: '#ffffff',
                              color: '#334155',
                              maxWidth: '120px'
                            }}
                          >
                            <option value="">Default ({salespersons.find(s => String(s.id) === String(selectedSalespersonId))?.name || 'Counter'})</option>
                            {salespersons.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          <div>₹{Number(item.price).toLocaleString('en-IN')}</div>
                          {((item.mrp && item.mrp > item.price) || (item.regular_price && item.regular_price > item.price)) && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
                              MRP ₹{Number(item.mrp || item.regular_price).toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, -1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                border: 'none',
                                background: '#f1f5f9',
                                fontWeight: 900,
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              -
                            </button>
                            <span style={{ width: '36px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(idx, 1)}
                              style={{
                                width: '28px',
                                height: '28px',
                                border: 'none',
                                background: '#f1f5f9',
                                fontWeight: 900,
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontSize: '12px' }}>
                          ₹{lineTax.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                          ₹{lineTotal.toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '4px 8px'
                            }}
                          >
                            REMOVE
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FINANCIAL SUMMARY, PAYMENT & CHECKOUT (35% Width) */}
        <div
          style={{
            flex: '1 1 35%',
            display: 'flex',
            flexDirection: 'column',
            background: '#f8fafc',
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          {/* Bill Summary Card */}
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '18px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              BILL CALCULATION
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
              <span>Items Total ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{cartFinancials.rawSubtotal.toLocaleString('en-IN')}</span>
            </div>

            {/* Discount Input with Flat ₹ vs % Dropdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 600 }}>Discount:</span>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#f1f5f9',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  <option value="flat">₹ Flat</option>
                  <option value="percent">% Percent</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percent' ? 100 : cartFinancials.rawSubtotal}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="0"
                  style={{
                    width: '85px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1.5px solid #cbd5e1',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#ef4444',
                    background: '#ffffff'
                  }}
                />
                {discountType === 'percent' && (
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap' }}>
                    (-₹{cartFinancials.discountAmount.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
              <span>Taxable Value</span>
              <span>₹{cartFinancials.taxableAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: '#64748b' }}>
              <span>CGST (9%)</span>
              <span>₹{cartFinancials.cgstAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: '#64748b' }}>
              <span>SGST (9%)</span>
              <span>₹{cartFinancials.sgstAmount.toFixed(2)}</span>
            </div>

            <div
              style={{
                borderTop: '2px dashed #e2e8f0',
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>NET PAYABLE</span>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#065935' }}>
                ₹{cartFinancials.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Payment Method Selector (Icon-Free Clean Buttons) */}
          <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '18px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', marginBottom: '12px' }}>
              PAYMENT METHOD
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {['Cash', 'UPI', 'Card'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '6px',
                    border: paymentMethod === m ? '2px solid #065935' : '1px solid #cbd5e1',
                    background: paymentMethod === m ? '#ecfdf5' : '#ffffff',
                    color: paymentMethod === m ? '#065935' : '#475569',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Cash Tendered & Change Due Calculator */}
            {paymentMethod === 'Cash' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  CASH RECEIVED (₹)
                </label>
                <input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder={`Exact: ₹${cartFinancials.grandTotal}`}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1.5px solid #0f172a',
                    fontSize: '16px',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '10px'
                  }}
                />

                {/* Quick Cash Buttons */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {[100, 200, 500, 1000, 2000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setReceivedAmount(String(amt))}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      +₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReceivedAmount(String(cartFinancials.grandTotal))}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #065935',
                      background: '#ecfdf5',
                      color: '#065935',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    EXACT
                  </button>
                </div>

                {/* Change Return Calculator */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: cartFinancials.changeDue > 0 ? '#fef3c7' : '#f1f5f9',
                    border: cartFinancials.changeDue > 0 ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#78350f' }}>CHANGE RETURN:</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#78350f' }}>
                    ₹{cartFinancials.changeDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button: Checkout & Print */}
          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleCheckout}
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '16px 20px',
              borderRadius: '8px',
              background: cart.length === 0 ? '#94a3b8' : '#065935',
              color: '#ffffff',
              border: 'none',
              fontSize: '16px',
              fontWeight: 900,
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              boxShadow: cart.length > 0 ? '0 4px 14px rgba(6, 89, 53, 0.35)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {isSubmitting
              ? (editingOrder ? 'UPDATING BILL...' : 'PROCESSING BILL...')
              : (editingOrder ? `SAVE & UPDATE BILL [F4]` : 'COMPLETE SALE & PRINT [F4]')}
          </button>
        </div>
      </div>

      {/* 3. CUSTOM PRODUCT MODAL POPUP (Icon-Free) */}
      {isCustomModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                ADD CUSTOM IN-STORE PRODUCT
              </div>
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
              >
                [CANCEL]
              </button>
            </div>

            <form onSubmit={handleAddCustomProduct}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  ITEM NAME / DESCRIPTION <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leather Handbag, Custom Gift Box, Shoulder Strap"
                  value={customItem.name}
                  onChange={(e) => setCustomItem(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomProduct(e);
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1299"
                    value={customItem.mrp}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomItem(prev => ({
                        ...prev,
                        mrp: v,
                        price: (prev.price === '' || prev.price === prev.mrp) ? v : prev.price
                      }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomProduct(e);
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '13.5px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#065935', marginBottom: '4px' }}>
                    SELLING PRICE (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 999"
                    value={customItem.price}
                    onChange={(e) => setCustomItem(prev => ({ ...prev, price: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomProduct(e);
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid #065935', fontSize: '13.5px', fontWeight: 800, color: '#065935' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                    QUANTITY <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={customItem.quantity}
                    onChange={(e) => setCustomItem(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomProduct(e);
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '13.5px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '9px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px' }}>💡</span>
                <span>Press <strong>[ENTER]</strong> in any box or click <strong>ADD TO BILL</strong> to immediately add the item.</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  style={{ padding: '9px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  CANCEL [ESC]
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 22px', borderRadius: '6px', background: '#065935', color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>+ ADD TO BILL [ENTER]</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ORDER SUCCESS & LIVE THERMAL RECEIPT PREVIEW / SETTINGS MODAL */}
      {completedOrder && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px 28px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '94vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 70px rgba(0,0,0,0.35)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '18px' }}>
              <div>
                <span style={{ background: '#ecfdf5', color: '#065935', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.04em' }}>
                  ✓ BILLING COMPLETED &amp; INVENTORY DEDUCTED
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '6px 0 2px' }}>
                  RECEIPT #{completedOrder.order_number || completedOrder.order?.order_number || 'POS'}
                </h2>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Customer: <strong>{completedOrder.customer_name || customerName}</strong> &bull; Payment: <strong>{(completedOrder.payment_method || paymentMethod).toUpperCase()}</strong>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>NET BILLED AMOUNT</div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#065935' }}>
                  ₹{Number(completedOrder.total_amount || cartFinancials.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Left: Thermal Receipt Preview / Right: Settings & Action Buttons) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* LEFT COLUMN: Thermal Paper Preview Box (Solid Pure Black #000000 Font) */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>THERMAL RECEIPT PREVIEW</span>
                  <span style={{ color: '#065935', fontWeight: 800 }}>PURE BLACK (300 BOL)</span>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    padding: '12px',
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      width: thermalSettings.paperWidth === '58mm' ? '250px' : '320px',
                      border: '1.5px solid #000000',
                      padding: '16px 14px',
                      fontFamily: "'Courier New', Courier, monospace, 'Lucida Console'",
                      fontSize: thermalSettings.paperWidth === '58mm' ? '10px' : '11px',
                      lineHeight: 1.35,
                      color: '#000000',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                      fontWeight: thermalSettings.density === '300bol' ? 900 : 700,
                      boxSizing: 'border-box',
                      height: 'fit-content'
                    }}
                  >
                    {/* Store Header */}
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: thermalSettings.paperWidth === '58mm' ? '13px' : '15px', fontWeight: 900, letterSpacing: '0.5px' }}>
                        {storeSettings.store_name}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 700 }}>{storeSettings.address}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700 }}>Phone: {storeSettings.phone}</div>
                      <div style={{ fontSize: '9px', fontWeight: 700 }}>{storeSettings.website}</div>
                      <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />
                      <div style={{ fontSize: '11px', fontWeight: 900 }}>TAX INVOICE / POS RECEIPT</div>
                      <div style={{ fontSize: '9px', fontWeight: 900 }}>[ CUSTOMER COPY ]</div>
                    </div>

                    <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />

                    {/* Metadata */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Bill No:</span>
                      <span style={{ fontWeight: 900 }}>{completedOrder.order_number || completedOrder.order?.order_number || 'POS'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Date:</span>
                      <span>{new Date(completedOrder.created_at || Date.now()).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Customer:</span>
                      <span style={{ fontWeight: 900 }}>{completedOrder.customer_name || customerName}</span>
                    </div>
                    {(completedOrder.customer_phone || customerPhone) && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                        <span>Mobile:</span>
                        <span>{completedOrder.customer_phone || customerPhone}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Payment:</span>
                      <span style={{ fontWeight: 900 }}>{(completedOrder.payment_method || paymentMethod).toUpperCase()}</span>
                    </div>

                    <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />

                    {/* Items table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: thermalSettings.paperWidth === '58mm' ? '9.5px' : '10.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px dashed #000000', textAlign: 'left' }}>
                          <th style={{ padding: '3px 0' }}>ITEM</th>
                          <th style={{ padding: '3px 0', textAlign: 'right' }}>QTY</th>
                          <th style={{ padding: '3px 0', textAlign: 'right' }}>PRICE</th>
                          <th style={{ padding: '3px 0', textAlign: 'right' }}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(completedOrder.items || []).map((it, idx) => (
                          <tr key={idx} style={{ verticalAlign: 'top' }}>
                            <td style={{ padding: '3px 0' }}>
                              <div style={{ fontWeight: 900 }}>{it.product_name}</div>
                              <div style={{ fontSize: '8.5px', fontWeight: 700 }}>[{it.barcode}]</div>
                            </td>
                            <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 900 }}>{it.quantity}</td>
                            <td style={{ padding: '3px 0', textAlign: 'right' }}>{Number(it.price).toFixed(2)}</td>
                            <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 900 }}>{(it.quantity * it.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />

                    {/* Financial summary */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Items Count:</span>
                      <span style={{ fontWeight: 900 }}>{(completedOrder.items || []).reduce((s, i) => s + i.quantity, 0)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Gross Total:</span>
                      <span>Rs. {(Number(completedOrder.subtotal || cartFinancials.rawSubtotal || (Number(completedOrder.total_amount || cartFinancials.grandTotal) + Number(completedOrder.discount || completedOrder.discount_amount || cartFinancials.discountAmount || 0)))).toFixed(2)}</span>
                    </div>
                    {Number(completedOrder.discount || completedOrder.discount_amount || cartFinancials.discountAmount || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0', fontWeight: 900 }}>
                        <span>Discount:</span>
                        <span style={{ fontWeight: 900 }}>- Rs. {Number(completedOrder.discount || completedOrder.discount_amount || cartFinancials.discountAmount).toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>Taxable Value:</span>
                      <span>Rs. {Number(completedOrder.taxable_amount || cartFinancials.taxableAmount).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>CGST (9%):</span>
                      <span>Rs. {Number(completedOrder.cgst_amount || cartFinancials.cgstAmount).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                      <span>SGST (9%):</span>
                      <span>Rs. {Number(completedOrder.sgst_amount || cartFinancials.sgstAmount).toFixed(2)}</span>
                    </div>

                    <div style={{ borderTop: '2.5px solid #000000', margin: '6px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: thermalSettings.paperWidth === '58mm' ? '12px' : '13.5px', fontWeight: 900 }}>
                      <span>NET PAYABLE:</span>
                      <span>Rs. {Number(completedOrder.total_amount || cartFinancials.grandTotal).toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '2.5px solid #000000', margin: '6px 0' }} />

                    {completedOrder.payment_method === 'Cash' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                          <span>Cash Tendered:</span>
                          <span style={{ fontWeight: 900 }}>Rs. {Number(receivedAmount || completedOrder.total_amount || cartFinancials.grandTotal).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0', fontWeight: 900 }}>
                          <span>Change Due:</span>
                          <span>Rs. {Number(completedOrder.changeDue || cartFinancials.changeDue).toFixed(2)}</span>
                        </div>
                        <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />
                      </>
                    )}

                    <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '8px', lineHeight: 1.4 }}>
                      <div style={{ fontWeight: 900 }}>GST INCLUSIVE. ALL TAXES ACCOUNTED FOR.</div>
                      <div>Items exchangeable within 7 days with bill tag.</div>
                      <div style={{ fontWeight: 900, marginTop: '4px', fontSize: '10px' }}>*** THANK YOU FOR SHOPPING WITH US! ***</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Direct Thermal Print & Bill Dispatch */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px' }}>
                    DIRECT THERMAL RECEIPT PRINT
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                    Printed using your fixed store printer settings ({thermalSettings.paperWidth}, {thermalSettings.copies} {thermalSettings.copies > 1 ? 'copies' : 'copy'}, {thermalSettings.density === '300bol' ? '300 Bol High-Density Black' : 'Standard Bold'}).
                  </p>

                  <div style={{ background: '#ffffff', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', marginBottom: '4px' }}>
                      ACTIVE THERMAL PRINTER PROFILE
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#065935' }}>
                      {thermalSettings.paperWidth} Roll &bull; {thermalSettings.copies} Copy &bull; {thermalSettings.density.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                      To adjust paper size or print density, use the <strong>Thermal Settings</strong> button next to POS Billing in the header.
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => printThermalReceipt(completedOrder, thermalSettings)}
                    style={{
                      width: '100%',
                      padding: '15px 20px',
                      borderRadius: '8px',
                      background: '#065935',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '14.5px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      boxShadow: '0 4px 14px rgba(6, 89, 53, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>PRINT THERMAL RECEIPT DIRECTLY [ENTER]</span>
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppInvoice(completedOrder)}
                      style={{
                        padding: '11px 16px',
                        borderRadius: '8px',
                        background: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        letterSpacing: '0.02em'
                      }}
                    >
                      SEND WHATSAPP BILL
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCompletedOrder(null);
                        setTimeout(() => searchInputRef.current?.focus(), 100);
                      }}
                      style={{
                        padding: '11px 16px',
                        borderRadius: '8px',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        letterSpacing: '0.02em'
                      }}
                    >
                      START NEXT SALE [ESC]
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 5. SALES STAFF MANAGEMENT MODAL */}
      {isStaffModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStaffModalOpen(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Manage Sales Staff
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  Assign sales attribution & track employee commissions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Existing Staff List */}
            <div style={{ padding: '16px 22px', maxHeight: '240px', overflowY: 'auto' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Active Salespersons ({salespersons.length})
              </div>
              {salespersons.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No sales staff recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {salespersons.map(staff => {
                    const isEditing = editingStaffId === staff.id;
                    const commVal = staff.commission_percent !== undefined ? staff.commission_percent : (staff.commission_rate || 0);

                    return (
                      <div
                        key={staff.id}
                        style={{
                          padding: '10px 14px',
                          background: isEditing ? '#fefce8' : '#f8fafc',
                          border: `1px solid ${isEditing ? '#fde047' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: isEditing ? 'column' : 'row',
                          alignItems: isEditing ? 'stretch' : 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}
                      >
                        {isEditing ? (
                          /* Inline Edit Mode */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>
                              EDIT STAFF MEMBER #{staff.id}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Staff Name"
                                value={editStaffName}
                                onChange={(e) => setEditStaffName(e.target.value)}
                                style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                              />
                              <input
                                type="tel"
                                placeholder="Phone"
                                value={editStaffPhone}
                                onChange={(e) => setEditStaffPhone(e.target.value)}
                                style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                              />
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="Comm. %"
                                value={editStaffCommission}
                                onChange={(e) => setEditStaffCommission(e.target.value)}
                                style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '2px' }}>
                              <button
                                type="button"
                                onClick={() => setEditingStaffId(null)}
                                style={{ padding: '5px 10px', borderRadius: '5px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingStaff}
                                onClick={() => handleUpdateStaff(staff.id)}
                                style={{ padding: '5px 14px', borderRadius: '5px', background: '#065935', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                              >
                                {savingStaff ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                {staff.name} {staff.code ? <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>({staff.code})</span> : null}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {staff.phone || 'No phone'} • Commission: <strong style={{ color: '#065935' }}>{commVal}%</strong>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSalespersonId(String(staff.id));
                                  setIsStaffModalOpen(false);
                                  showToast(`Selected: ${staff.name}`, 'success');
                                }}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  background: selectedSalespersonId === String(staff.id) ? '#065935' : '#ffffff',
                                  color: selectedSalespersonId === String(staff.id) ? '#ffffff' : '#065935',
                                  border: '1px solid #065935',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {selectedSalespersonId === String(staff.id) ? 'Selected' : 'Select'}
                              </button>

                              <button
                                type="button"
                                onClick={() => startEditStaff(staff)}
                                title="Edit staff name & commission"
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  background: '#f8fafc',
                                  color: '#334155',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(staff)}
                                title="Delete staff"
                                style={{
                                  padding: '5px 7px',
                                  borderRadius: '6px',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fee2e2',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '6px 22px 10px', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              <Link
                href="/salespersons"
                target="_blank"
                style={{ fontSize: '11px', fontWeight: 800, color: '#065935', textDecoration: 'none' }}
              >
                📊 Open Full Sales Staff Reports &rarr;
              </Link>
            </div>

            {/* Add New Staff Form */}
            <form onSubmit={handleAddStaff} style={{ padding: '16px 22px', borderTop: '1px solid #e2e8f0', background: '#fafaf9' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Add New Staff Member
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya S."
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    PHONE NUMBER
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    COMM. %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="2.0"
                    value={newStaffCommission}
                    onChange={(e) => setNewStaffCommission(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStaff}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: savingStaff ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingStaff ? 'Saving...' : '+ Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default POSBillingModal;
