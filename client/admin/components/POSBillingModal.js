'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePOSModal } from '../lib/pos-modal-context';
import { useAdminAuth } from '../lib/auth';
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
  deleteAdminSalesperson,
  getHeldBills,
  holdBill,
  updateHeldBill,
  completeHeldBill,
  cancelHeldBill
} from '../lib/api';

const RECEIPT_STORE_NAME = 'NP Grand Shopping';
const POS_DRAFT_KEY = 'npgrand_pos_active_bill_draft';
const POS_STAFF_KEY = 'npgrand_pos_selected_staff';

function cleanCustomerEmail(value) {
  const email = String(value || '').trim();
  if (!email) return '';
  if (/^walkin@/i.test(email) || /@pos\.npgrand\.com$/i.test(email)) return '';
  return email;
}

function readSavedSalespersonId() {
  try {
    const saved = window.localStorage.getItem(POS_STAFF_KEY);
    return saved === null ? null : saved;
  } catch (err) {
    return null;
  }
}

function saveSalespersonId(id) {
  try {
    window.localStorage.setItem(POS_STAFF_KEY, id ? String(id) : '');
  } catch (err) {
    // ignore storage failures
  }
}

function looksLikeBarcode(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^(NP|SKU)-/i.test(text)) return true;
  if (/\s/.test(text)) return false;
  if (/^\d{4,}$/.test(text)) return true;
  return /^[0-9A-Za-z][0-9A-Za-z\-_./#:?=&%{}",@+~]{3,}$/.test(text) && (text.match(/\d/g) || []).length >= 4;
}

function mergeProductLists(...lists) {
  const byId = new Map();
  lists.forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(product => {
      if (!product) return;
      const key = String(product.id ?? product.slug ?? product.name ?? '');
      if (key && !byId.has(key)) byId.set(key, product);
    });
  });
  return Array.from(byId.values());
}

function scoreSearchValue(value, query, weight) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 0;
  if (text === query) return weight + 50;
  if (text.startsWith(query)) return weight + 35;
  if (text.split(/\s+/).some(word => word.startsWith(query))) return weight + 25;
  if (text.includes(query)) return weight + 10;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every(token => text.includes(token))) return weight + 5;
  return 0;
}

function findVariantMatch(product, query) {
  if (!Array.isArray(product.variants)) return null;
  let best = null;
  let bestScore = 0;
  product.variants.forEach(variant => {
    const score = Math.max(
      scoreSearchValue(variant.barcode, query, 190),
      scoreSearchValue(variant.sku, query, 170),
      scoreSearchValue(variant.color_name, query, 40),
      scoreSearchValue(variant.size_name, query, 40)
    );
    if (score > bestScore) {
      bestScore = score;
      best = variant;
    }
  });
  return best;
}

function scoreProductMatch(product, query) {
  const bestFieldScore = Math.max(
    scoreSearchValue(product.barcode, query, 200),
    scoreSearchValue(product.sku, query, 180),
    scoreSearchValue(product.name, query, 160),
    scoreSearchValue(product.barcode_short_name, query, 140),
    scoreSearchValue(product.category_name, query, 50),
    scoreSearchValue(product.slug, query, 30),
    scoreSearchValue(product.id, query, 20)
  );
  const matchedVariant = findVariantMatch(product, query);
  const variantScore = matchedVariant
    ? Math.max(
        scoreSearchValue(matchedVariant.barcode, query, 190),
        scoreSearchValue(matchedVariant.sku, query, 170),
        scoreSearchValue(matchedVariant.color_name, query, 40),
        scoreSearchValue(matchedVariant.size_name, query, 40)
      )
    : 0;

  return {
    score: Math.max(bestFieldScore, variantScore),
    matchedVariant: variantScore > 0 ? matchedVariant : null
  };
}

function findProductMatches(allProducts, query, limit = 15) {
  if (!query || !query.trim()) {
    return allProducts.slice(0, 8).map(p => ({ product: p, matchedVariant: null, score: 0 }));
  }
  const q = query.trim().toLowerCase();
  const matches = [];

  for (const p of allProducts) {
    const { score, matchedVariant } = scoreProductMatch(p, q);
    if (score > 0) {
      matches.push({ product: p, matchedVariant, score });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score || String(a.product.name || '').localeCompare(String(b.product.name || '')))
    .slice(0, limit);
}

function findExactProductMatch(allProducts, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;

  for (const product of allProducts) {
    if (String(product.barcode || '').toLowerCase() === q || String(product.sku || '').toLowerCase() === q) {
      return { product, matchedVariant: null, score: 250 };
    }
    if (String(product.name || '').trim().toLowerCase() === q || String(product.barcode_short_name || '').trim().toLowerCase() === q) {
      return { product, matchedVariant: null, score: 210 };
    }
    if (Array.isArray(product.variants)) {
      const variant = product.variants.find(v =>
        String(v.barcode || '').toLowerCase() === q || String(v.sku || '').toLowerCase() === q
      );
      if (variant) return { product, matchedVariant: variant, score: 200 };
    }
  }
  return null;
}

export function POSBillingModal() {
  const { isPOSOpen, closePOS, editingOrder, setEditingOrder } = usePOSModal();
  const { adminUser } = useAdminAuth();

  const [cart, setCart] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error' | 'info', text: '' }

  // Autocomplete suggestions
  const [allProducts, setAllProducts] = useState([]);
  const [remoteSearchProducts, setRemoteSearchProducts] = useState([]);
  const [remoteRowProducts, setRemoteRowProducts] = useState([]);
  const [remoteModalProducts, setRemoteModalProducts] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Inline editable billing-row entry
  const [rowInput, setRowInput] = useState('');
  const [showRowSuggestions, setShowRowSuggestions] = useState(false);
  const [rowHighlightedIndex, setRowHighlightedIndex] = useState(-1);

  // F2 Quick Product Search popup
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [searchModalHighlighted, setSearchModalHighlighted] = useState(0);
  const searchModalInputRef = useRef(null);

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
  const [customerNpPoints, setCustomerNpPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [showRoyaltyAdjust, setShowRoyaltyAdjust] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card'
  const [receivedAmount, setReceivedAmount] = useState('');
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [discountInput, setDiscountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Billing Hold / Resume
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [selectedHeldIndex, setSelectedHeldIndex] = useState(0);
  const [heldBills, setHeldBills] = useState([]);
  const [loadingHeldBills, setLoadingHeldBills] = useState(false);
  const [holdingBill, setHoldingBill] = useState(false);
  const [resumedHeldId, setResumedHeldId] = useState(null);
  const [resumedHeldRef, setResumedHeldRef] = useState(null);

  // Accountable (Pakka) vs Unaccountable (Kaccha) stealth mode
  // Initial / default is Pakka (true). Secret toggle via Ctrl+Shift+K or Alt+K.
  const [isAccountable, setIsAccountable] = useState(true);

  // Sales Staff Attribution
  const [salespersons, setSalespersons] = useState([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffCommission, setNewStaffCommission] = useState('');
  const [savingStaff, setSavingStaff] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffCode, setEditStaffCode] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffCommission, setEditStaffCommission] = useState('');

  // Completed order & receipt modal
  const [completedOrder, setCompletedOrder] = useState(null);
  const [thermalSettings, setThermalSettings] = useState({
    paperWidth: '80mm', // '80mm' | '58mm'
    copies: 1, // 1 | 2
    density: '300bol' // '300bol' (Pure Black 300 DPI High-Density Bold) | 'standard'
  });
  const [storeSettings, setStoreSettings] = useState({
    store_name: 'NP Grand Shopping',
    phone: '+91 97909 04504',
    address: 'Thiruvallur',
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
  const rowInputRef = useRef(null);
  const rowContainerRef = useRef(null);
  const draftRecoveryRef = useRef(false);
  const lastProcessedScanRef = useRef({ code: '', time: 0 });

  // Inline Custom Item Entry in table footer
  const [isCustomEntryMode, setIsCustomEntryMode] = useState(false);
  const customItemNameRef = useRef(null);
  const customItemMrpRef = useRef(null);
  const customItemPriceRef = useRef(null);
  const customItemQtyRef = useRef(null);

  const openCustomEntryMode = (initialName = '') => {
    setIsCustomEntryMode(true);
    setCustomItem({ name: initialName || rowInput.trim() || '', mrp: '', price: '', quantity: 1 });
    setTimeout(() => {
      if (initialName) {
        customItemPriceRef.current?.focus();
        customItemPriceRef.current?.select();
      } else {
        customItemNameRef.current?.focus();
        customItemNameRef.current?.select();
      }
    }, 60);
  };

  const closeCustomEntryMode = () => {
    setIsCustomEntryMode(false);
    setTimeout(() => {
      rowInputRef.current?.focus();
      rowInputRef.current?.select();
    }, 60);
  };

  // Load sales staff members
  const loadSalesStaff = () => {
    getAdminSalespersons()
      .then(data => {
        if (Array.isArray(data)) {
          setSalespersons(data);
          setSelectedSalespersonId(prev => {
            if (data.length === 0) return prev;
            const saved = readSavedSalespersonId();
            if (saved === '') return '';
            const preferred = saved !== null ? saved : prev;
            const match = data.find(s => String(s.id) === String(preferred));
            if (match) return String(match.id);
            const fallback = String(data[0].id);
            saveSalespersonId(fallback);
            return fallback;
          });
        }
      })
      .catch(() => {});
  };

  // Load catalog products for POS search & autocomplete
  const loadCatalogProducts = () => {
    getAdminProducts({ limit: 500, status: 'all', branch_id: adminUser?.branch_id || undefined })
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

  const fetchServerProductMatches = async (query) => {
    const term = String(query || '').trim();
    if (term.length < 2) return [];
    try {
      const res = await getAdminProducts({ search: term, limit: 25, status: 'all', branch_id: adminUser?.branch_id || undefined });
      const list = res?.products || res?.data?.products || (Array.isArray(res) ? res : []);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  };

  const loadHeldBillsData = async () => {
    setLoadingHeldBills(true);
    try {
      const data = await getHeldBills({ status: 'held' });
      setHeldBills(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load held bills:', err);
    } finally {
      setLoadingHeldBills(false);
    }
  };

  // Recover a bill left behind by a refresh/crash and park it in Held Bills
  const recoverDraftBill = async () => {
    if (draftRecoveryRef.current || typeof window === 'undefined') return;
    draftRecoveryRef.current = true;
    let raw = null;
    try {
      raw = window.localStorage.getItem(POS_DRAFT_KEY);
    } catch (err) {
      return;
    }
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (!Array.isArray(draft.items) || draft.items.length === 0) {
        window.localStorage.removeItem(POS_DRAFT_KEY);
        return;
      }
      const draftPayload = {
        customer_name: draft.customer_name || 'Walk-in Customer',
        customer_phone: draft.customer_phone || '',
        customer_email: draft.customer_email || '',
        items: draft.items,
        discount_type: draft.discount_type || 'flat',
        discount_value: draft.discount_value || 0,
        payment_method: draft.payment_method || 'Cash',
        sales_person_id: draft.sales_person_id || null,
        sales_person_name: draft.sales_person_name || null
      };
      const resumedId = draft.resumed_held_id || null;
      if (resumedId) {
        try {
          await updateHeldBill(resumedId, draftPayload);
        } catch (updateErr) {
          await holdBill(draftPayload);
        }
      } else {
        await holdBill(draftPayload);
      }
      window.localStorage.removeItem(POS_DRAFT_KEY);
      showToast('Unsaved bill recovered and moved to Held Bills.', 'info', 4000);
      await loadHeldBillsData();
    } catch (err) {
      console.warn('Could not recover unsaved POS bill:', err);
    }
  };

  // Keyboard Autofocus: User instructed to FIRST focus keyboard on customer phone number
  useEffect(() => {
    if (isPOSOpen) {
      loadSalesStaff();
      loadCatalogProducts();
      loadHeldBillsData();
      recoverDraftBill();
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
      setCustomerEmail(cleanCustomerEmail(editingOrder.customer_email));
      setPaymentMethod(editingOrder.payment_method || 'Cash');
      setDiscountType(editingOrder.discount_type || 'flat');
      setDiscountInput(
        editingOrder.discount_value !== undefined && editingOrder.discount_value !== null
          ? String(editingOrder.discount_value)
          : (editingOrder.discount ? String(editingOrder.discount) : '')
      );
      if (editingOrder.sales_person_id) {
        const staffId = String(editingOrder.sales_person_id);
        setSelectedSalespersonId(staffId);
        saveSalespersonId(staffId);
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

  }, []);

  // Show status notification
  const showToast = (text, type = 'info', duration = 2500) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, duration);
  };

  useEffect(() => {
    const term = searchInput.trim();
    if (term.length < 2) {
      setRemoteSearchProducts([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const list = await fetchServerProductMatches(term);
      if (active) setRemoteSearchProducts(list);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const term = rowInput.trim();
    if (term.length < 2) {
      setRemoteRowProducts([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const list = await fetchServerProductMatches(term);
      if (active) setRemoteRowProducts(list);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [rowInput]);

  useEffect(() => {
    const term = searchModalQuery.trim();
    if (!isSearchModalOpen || term.length < 2) {
      setRemoteModalProducts([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      const list = await fetchServerProductMatches(term);
      if (active) setRemoteModalProducts(list);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchModalQuery, isSearchModalOpen]);

  // Autocomplete Suggestions computation (instant live trigger on typing or fast picks on focus)
  const suggestions = useMemo(
    () => findProductMatches(mergeProductLists(allProducts, remoteSearchProducts), searchInput, 15),
    [allProducts, remoteSearchProducts, searchInput]
  );

  // Inline table-row product search suggestions
  const rowMatches = useMemo(
    () => findProductMatches(mergeProductLists(allProducts, remoteRowProducts), rowInput, 8),
    [allProducts, remoteRowProducts, rowInput]
  );

  // F2 popup product search results
  const searchModalMatches = useMemo(
    () => findProductMatches(mergeProductLists(allProducts, remoteModalProducts), searchModalQuery, 30),
    [allProducts, remoteModalProducts, searchModalQuery]
  );

  // Click outside suggestions dropdown listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (rowContainerRef.current && !rowContainerRef.current.contains(e.target)) {
        setShowRowSuggestions(false);
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
            setCustomerEmail(cleanCustomerEmail(cust.email));
            setCustomerFoundBadge(cust.name);
            const pts = Number(cust.np_points) || 0;
            setCustomerNpPoints(pts);
            showToast(`Customer Recognized: ${cust.name}${pts > 0 ? ` (${pts} NPPoints)` : ''}`, 'info', 3000);
          } else {
            setCustomerFoundBadge(null);
    setCustomerNpPoints(0);
    setRedeemPoints(0);
            setCustomerNpPoints(0);
            setRedeemPoints(0);
          }
        })
        .catch(() => {
          setCustomerFoundBadge(null);
    setCustomerNpPoints(0);
    setRedeemPoints(0);
          setCustomerNpPoints(0);
          setRedeemPoints(0);
        });
    } else {
      setCustomerFoundBadge(null);
    setCustomerNpPoints(0);
    setRedeemPoints(0);
      setCustomerNpPoints(0);
      setRedeemPoints(0);
    }
  }, [customerPhone]);

  // Resolve a catalog product from the loaded lists so a scanned barcode never
  // ends up as the displayed product name.
  const resolveCatalogItem = (item) => {
    const productId = item?.product_id;
    const barcode = String(item?.barcode || '').trim();
    const pool = mergeProductLists(allProducts, remoteSearchProducts, remoteRowProducts, remoteModalProducts);
    let match = null;
    if (productId) {
      match = pool.find(p => String(p.id) === String(productId));
    }
    if (!match && barcode) {
      match = pool.find(p => {
        if (String(p.barcode || '') === barcode) return true;
        return Array.isArray(p.variants) && p.variants.some(v => String(v.barcode || '') === barcode);
      });
    }
    return match || null;
  };

  const resolveItemName = (item) => {
    const barcode = String(item?.barcode || '').trim();
    const provided = String(item?.product_name || item?.name || item?.barcode_short_name || '').trim();
    if (provided && provided !== barcode) return provided;
    const match = resolveCatalogItem(item);
    if (match && match.name) return match.name;
    return provided || barcode || 'Item';
  };

  // Add product to cart helper with seamless keyboard focus advance (Product -> Staff -> Qty -> Next Product)
  const handleAddItemToCart = (item) => {
    const resolvedName = resolveItemName(item);
    let targetIdx = 0;
    setCart(prev => {
      const existingIdx = prev.findIndex(ci =>
        ci.product_id === item.product_id &&
        (ci.variant?.id ? ci.variant.id === item.variant?.id : ci.barcode === item.barcode)
      );

      if (existingIdx > -1) {
        targetIdx = existingIdx;
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      } else {
        targetIdx = prev.length;
        return [
          ...prev,
          {
            product_id: item.product_id,
            product_name: resolvedName,
            barcode: item.barcode || `NP-${item.product_id}`,
            barcode_short_name: item.barcode_short_name || resolvedName,
            price: Number(item.price) || 0,
            regular_price: Number(item.regular_price) || Number(item.price) || 0,
            mrp: Number(item.mrp) || Number(item.regular_price) || Number(item.price) || 0,
            gst_rate: Number(item.gst_rate) || 18,
            hsn_code: item.hsn_code || '4202',
            image: item.image,
            is_custom: Boolean(item.is_custom) || String(item.product_id || '').startsWith('custom-'),
            variant: item.variant || null,
            quantity: Number(item.quantity) || 1,
            stock_quantity: item.stock_quantity !== undefined ? item.stock_quantity : 50
          }
        ];
      }
    });

    showToast(`Added: ${resolvedName} [${item.barcode || 'ITEM'}]`, 'success', 2200);

    // Auto-advance focus to Sales Person field; pressing Enter then advances to Price, then Qty, then Next Product
    setTimeout(() => {
      const staffEl = document.getElementById(`pos-item-staff-${targetIdx}`);
      if (staffEl) {
        staffEl.focus();
      } else {
        const priceEl = document.getElementById(`pos-item-price-${targetIdx}`);
        if (priceEl) {
          priceEl.focus();
          priceEl.select();
        } else {
          const qtyEl = document.getElementById(`pos-item-qty-${targetIdx}`);
          if (qtyEl) {
            qtyEl.focus();
            qtyEl.select();
          }
        }
      }
    }, 60);
  };

  // Add Custom Product to cart (Supports Name, MRP, Selling Price, and instant Enter key submit)
  const handleAddCustomProduct = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!customItem.name.trim()) {
      showToast('Please enter an item name / description', 'error');
      customItemNameRef.current?.focus();
      return;
    }

    // Never let a barcode be saved as a custom product name. Resolve it against
    // the catalog first so the real product name is displayed.
    const rawName = customItem.name.trim();
    if (looksLikeBarcode(rawName)) {
      const localMatch = findExactProductMatch(
        mergeProductLists(allProducts, remoteSearchProducts, remoteRowProducts, remoteModalProducts),
        rawName
      );
      if (localMatch?.product) {
        handlePickSuggestion(localMatch.product, localMatch.matchedVariant);
        setIsCustomModalOpen(false);
        setCustomItem({ name: '', mrp: '', price: '', quantity: 1 });
        return;
      }
      try {
        const resolved = await lookupBarcode(rawName, adminUser?.branch_id || null);
        if (resolved && (resolved.product_id || resolved.product_name)) {
          handleAddItemToCart({
            ...resolved,
            product_name: resolved.product_name || resolved.barcode_short_name || resolved.name || resolved.barcode
          });
          showToast(`✓ Barcode "${rawName}" resolved to ${resolved.product_name || resolved.barcode}`, 'success');
          setIsCustomModalOpen(false);
          setCustomItem({ name: '', mrp: '', price: '', quantity: 1 });
          return;
        }
      } catch (_) {
        // fall through to the not-found message below
      }
      showToast(`Barcode not found: ${rawName}. Enter a product name to add a custom item.`, 'error');
      return;
    }

    const mrpNum = parseFloat(customItem.mrp) || 0;
    const sellingPriceNum = parseFloat(customItem.price) || (mrpNum > 0 ? mrpNum : 0);

    if (sellingPriceNum <= 0) {
      showToast('Please enter a valid selling price or MRP', 'error');
      customItemPriceRef.current?.focus();
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
      is_custom: true,
      variant: null
    };

    handleAddItemToCart(newItem);
    showToast(`✓ Added custom item: "${customItem.name.trim()}" (₹${sellingPriceNum})`, 'success');
    setIsCustomModalOpen(false);
    setCustomItem({ name: '', mrp: '', price: '', quantity: 1 });
    // Keep focus ready for next item
    setTimeout(() => customItemNameRef.current?.focus(), 80);
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
        code: newStaffCode.trim() || undefined,
        phone: newStaffPhone.trim() || null,
        commission_rate: newStaffCommission ? parseFloat(newStaffCommission) : 0
      });
      showToast(`Sales staff "${newStaffName.trim()}" added successfully!`, 'success');
      setNewStaffName('');
      setNewStaffCode('');
      setNewStaffPhone('');
      setNewStaffCommission('');
      loadSalesStaff();
      if (res && res.id) {
        const staffId = String(res.id);
        setSelectedSalespersonId(staffId);
        saveSalespersonId(staffId);
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
    setEditStaffCode(staff.code || '');
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
        code: editStaffCode.trim() || undefined,
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
        saveSalespersonId('');
      }
      loadSalesStaff();
    } catch (err) {
      showToast(err.message || 'Failed to delete staff', 'error');
    }
  };

  // Barcode / Scanner Hook Handler
  const handleBarcodeScanned = async (scannedCode) => {
    const code = String(scannedCode || '').trim();
    if (!code) return;

    const now = Date.now();
    if (
      lastProcessedScanRef.current.code.toLowerCase() === code.toLowerCase() &&
      now - lastProcessedScanRef.current.time < 700
    ) {
      return;
    }
    lastProcessedScanRef.current = { code, time: now };
    setRowInput('');
    setSearchInput('');
    setSearching(true);
    setShowSuggestions(false);
    setShowRowSuggestions(false);
    try {
      // Resolve against the already-loaded catalog first (fast path).
      const localPool = mergeProductLists(allProducts, remoteSearchProducts, remoteRowProducts, remoteModalProducts);
      const localMatch = findExactProductMatch(localPool, code);
      if (localMatch?.product) {
        handlePickSuggestion(localMatch.product, localMatch.matchedVariant);
        setSearchInput('');
        setRowInput('');
        return;
      }

      const res = await lookupBarcode(code, adminUser?.branch_id || null);
      if (res && (res.product_id || res.product_name)) {
        handleAddItemToCart({
          ...res,
          product_name: res.product_name || res.barcode_short_name || res.name || res.barcode
        });
        setSearchInput('');
        setRowInput('');
      } else {
        setRowInput(code);
        showToast(`Barcode not found: ${code}`, 'error');
      }
    } catch (err) {
      setRowInput(code);
      showToast(`Barcode not found: ${code}`, 'error');
    } finally {
      setSearching(false);
      // Keep the scan field ready for the next barcode (overrides the staff autofocus).
      setTimeout(() => {
        rowInputRef.current?.focus();
        rowInputRef.current?.select();
      }, 120);
    }
  };

  // Attach hardware scanner hook when POS popup is open
  useScannerInput(handleBarcodeScanned, { enabled: isPOSOpen && !completedOrder });

  // Manual search submit
  const handleSearchSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;

    const localPool = mergeProductLists(allProducts, remoteSearchProducts);
    const exactMatch = findExactProductMatch(localPool, q);
    if (exactMatch) {
      handlePickSuggestion(exactMatch.product, exactMatch.matchedVariant);
      return;
    }

    if (highlightedIndex >= 0 && suggestions[highlightedIndex]?.product) {
      handlePickSuggestion(suggestions[highlightedIndex].product, suggestions[highlightedIndex].matchedVariant);
      return;
    }

    setSearching(true);
    try {
      const serverProducts = await fetchServerProductMatches(q);
      const serverMatch = findExactProductMatch(serverProducts, q) || findProductMatches(serverProducts, q, 1)[0];
      if (serverMatch?.product) {
        handlePickSuggestion(serverMatch.product, serverMatch.matchedVariant);
        return;
      }
    } finally {
      setSearching(false);
    }

    if (suggestions.length > 0) {
      const item = suggestions[0];
      if (item && item.product) {
        handlePickSuggestion(item.product, item.matchedVariant);
        return;
      }
    }
    handleBarcodeScanned(q);
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
      mrp: Number(prod.mrp) || Number(prod.price) || Number(price) || 0,
      gst_rate: Number(prod.gst_rate) || 18,
      hsn_code: prod.hsn_code || '4202',
      image: variant?.image_url || prod.image,
      variant: variant || null,
      quantity: 1
    });

    setSearchInput('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  // Inline editable table row: resolve typed name/barcode and append as a new line item
  const handleRowSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    if (now - lastProcessedScanRef.current.time < 700) {
      return;
    }
    const q = rowInput.trim();
    if (!q) {
      rowInputRef.current?.focus();
      return;
    }

    if (looksLikeBarcode(q)) {
      if (
        lastProcessedScanRef.current.code.toLowerCase() === q.toLowerCase() &&
        now - lastProcessedScanRef.current.time < 1200
      ) {
        setRowInput('');
        return;
      }
      await handleBarcodeScanned(q);
      return;
    }

    const localPool = mergeProductLists(allProducts, remoteRowProducts);
    const exactMatch = findExactProductMatch(localPool, q);
    let pick = exactMatch;

    if (!pick && rowHighlightedIndex >= 0 && rowMatches[rowHighlightedIndex]?.product) {
      pick = rowMatches[rowHighlightedIndex];
    }

    if (!pick) {
      setSearching(true);
      try {
        const serverProducts = await fetchServerProductMatches(q);
        pick = findExactProductMatch(serverProducts, q) || findProductMatches(serverProducts, q, 1)[0] || rowMatches[0] || null;
      } finally {
        setSearching(false);
      }
    }

    if (pick && pick.product) {
      handlePickSuggestion(pick.product, pick.matchedVariant);
      setRowInput('');
      setShowRowSuggestions(false);
      setRowHighlightedIndex(-1);
      setTimeout(() => rowInputRef.current?.focus(), 120);
      return;
    }

    // Barcode-like input must resolve through the barcode lookup, never fall
    // through to a custom item (which would save the barcode as the name).
    if (looksLikeBarcode(q)) {
      await handleBarcodeScanned(q);
      return;
    }

    openCustomEntryMode(q);
    showToast(`"${q}" not in catalog — enter price to add as custom item`, 'info', 3000);
  };

  // F2 quick product search popup
  const openSearchModal = () => {
    setSearchModalQuery('');
    setSearchModalHighlighted(0);
    setIsSearchModalOpen(true);
    setShowRowSuggestions(false);
    setShowSuggestions(false);
    setTimeout(() => searchModalInputRef.current?.focus(), 40);
  };

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    setSearchModalQuery('');
    setSearchModalHighlighted(0);
    setTimeout(() => rowInputRef.current?.focus(), 0);
  };

  const handlePickSearchModalItem = (match) => {
    if (!match || !match.product) return;
    const prod = match.product;
    const variant = match.matchedVariant;
    const price = variant && variant.price ? variant.price : (prod.sale_price > 0 ? prod.sale_price : prod.price);
    const barcode = variant?.barcode || prod.barcode || `NP-${prod.id}`;

    handleAddItemToCart({
      product_id: prod.id,
      product_name: prod.name,
      barcode: barcode,
      barcode_short_name: prod.barcode_short_name || prod.name,
      price: Number(price) || 0,
      regular_price: Number(prod.price) || Number(price) || 0,
      mrp: Number(prod.mrp) || Number(prod.price) || Number(price) || 0,
      gst_rate: Number(prod.gst_rate) || 18,
      hsn_code: prod.hsn_code || '4202',
      image: variant?.image_url || prod.image,
      variant: variant || null,
      quantity: 1
    });

    setSearchModalQuery('');
    setSearchModalHighlighted(0);
    setTimeout(() => searchModalInputRef.current?.focus(), 0);
  };

  // Direct inline edits of a billing row (selling price)
  const updateItemField = (index, field, value) => {
    setCart(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
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

  const buildHeldPayload = () => {
    const chosenStaff = salespersons.find(s => String(s.id) === String(selectedSalespersonId));
    return {
      customer_name: customerName.trim() || 'Walk-in Customer',
      customer_phone: customerPhone.trim(),
      customer_email: cleanCustomerEmail(customerEmail),
      items: cart,
      discount_type: discountType,
      discount_value: cartFinancials.discountValue,
      payment_method: paymentMethod,
      sales_person_id: chosenStaff ? chosenStaff.id : null,
      sales_person_name: chosenStaff ? chosenStaff.name : null,
      is_accountable: isAccountable ? 1 : 0
    };
  };

  const resetActiveBill = () => {
    try {
      window.localStorage.removeItem(POS_DRAFT_KEY);
    } catch (err) {
      // ignore storage failures
    }
    setCart([]);
    setDiscountInput('');
    setDiscountType('flat');
    setReceivedAmount('');
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerFoundBadge(null);
    setCustomerNpPoints(0);
    setRedeemPoints(0);
    setResumedHeldId(null);
    setResumedHeldRef(null);
    setSearchInput('');
    setRowInput('');
    setShowSuggestions(false);
    setShowRowSuggestions(false);
    setRowHighlightedIndex(-1);
    if (typeof setEditingOrder === 'function') setEditingOrder(null);
  };

  // Keep a local safety copy while a bill is unfinished (survives refresh/crash)
  useEffect(() => {
    if (!isPOSOpen || cart.length === 0 || editingOrder) return;
    try {
      window.localStorage.setItem(
        POS_DRAFT_KEY,
        JSON.stringify({
          ...buildHeldPayload(),
          resumed_held_id: resumedHeldId || null,
          saved_at: Date.now()
        })
      );
    } catch (err) {
      // ignore storage failures (private mode / quota)
    }
  }, [
    isPOSOpen,
    cart,
    customerName,
    customerPhone,
    customerEmail,
    discountType,
    discountInput,
    paymentMethod,
    selectedSalespersonId,
    salespersons,
    editingOrder,
    resumedHeldId
  ]);

  const handleNewBill = async () => {
    // Never lose an unfinished bill: automatically park it in Held Bills first
    if (cart.length > 0) {
      await handleHoldBill();
      return;
    }
    resetActiveBill();
    showToast('Started fresh new bill session.', 'info', 2500);
    customerPhoneInputRef.current?.focus();
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Nothing to hold.', 'error');
      return false;
    }
    if (heldBills.length >= 15 && !resumedHeldId) {
      showToast('Maximum 15 bills can be held at once. Please resume or complete an existing held bill.', 'error', 4500);
      return false;
    }

    // 1. Snapshot current bill session data before clearing
    const payload = buildHeldPayload();
    const activeResumedId = resumedHeldId;
    const activeResumedRef = resumedHeldRef;
    const currentTotal = cartFinancials.finalTotal;
    const tempSlot = heldBills.length + 1;
    const tempRef = activeResumedRef || `HOLD-#${tempSlot}`;

    // 2. INSTANTLY save bill to queue & create fresh new bill session in 0ms
    resetActiveBill();
    showToast(`✓ Bill held as ${tempRef}! Fresh new bill session ready.`, 'success', 3000);

    // 3. Immediately focus customer input for the next customer
    setTimeout(() => {
      if (customerPhoneInputRef.current) {
        customerPhoneInputRef.current.focus();
      } else if (rowInputRef.current) {
        rowInputRef.current.focus();
      }
    }, 40);

    // 4. Optimistically update held queue in UI immediately
    if (!activeResumedId) {
      const optimisticBill = {
        id: `temp-${Date.now()}`,
        reference: tempRef,
        customer_name: payload.customer_name || 'Walk-in Customer',
        customer_phone: payload.customer_phone || '',
        items: payload.items,
        total_amount: currentTotal,
        created_at: new Date().toISOString()
      };
      setHeldBills(prev => [optimisticBill, ...prev.slice(0, 14)]);
    }

    // 5. Persist to database in background and sync
    setHoldingBill(true);
    try {
      if (activeResumedId) {
        await updateHeldBill(activeResumedId, payload);
      } else {
        await holdBill(payload);
      }
      await loadHeldBillsData();
    } catch (err) {
      console.error('Hold bill error:', err);
      showToast(`Could not persist held bill: ${err.message || 'Server error'}`, 'error', 4000);
      await loadHeldBillsData();
    } finally {
      setHoldingBill(false);
    }
    return true;
  };

  // Closing the register must never discard an unfinished bill
  const handleClosePOS = async () => {
    if (cart.length > 0 && !editingOrder) {
      const held = await handleHoldBill();
      if (!held) {
        const discard = window.confirm('This bill could not be held. Close the register and discard the current bill?');
        if (!discard) return;
        try {
          window.localStorage.removeItem(POS_DRAFT_KEY);
        } catch (err) {
          // ignore storage failures
        }
      }
    }
    closePOS();
  };

  const handleResumeHeldBill = (bill) => {
    if (!bill) return;
    if (cart.length > 0 && resumedHeldId !== bill.id) {
      const confirmed = window.confirm(
        `You currently have ${cart.length} item(s) in this session. Replace with ${bill.reference || 'held bill'}?\n\nTip: Click Cancel and then "HOLD BILL" if you want to save current items first.`
      );
      if (!confirmed) return;
    }
    setCustomerName(bill.customer_name || 'Walk-in Customer');
    setCustomerPhone(bill.customer_phone || '');
    setCustomerEmail(cleanCustomerEmail(bill.customer_email));
    setCustomerFoundBadge(null);
    setCustomerNpPoints(0);
    setRedeemPoints(0);
    setPaymentMethod(bill.payment_method || 'Cash');
    setDiscountType(bill.discount_type === 'percentage' || bill.discount_type === 'percent' ? 'percent' : 'flat');
    setDiscountInput(bill.discount_value !== undefined && bill.discount_value !== null ? String(bill.discount_value) : (bill.discount_amount ? String(bill.discount_amount) : ''));
    if (bill.sales_person_id) {
      const staffId = String(bill.sales_person_id);
      setSelectedSalespersonId(staffId);
      saveSalespersonId(staffId);
    }
    if (bill.is_accountable !== undefined && bill.is_accountable !== null) {
      setIsAccountable(Number(bill.is_accountable) !== 0);
    }
    setCart(Array.isArray(bill.items) ? bill.items : []);
    setResumedHeldId(bill.id);
    setResumedHeldRef(bill.reference || 'HOLD');
    setReceivedAmount('');
    setCompletedOrder(null);
    setIsHeldModalOpen(false);
    showToast(`✓ Resumed ${bill.reference || 'held bill'} (${bill.customer_name || 'Walk-in'})`, 'success', 3000);
    setTimeout(() => rowInputRef.current?.focus(), 150);
  };

  const handleCancelHeldBill = async (bill) => {
    if (!bill) return;
    if (!window.confirm(`Remove held bill ${bill.reference || ''}? It will stay removed from Held Bills.`)) return;
    try {
      await cancelHeldBill(bill.id);
      if (resumedHeldId === bill.id) {
        setResumedHeldId(null);
        setResumedHeldRef(null);
      }
      showToast('Held bill removed.', 'info');
      await loadHeldBillsData();
    } catch (err) {
      alert(`Could not cancel held bill: ${err.message || 'Server error'}`);
    }
  };

  // Cart financial calculations (Flat vs % discount, NPPoints redemption, GST 18% inclusive standard)
  const cartFinancials = useMemo(() => {
    const rawSubtotal = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * item.quantity), 0);
    const rawMrpTotal = cart.reduce((sum, item) => sum + ((Number(item.mrp || item.regular_price || item.price || 0)) * item.quantity), 0);
    const parsedDiscountVal = parseFloat(discountInput) || 0;

    let disc = 0;
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, parsedDiscountVal));
      disc = Math.round(((rawSubtotal * pct) / 100) * 100) / 100;
    } else {
      disc = Math.min(Math.max(0, parsedDiscountVal), rawSubtotal);
    }

    const prePointsTotal = Math.max(0, rawSubtotal - disc);

    // NPPoints Loyalty: 1 pt = ₹0.25 (25 paise discount)
    const maxRedeemablePoints = Math.min(customerNpPoints, Math.floor(prePointsTotal / 0.25));
    const validRedeemPoints = Math.min(maxRedeemablePoints, Math.max(0, parseInt(redeemPoints, 10) || 0));
    const pointsDiscount = Math.round(validRedeemPoints * 0.25 * 100) / 100;

    const unroundedTotal = Math.max(0, prePointsTotal - pointsDiscount);
    // User requirement: No paise (e.g. ₹150.25 becomes 151)
    const grandTotal = Math.ceil(unroundedTotal);
    const roundOff = Math.round((grandTotal - unroundedTotal) * 100) / 100;

    const totalMrp = Math.ceil(rawMrpTotal);
    const totalSellingPrice = Math.ceil(rawSubtotal);
    const totalSavings = Math.max(0, totalMrp - grandTotal);

    // Points earned on bill: For every ₹100 spent = 1 pt
    const pointsEarned = Math.floor(grandTotal / 100);

    const gstRate = 18;
    const taxableAmount = Math.round((grandTotal / (1 + (gstRate / 100))) * 100) / 100;
    const totalTax = Math.round((grandTotal - taxableAmount) * 100) / 100;
    const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

    const received = Number(receivedAmount) > 0 ? Number(receivedAmount) : 0;
    const changeDue = Math.max(0, received - grandTotal);

    return {
      rawSubtotal,
      totalMrp,
      totalSellingPrice,
      totalSavings,
      roundOff,
      discountAmount: disc,
      discountType,
      discountValue: parsedDiscountVal,
      prePointsTotal,
      maxRedeemablePoints,
      validRedeemPoints,
      pointsDiscount,
      pointsEarned,
      grandTotal,
      taxableAmount,
      totalTax,
      cgstAmount,
      sgstAmount,
      received,
      changeDue
    };
  }, [cart, discountType, discountInput, redeemPoints, customerNpPoints, receivedAmount]);

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
        customer_email: cleanCustomerEmail(customerEmail),
        branch_id: adminUser?.branch_id || null,
        payment_method: paymentMethod,
        is_accountable: isAccountable ? 1 : 0,
        discount_amount: cartFinancials.discountAmount,
        discount_type: discountType,
        discount_value: cartFinancials.discountValue,
        points_redeemed: cartFinancials.validRedeemPoints || 0,
        points_discount: cartFinancials.pointsDiscount || 0,
        adjusted_customer_points: customerNpPoints,
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
            mrp: item.mrp || item.regular_price || item.price,
            quantity: item.quantity,
            hsn_code: item.hsn_code || '4202',
            is_custom: Boolean(item.is_custom) || String(item.product_id || '').startsWith('custom-'),
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

      if (resumedHeldId) {
        try {
          await completeHeldBill(resumedHeldId, {
            order_id: orderObj?.id || orderObj?.order_id || null,
            order_number: orderObj?.order_number || null
          });
        } catch (holdErr) {
          console.warn('Could not mark held bill complete:', holdErr);
        }
        setResumedHeldId(null);
        setResumedHeldRef(null);
        loadHeldBillsData();
      }

      setCompletedOrder(orderObj);
      setCart([]);
      setCustomerEmail(cleanCustomerEmail(customerEmail));
      setDiscountInput('');
      setReceivedAmount('');
      loadCatalogProducts();
      try {
        window.localStorage.removeItem(POS_DRAFT_KEY);
      } catch (draftErr) {
        // ignore storage failures
      }
      if (setEditingOrder) setEditingOrder(null);
    } catch (err) {
      alert(`Checkout failed: ${err.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut listener (F2: search, F4: pay, F7: custom item, F8: hold & new, F9: clear, ESC: close, Ctrl+Shift+K: stealth mode)
  useEffect(() => {
    if (!isPOSOpen) return;
    const handleKeyDown = (e) => {
      // Stealth Mode Toggle (Pakka vs Kaccha): Ctrl+Shift+K or Alt+K
      if ((e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) || (e.altKey && (e.key === 'K' || e.key === 'k'))) {
        e.preventDefault();
        e.stopPropagation();
        setIsAccountable(prev => !prev);
        return;
      }

      if (isSearchModalOpen) {
        if (e.key === 'Escape' || e.key === 'F2') {
          e.preventDefault();
          e.stopPropagation();
          closeSearchModal();
        }
        return;
      }

      // HELD BILLS MODAL DEDICATED SHORTCUTS
      if (isHeldModalOpen) {
        if (e.key === 'Escape' || e.key === 'F6') {
          e.preventDefault();
          e.stopPropagation();
          setIsHeldModalOpen(false);
          return;
        }
        if (heldBills.length > 0) {
          const targetIndex = selectedHeldIndex >= 0 && selectedHeldIndex < heldBills.length ? selectedHeldIndex : 0;
          const targetBill = heldBills[targetIndex];

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedHeldIndex(prev => Math.min(prev + 1, heldBills.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedHeldIndex(prev => Math.max(prev - 1, 0));
            return;
          }
          // Resume Bill shortcut: Enter, 'r' or 'R'
          if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            if (targetBill) {
              handleResumeHeldBill(targetBill);
            }
            return;
          }
          // Cancel / Remove Bill shortcut: Delete, 'c' or 'C', 'x' or 'X'
          if (e.key === 'Delete' || e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (targetBill) {
              handleCancelHeldBill(targetBill);
            }
            return;
          }
          // 1-9 direct slot pick
          if (/^[1-9]$/.test(e.key)) {
            const slotNum = parseInt(e.key, 10);
            if (slotNum >= 1 && slotNum <= heldBills.length) {
              e.preventDefault();
              setSelectedHeldIndex(slotNum - 1);
              return;
            }
          }
        }
        return;
      }

      if (completedOrder && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        printThermalReceipt(completedOrder, thermalSettings);
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        if (!isHeldModalOpen && !isCustomModalOpen && !isStaffModalOpen && !completedOrder) {
          openSearchModal();
        }
      } else if (e.key === 'F3' || e.key === 'F10') {
        e.preventDefault();
        handleNewBill();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleCheckout();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setIsHeldModalOpen(prev => {
          if (!prev) {
            setSelectedHeldIndex(0);
            loadHeldBillsData();
          }
          return !prev;
        });
      } else if (e.key === 'F7') {
        e.preventDefault();
        if (isCustomEntryMode) {
          closeCustomEntryMode();
        } else {
          openCustomEntryMode(rowInput.trim());
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && !holdingBill) {
          handleHoldBill();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isCustomEntryMode) {
          closeCustomEntryMode();
          return;
        }
        if (isHeldModalOpen) {
          setIsHeldModalOpen(false);
          return;
        }
        if (isCustomModalOpen) {
          setIsCustomModalOpen(false);
          return;
        }
        if (isStaffModalOpen) {
          setIsStaffModalOpen(false);
          return;
        }
        if (completedOrder) {
          setCompletedOrder(null);
          return;
        }
        if (showRowSuggestions) {
          setShowRowSuggestions(false);
          return;
        }
        handleClosePOS();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPOSOpen, cart, cartFinancials, isCustomModalOpen, isStaffModalOpen, isHeldModalOpen, selectedHeldIndex, heldBills, completedOrder, showRowSuggestions, isSearchModalOpen, closePOS, handleClosePOS, thermalSettings]);

  // Thermal Receipt Printing (Standard ESC/POS HTML) - Pure Solid Black #000000 with 300 Bold Density
  function printThermalReceipt(orderData, overrideSettings) {
    const order = orderData || completedOrder;
    if (!order) return;

    const settings = { ...thermalSettings, ...(overrideSettings || {}) };
    const items = order.items || [];
    const orderNo = order.order_number || order.order?.order_number || `POS-${order.id || Date.now().toString().slice(-6)}`;
    const is58mm = settings.paperWidth === '58mm';
    const bodyWidth = is58mm ? '52mm' : '72mm';
    const fontSize = is58mm ? '9.5px' : '11px';
    const is300Bol = settings.density === '300bol';

    // Store details (Physical receipt sample exact details)
    const storeTitle = 'NP GRAND';
    const addrLine1 = 'Rajaji saalai,Opp to';
    const addrLine2 = 'kalaisangam,Theradi';
    const addrLine3 = 'Thiruvallur - 602001';
    const phoneStr = 'Mobile No : 9655858231';
    const gstStr = 'GST No : 33AJCPN5984H1ZZ';
    const webStr = 'Website : www.npgrandshopping.com';

    // Date & Time formatting (DD/MM/YY & hh:mm A)
    const orderDate = new Date(order.created_at || Date.now());
    const dd = String(orderDate.getDate()).padStart(2, '0');
    const mm = String(orderDate.getMonth() + 1).padStart(2, '0');
    const yy = String(orderDate.getFullYear()).slice(-2);
    const dateFormatted = `${dd}/${mm}/${yy}`;

    let hours = orderDate.getHours();
    const minutes = String(orderDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hh = String(hours).padStart(2, '0');
    const timeFormatted = `${hh}:${minutes} ${ampm}`;

    // Customer Name / Mobile
    const customerIdent = (order.customer_phone || customerPhone || order.customer_name || customerName || 'Walk-in').toUpperCase();

    // Line totals & Summary
    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 1), 0);
    const totalItemsCount = items.length;
    const totalMrp = items.reduce((s, it) => s + (Number(it.mrp || it.regular_price || it.price || 0) * Number(it.quantity || 1)), 0);
    const totalGross = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
    const billDiscount = Number(order.discount || order.discount_amount || cartFinancials?.discountAmount || 0);
    const netPayable = Math.max(0, Math.round(Number(order.total_amount || cartFinancials?.grandTotal || (totalGross - billDiscount))));
    const totalSavings = Math.max(0, totalMrp - netPayable);

    // GST Slabs breakdown (Dynamic slabs calculation)
    const gstMap = {};
    items.forEach(it => {
      let rate = 0;
      if (it.gst_rate !== undefined && it.gst_rate !== null && it.gst_rate !== '') {
        rate = Number(it.gst_rate);
      } else if (it.tax_rate !== undefined && it.tax_rate !== null && it.tax_rate !== '') {
        rate = Number(it.tax_rate);
      } else if (order.is_accountable === 0) {
        rate = 0;
      } else {
        rate = 18;
      }
      if (isNaN(rate)) rate = 0;
      const itQty = Number(it.quantity || 1);
      const itPrice = Number(it.price || 0);
      const itTotal = itQty * itPrice;

      if (!gstMap[rate]) {
        gstMap[rate] = { rate, gross: 0 };
      }
      gstMap[rate].gross += itTotal;
    });

    const slabRates = Object.keys(gstMap).map(Number).sort((a, b) => a - b);
    const slabBreakup = slabRates.length > 0 ? slabRates.map(rate => {
      const slab = gstMap[rate];
      const fraction = totalGross > 0 ? (slab.gross / totalGross) : 0;
      const slabDiscount = billDiscount * fraction;
      const slabNet = Math.max(0, slab.gross - slabDiscount);

      if (rate === 0) {
        return { rate: 0, sgst: 0, cgst: 0, taxable: slabNet };
      }
      const taxable = slabNet / (1 + (rate / 100));
      const totalTax = slabNet - taxable;
      const halfTax = totalTax / 2;
      return {
        rate,
        sgst: halfTax,
        cgst: halfTax,
        taxable
      };
    }) : [
      { rate: 0, sgst: 0, cgst: 0, taxable: netPayable }
    ];

    // Loyalty Points
    const loyaltyPts = order.customer_np_points !== undefined && order.customer_np_points !== null
      ? order.customer_np_points
      : (order.points_earned || cartFinancials?.pointsEarned || '');

    const renderReceiptBody = (copyLabel) => `
      <div class="receipt-section">
        <div class="center">
          <div class="store-title">${storeTitle}</div>
          <div class="header-line">${addrLine1}</div>
          <div class="header-line">${addrLine2}</div>
          <div class="header-line">${addrLine3}</div>
          <div class="header-line">${phoneStr}</div>
          <div class="header-line">${gstStr}</div>
          <div class="header-line">${webStr}</div>
          <div class="divider"></div>
          <div class="doc-title">TAX INVOICE</div>
          ${copyLabel && settings.copies === 2 ? `<div style="font-size: 9.5px; font-weight: 800; margin-top: 1px;">[ ${copyLabel} ]</div>` : ''}
        </div>

        <div class="divider"></div>
        <div class="meta-row">
          <div class="meta-left">NAME: ${customerIdent}</div>
          <div class="meta-right"><div>Bill No: ${orderNo}</div><div>Date   : ${dateFormatted}</div><div>Time   : ${timeFormatted}</div></div>
        </div>
        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="col-item">Particulars</th>
              <th class="col-qty">Qty</th>
              <th class="col-mrp">MRP</th>
              <th class="col-rate">Rate</th>
              <th class="col-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const itName = (it.product_name || it.name || 'ITEM').toUpperCase();
              const itQty = Number(it.quantity || 1);
              const itMrp = Number(it.mrp || it.regular_price || it.price || 0);
              const itRate = Number(it.price || 0);
              const itAmount = itQty * itRate;
              return `
                <tr>
                  <td class="col-item">${itName}</td>
                  <td class="col-qty">${itQty}</td>
                  <td class="col-mrp">${itMrp.toFixed(2)}</td>
                  <td class="col-rate">${itRate.toFixed(2)}</td>
                  <td class="col-amt">${itAmount.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="summary-row">
          <div class="summary-left">
            <div>Tot Items: &nbsp;${totalItemsCount}</div>
            <div>Tot Qty: &nbsp;&nbsp;&nbsp;${totalQty}</div>
          </div>
          <div class="summary-right">
            <div class="flex-line"><span>Total MRP :</span><span>${totalMrp.toFixed(2)}</span></div>
            ${billDiscount > 0 ? `
              <div class="flex-line"><span>Bill Discount :</span><span>${billDiscount.toFixed(2)}</span></div>
            ` : ''}
            <div style="border-top: 1px dashed #000000; margin: 3px 0;"></div>
            <div class="flex-line net-amt"><span>Net Amt :</span><span>${netPayable.toFixed(2)}</span></div>
          </div>
        </div>

        <div class="divider"></div>
        <div class="savings-banner">
          YOU HAVE SAVED: &nbsp;${Math.max(0, Math.round(totalSavings))}
        </div>
        <div class="divider"></div>

        <table class="gst-table">
          <thead>
            <tr>
              <th class="gst-col-rate">GST %</th>
              <th class="gst-col-sgst">SGST AMT</th>
              <th class="gst-col-cgst">CGST AMT</th>
              <th class="gst-col-tax">TAXABLE AMT</th>
            </tr>
          </thead>
          <tbody>
            ${slabBreakup.map(s => `
              <tr>
                <td class="gst-col-rate">${s.rate}</td>
                <td class="gst-col-sgst">${s.sgst.toFixed(2)}</td>
                <td class="gst-col-cgst">${s.cgst.toFixed(2)}</td>
                <td class="gst-col-tax">${s.taxable.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>

        <div class="loyalty-row">
          Total Loyalty Points : ${loyaltyPts !== '' ? loyaltyPts : ''}
        </div>
        <div class="divider"></div>

        <div class="terms-footer">
          <div class="terms-title">TERMS & CONDITIONS</div>
          <div>Goods once sold can't be taken back</div>
          <div>***No Exchange***No Return***</div>
          <div class="divider"></div>
          <div class="thank-you">*** Thank for Shopping Visit Again ***</div>
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
    padding: 3mm 2mm;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: ${fontSize};
    line-height: 1.3;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: 800;
    ${is300Bol ? 'text-shadow: 0 0 0.35px #000000; -webkit-font-smoothing: none;' : ''}
  }
  .receipt-section {
    page-break-inside: avoid;
  }
  .center { text-align: center; }
  .bold { font-weight: 900 !important; color: #000000 !important; }
  .store-title {
    font-size: ${is58mm ? '13px' : '15px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .header-line {
    font-size: ${is58mm ? '9px' : '10.5px'};
    line-height: 1.25;
  }
  .doc-title {
    font-size: ${is58mm ? '11px' : '12px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin: 2px 0;
  }
  .divider {
    border-top: 1px dashed #000000 !important;
    margin: 4px 0;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: ${fontSize};
    line-height: 1.35;
    margin: 2px 0;
  }
  .meta-left {
    text-align: left;
    max-width: 48%;
    word-break: break-word;
  }
  .meta-right {
    text-align: right;
    white-space: pre;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${is58mm ? '9px' : '10.5px'};
    margin: 2px 0;
  }
  .items-table th {
    border-bottom: 1px dashed #000000;
    padding: 3px 0;
    font-weight: 800;
  }
  .items-table td {
    padding: 2px 0;
    vertical-align: top;
  }
  .col-item {
    text-align: left;
    width: 28%;
    padding-left: 0 !important;
    padding-right: 2px !important;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  .col-qty {
    text-align: right;
    width: 11%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-mrp {
    text-align: right;
    width: 19%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-rate {
    text-align: right;
    width: 19%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-amt {
    text-align: right;
    width: 23%;
    white-space: nowrap;
    padding-left: 4px !important;
    padding-right: 0 !important;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: ${fontSize};
    margin: 2px 0;
  }
  .summary-left {
    text-align: left;
    line-height: 1.4;
  }
  .summary-right {
    text-align: right;
    min-width: 55%;
    line-height: 1.4;
  }
  .flex-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .net-amt {
    font-size: ${is58mm ? '12px' : '13.5px'};
    font-weight: 900;
  }
  .savings-banner {
    font-size: ${is58mm ? '11px' : '12px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin: 3px 0;
  }
  .gst-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${is58mm ? '8.5px' : '9.5px'};
    margin: 2px 0;
  }
  .gst-table th {
    padding: 2px 0;
    font-weight: 800;
  }
  .gst-table td {
    padding: 2px 0;
  }
  .gst-col-rate {
    text-align: left;
    width: 18%;
    padding-left: 0 !important;
    padding-right: 2px !important;
  }
  .gst-col-sgst {
    text-align: right;
    width: 26%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 3px !important;
  }
  .gst-col-cgst {
    text-align: right;
    width: 26%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 3px !important;
  }
  .gst-col-tax {
    text-align: right;
    width: 30%;
    white-space: nowrap;
    padding-left: 3px !important;
    padding-right: 0 !important;
  }
  .loyalty-row {
    font-size: ${fontSize};
    font-weight: 800;
    margin: 3px 0;
  }
  .terms-footer {
    text-align: center;
    font-size: ${is58mm ? '9px' : '10px'};
    line-height: 1.35;
    margin-top: 4px;
  }
  .terms-title {
    font-weight: 900;
    letter-spacing: 0.5px;
  }
  .thank-you {
    font-weight: 900;
    margin-top: 2px;
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
  }

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
    const orderItems = Array.isArray(ord.items) ? ord.items : cart;

    const message = encodeURIComponent(
      `Hello ${ord.customer_name || customerName},\n\n` +
      `Thank you for shopping at *${RECEIPT_STORE_NAME}*!\n\n` +
      `*Receipt No:* ${orderNo}\n` +
      `*Amount Paid:* Rs. ${total} (${(ord.payment_method || paymentMethod) || 'Cash'})\n` +
      `*Items:* ${orderItems.map(c => `${c.product_name} x ${c.quantity}`).join(', ')}\n\n` +
      `We hope you love your purchase. Visit us again at ${storeSettings.website}!`
    );

    window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
  };

  if (!isPOSOpen) return null;

  const posTheme = {
    isAccountable,
    bgOuter: isAccountable ? '#0f172a' : '#000000',
    bgHeader: isAccountable ? '#0b1120' : '#050505',
    borderHeader: isAccountable ? '#1e293b' : '#1f1f23',
    bgLayout: isAccountable ? '#f1f5f9' : '#050505',
    bgLeftCol: isAccountable ? '#ffffff' : '#09090b',
    borderCol: isAccountable ? '#cbd5e1' : '#27272a',
    bgTopBar: isAccountable ? '#f8fafc' : '#09090b',
    borderTopBar: isAccountable ? '#e2e8f0' : '#27272a',
    textMain: isAccountable ? '#0f172a' : '#f4f4f5',
    textMuted: isAccountable ? '#64748b' : '#a1a1aa',
    textSub: isAccountable ? '#475569' : '#a1a1aa',
    inputBg: isAccountable ? '#ffffff' : '#121215',
    inputBorder: isAccountable ? '#cbd5e1' : '#27272a',
    btnCustomBg: isAccountable ? '#0f172a' : '#18181b',
    btnCustomBorder: isAccountable ? 'none' : '1px solid #3f3f46',
    btnHoldBg: isAccountable ? '#b45309' : '#18181b',
    btnHoldBorder: isAccountable ? 'none' : '1px solid #3f3f46',
    btnNewBg: isAccountable ? '#ffffff' : '#18181b',
    btnNewColor: isAccountable ? '#1e293b' : '#f4f4f5',
    btnNewBorder: isAccountable ? '1.5px solid #cbd5e1' : '1px solid #3f3f46',
    btnRecallBg: heldBills.length > 0 ? (isAccountable ? '#fef3c7' : '#18181b') : (isAccountable ? '#ffffff' : '#18181b'),
    btnRecallBorder: heldBills.length > 0 ? (isAccountable ? '2px solid #b45309' : '1px solid #3f3f46') : (isAccountable ? '1.5px solid #cbd5e1' : '1px solid #27272a'),
    btnRecallColor: isAccountable ? '#92400e' : '#f4f4f5',
    tableHeadBg: isAccountable ? '#f8fafc' : '#121215',
    tableBorder: isAccountable ? '#f1f5f9' : '#18181b',
    tableRowEven: isAccountable ? '#ffffff' : '#09090b',
    tableRowOdd: isAccountable ? '#fcfcfc' : '#0d0d10',
    rightColBg: isAccountable ? '#f8fafc' : '#050505',
    cardBg: isAccountable ? '#ffffff' : '#09090b',
    cardBorder: isAccountable ? '#e2e8f0' : '#27272a',
    payableColor: isAccountable ? '#065935' : '#f4f4f5',
    btnPrimaryBg: isAccountable ? '#065935' : '#18181b',
    btnPrimaryBorder: isAccountable ? 'none' : '1px solid #3f3f46',
    payActiveBg: isAccountable ? '#ecfdf5' : '#18181b',
    payActiveBorder: isAccountable ? '2px solid #065935' : '2px solid #52525b',
    payActiveColor: isAccountable ? '#065935' : '#ffffff',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: posTheme.bgOuter,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        transition: 'background-color 0.2s ease'
      }}
    >
      {/* 1. TOP HEADER STRIP (Icon-Free, Full Width) */}
      <header
        style={{
          background: posTheme.bgHeader,
          borderBottom: `1px solid ${posTheme.borderHeader}`,
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
                background: posTheme.isAccountable ? '#065935' : '#27272a',
                color: posTheme.isAccountable ? '#ffffff' : '#a1a1aa',
                letterSpacing: '0.02em'
              }}
            >
              ACTIVE REGISTER
            </span>
          )}
          {adminUser?.branch_name && (
            <span
              style={{
                padding: '3px 9px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#047857',
                color: '#ffffff',
                letterSpacing: '0.02em'
              }}
            >
              🏢 {adminUser.branch_name}
            </span>
          )}
        </div>

        {/* Header Right: Shortcuts & Close Button (No Icons) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>[F2] Search</span>
            <span>[F4] Pay</span>
            <span>[F6] Held Bills</span>
            <span>[F7] Custom Item</span>
            <span>[F8] Hold Bill</span>
            <span>[F9] Clear Cart</span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClosePOS();
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

      {/* Floating Alert Popover (Right Corner) */}
      {statusMessage && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            background: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'success' ? '#065935' : '#1e293b',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. MAIN 2-COLUMN FULL-SCREEN LAYOUT */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: posTheme.bgLayout }}>
        {/* LEFT COLUMN: SCANNER, CUSTOMER, CART ITEMS (65% Width) */}
        <div
          style={{
            flex: '1 1 65%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${posTheme.borderCol}`,
            background: posTheme.bgLeftCol,
            overflow: 'hidden'
          }}
        >
          {/* Top Controls: Scanner Bar + Custom Item Button + Customer Inputs */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${posTheme.borderTopBar}`, background: posTheme.bgTopBar }}>
            {/* Top Action Toolbar: Custom Item, Hold Bill, New Bill, and Held Bills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                marginBottom: '14px'
              }}
            >
              {/* Left Buttons: Custom Item, Hold & New Bill, Fresh Blank Bill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (isCustomEntryMode) {
                      closeCustomEntryMode();
                    } else {
                      openCustomEntryMode(rowInput.trim());
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: isCustomEntryMode ? '#065935' : posTheme.btnCustomBg,
                    color: '#ffffff',
                    border: posTheme.btnCustomBorder,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Add miscellaneous or custom unlisted product [Shortcut F7]"
                >
                  <span>{isCustomEntryMode ? '✕ CLOSE CUSTOM ITEM [F7]' : '+ ADD CUSTOM ITEM [F7]'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleHoldBill}
                  disabled={holdingBill || cart.length === 0}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    background: cart.length === 0 ? (posTheme.isAccountable ? '#94a3b8' : '#27272a') : posTheme.btnHoldBg,
                    color: '#ffffff',
                    border: posTheme.btnHoldBorder,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: cart.length > 0 && posTheme.isAccountable ? '0 2px 6px rgba(180, 83, 9, 0.3)' : 'none'
                  }}
                  title="Park current bill in hold queue (up to 15 slots) and immediately open a fresh new bill session [Shortcut F8]"
                >
                  <span>{holdingBill ? 'HOLDING...' : resumedHeldId ? '⏸️ UPDATE & NEW BILL' : '⏸️ HOLD & NEW BILL [F8]'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewBill}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: posTheme.btnNewBg,
                    color: posTheme.btnNewColor,
                    border: posTheme.btnNewBorder,
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title="Start a fresh blank bill session [Shortcut F3]"
                >
                  <span>+ NEW BILL [F3]</span>
                </button>
              </div>

              {/* Right Action: Held Bills (Prominent & Always Visible) */}
              <button
                type="button"
                onClick={() => {
                  setIsHeldModalOpen(true);
                  setSelectedHeldIndex(0);
                  loadHeldBillsData();
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: posTheme.btnRecallBg,
                  color: posTheme.btnRecallColor,
                  border: posTheme.btnRecallBorder,
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: heldBills.length > 0 && posTheme.isAccountable ? '0 2px 8px rgba(180, 83, 9, 0.2)' : 'none',
                  flexShrink: 0
                }}
                title="View active held bills (up to 15 slots) [Shortcut F6]"
              >
                <span>RECALL [F6]</span>
                <span
                  style={{
                    background: heldBills.length > 0 ? (posTheme.isAccountable ? '#b45309' : '#3f3f46') : '#64748b',
                    color: '#ffffff',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: 900
                  }}
                >
                  {heldBills.length}/15
                </span>
              </button>
            </div>

            {/* Customer & Sales Staff Information (Autofocus on Mobile First per user instruction) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', alignItems: 'end' }}>
              {/* 1. Mobile Phone (FIRST KEYBOARD FOCUS) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: posTheme.isAccountable ? '#065935' : posTheme.textSub }}>
                    📱 MOBILE (AUTOFOCUS)
                  </label>
                  {customerFoundBadge && (
                    <span style={{ fontSize: '10px', color: posTheme.isAccountable ? '#065935' : '#a1a1aa', fontWeight: 800 }}>
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
                      rowInputRef.current?.focus();
                      rowInputRef.current?.select();
                    }
                  }}
                  placeholder="10-digit mobile [Press Enter to Scan]"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: customerFoundBadge ? (posTheme.isAccountable ? '2px solid #065935' : '2px solid #52525b') : (posTheme.isAccountable ? '1.5px solid #065935' : `1.5px solid ${posTheme.inputBorder}`),
                    background: customerFoundBadge ? (posTheme.isAccountable ? '#f0fdf4' : posTheme.inputBg) : posTheme.inputBg,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: posTheme.textMain,
                    outlineColor: posTheme.isAccountable ? '#065935' : '#52525b'
                  }}
                />
              </div>

              {/* 2. Customer Name */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: posTheme.textSub }}>
                    CUSTOMER NAME
                  </label>
                  {customerFoundBadge && (
                    <span style={{ fontSize: '10px', color: posTheme.isAccountable ? '#065935' : '#a1a1aa', fontWeight: 800 }}>
                      [RECOGNIZED] {customerNpPoints > 0 ? `• ⭐ ${customerNpPoints} NPPoints` : ''}
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
                      rowInputRef.current?.focus();
                    }
                  }}
                  placeholder="Walk-in Customer"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: customerFoundBadge ? (posTheme.isAccountable ? '1.5px solid #065935' : `1.5px solid ${posTheme.inputBorder}`) : `1px solid ${posTheme.inputBorder}`,
                    background: customerFoundBadge ? (posTheme.isAccountable ? '#f0fdf4' : posTheme.inputBg) : posTheme.inputBg,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: posTheme.textMain
                  }}
                />
              </div>

              {/* 3. Salesperson / Staff Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: posTheme.textSub }}>
                    SALES STAFF
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsStaffModalOpen(true)}
                    style={{ fontSize: '10px', color: posTheme.isAccountable ? '#065935' : '#a1a1aa', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    [+ MANAGE STAFF]
                  </button>
                </div>
                <select
                  value={selectedSalespersonId}
                  onChange={(e) => {
                    const spId = e.target.value;
                    setSelectedSalespersonId(spId);
                    saveSalespersonId(spId);
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
                    border: `1px solid ${posTheme.inputBorder}`,
                    fontSize: '13px',
                    fontWeight: 600,
                    color: posTheme.textMain,
                    background: posTheme.inputBg,
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: posTheme.textSub, marginBottom: '4px' }}>
                  EMAIL (OPTIONAL)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      rowInputRef.current?.focus();
                    }
                  }}
                  placeholder="customer@example.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${posTheme.inputBorder}`,
                    background: posTheme.inputBg,
                    fontSize: '13px',
                    color: posTheme.textMain
                  }}
                />
              </div>
            </div>
          </div>

          {/* RESUMED HELD BILL ACTIVE BANNER */}
          {resumedHeldId && (
            <div
              style={{
                margin: '0 20px 10px',
                padding: '10px 14px',
                background: '#fffbeb',
                border: '1.5px solid #f59e0b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
                <span style={{ fontSize: '15px' }}>⏸️</span>
                <span style={{ fontWeight: 800, color: '#92400e' }}>CURRENTLY RESUMED:</span>
                <span style={{ background: '#b45309', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: 900, fontSize: '12px' }}>
                  {resumedHeldRef || 'HELD BILL'}
                </span>
                <span style={{ color: '#78350f', fontWeight: 600 }}>
                  ({customerName || 'Walk-in'} • {cart.length} item{cart.length === 1 ? '' : 's'})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleHoldBill}
                  style={{
                    background: '#b45309',
                    color: '#ffffff',
                    border: 'none',
                    padding: '5px 12px',
                    borderRadius: '5px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Save any updates back to hold queue and start new bill"
                >
                  SAVE &amp; START NEW BILL
                </button>
                <button
                  type="button"
                  onClick={handleNewBill}
                  style={{
                    background: '#ffffff',
                    color: '#78350f',
                    border: '1px solid #d97706',
                    padding: '5px 12px',
                    borderRadius: '5px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Clear register to a clean new bill session"
                >
                  + NEW BLANK BILL
                </button>
              </div>
            </div>
          )}

          {/* LIVE QUICK HELD BILLS TRAY (UP TO 15 SLOTS) */}
          {heldBills.length > 0 && (
            <div
              style={{
                margin: '0 20px 10px',
                padding: '8px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflowX: 'auto'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 900, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>⏸️ HELD SLOTS ({heldBills.length}/15):</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flex: 1 }}>
                {heldBills.map((bill) => {
                  const isCurrent = resumedHeldId === bill.id;
                  const total = Number(bill.total_amount || 0).toLocaleString('en-IN');
                  return (
                    <div
                      key={bill.id}
                      onClick={() => handleResumeHeldBill(bill)}
                      title={`Click to resume ${bill.reference} (${bill.customer_name || 'Walk-in'} • ₹${total})`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isCurrent ? '#fef3c7' : '#f8fafc',
                        border: isCurrent ? '1.5px solid #b45309' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>{bill.reference}</strong>
                      <span style={{ color: '#475569', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bill.customer_name || 'Walk-in'}
                      </span>
                      <strong style={{ color: '#15803d' }}>₹{total}</strong>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelHeldBill(bill);
                        }}
                        title={`Remove ${bill.reference}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 800,
                          padding: '0 2px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHeldModalOpen(true);
                  setSelectedHeldIndex(0);
                  loadHeldBillsData();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#b45309',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textDecoration: 'underline'
                }}
                title="View All Held Bills [F6]"
              >
                View All [F6] &rarr;
              </button>
            </div>
          )}

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
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '260px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800, textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>#</th>
                    <th style={{ padding: '10px 14px' }}>PRODUCT &amp; BARCODE</th>
                    <th style={{ padding: '10px 14px' }}>STAFF</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>MRP</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>SELLING PRICE</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>QTY</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>TAX (18%)</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>TOTAL</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                        No items yet — type a product name or scan a barcode in the row below, then press <strong>Enter</strong> to add it.
                      </td>
                    </tr>
                  )}
                  {cart.map((item, idx) => {
                    const gstRate = Number(item.gst_rate) || 18;
                    const unitRate = Math.round((item.price / (1 + (gstRate / 100))) * 100) / 100;
                    const lineTotal = item.price * item.quantity;
                    const lineTaxable = Math.round((lineTotal / (1 + (gstRate / 100))) * 100) / 100;
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
                            id={`pos-item-staff-${idx}`}
                            value={item.sales_person_id || selectedSalespersonId || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const spObj = salespersons.find(s => String(s.id) === String(val));
                              if (val) {
                                setSelectedSalespersonId(val);
                                saveSalespersonId(val);
                              }
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
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const priceInput = document.getElementById(`pos-item-price-${idx}`);
                                if (priceInput) {
                                  priceInput.focus();
                                  priceInput.select();
                                } else {
                                  const qtyInput = document.getElementById(`pos-item-qty-${idx}`);
                                  if (qtyInput) {
                                    qtyInput.focus();
                                    qtyInput.select();
                                  }
                                }
                              }
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
                            title="Sales Person [Press Enter to jump to Selling Price]"
                          >
                            <option value="">Default ({salespersons.find(s => String(s.id) === String(selectedSalespersonId))?.name || 'Counter'})</option>
                            {salespersons.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name}</option>
                            ))}
                          </select>
                        </td>
                        {/* Rate / MRP Column: Actual Product MRP from catalog */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                            ₹{Number(item.mrp || item.regular_price || item.price || 0).toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                            Product MRP
                          </div>
                        </td>
                        {/* Selling Price Column: Bill-specific Selling Price (Editable only for this POS bill) */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <span style={{ color: '#065935', fontSize: '13px', fontWeight: 900 }}>₹</span>
                            <input
                              id={`pos-item-price-${idx}`}
                              type="number"
                              min="0"
                              step="any"
                              value={item.price}
                              onChange={(e) => updateItemField(idx, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const qtyInput = document.getElementById(`pos-item-qty-${idx}`);
                                  if (qtyInput) {
                                    qtyInput.focus();
                                    qtyInput.select();
                                  }
                                }
                              }}
                              style={{
                                width: '78px',
                                padding: '5px 6px',
                                borderRadius: '5px',
                                border: '1.5px solid #065935',
                                textAlign: 'right',
                                fontSize: '13.5px',
                                fontWeight: 800,
                                color: '#0f172a',
                                background: '#f0fdf4',
                                outline: 'none'
                              }}
                              title="Bill Selling Price (editable for this bill only — does not modify catalog price) [Press Enter to jump to Quantity]"
                            />
                          </div>
                          <div style={{ fontSize: '9.5px', color: '#065935', fontWeight: 800, marginTop: '2px' }}>
                            Bill Price
                          </div>
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
                            <input
                              id={`pos-item-qty-${idx}`}
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!Number.isNaN(val) && val > 0) updateItemField(idx, 'quantity', val);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  rowInputRef.current?.focus();
                                  rowInputRef.current?.select();
                                }
                              }}
                              style={{
                                width: '40px',
                                border: 'none',
                                outline: 'none',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '13px',
                                background: 'transparent',
                                color: '#0f172a'
                              }}
                              title="Quantity [Press Enter to jump to Next Product input]"
                            />
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
                <tfoot>
                  {isCustomEntryMode ? (
                    <tr style={{ background: '#f0fdf4', borderTop: '2px solid #065935' }}>
                      <td style={{ padding: '10px 14px', color: '#065935', fontWeight: 900, fontSize: '14px' }}>
                        ✦
                      </td>
                      <td colSpan={8} style={{ padding: '10px 14px' }}>
                        <form onSubmit={handleAddCustomProduct} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: '#065935', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            CUSTOM ITEM:
                          </span>

                          {/* Item Name / Description */}
                          <input
                            ref={customItemNameRef}
                            type="text"
                            required
                            placeholder="Item Name / Description *"
                            value={customItem.name}
                            onChange={(e) => setCustomItem(prev => ({ ...prev, name: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                closeCustomEntryMode();
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                customItemPriceRef.current?.focus();
                                customItemPriceRef.current?.select();
                              }
                            }}
                            style={{
                              flex: '2 1 180px',
                              minWidth: '150px',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1.5px solid #065935',
                              fontSize: '13px',
                              fontWeight: 700,
                              outline: 'none',
                              background: '#ffffff'
                            }}
                          />

                          {/* MRP */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>MRP ₹</span>
                            <input
                              ref={customItemMrpRef}
                              type="number"
                              step="any"
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
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  closeCustomEntryMode();
                                } else if (e.key === 'Enter') {
                                  e.preventDefault();
                                  customItemPriceRef.current?.focus();
                                  customItemPriceRef.current?.select();
                                }
                              }}
                              style={{
                                width: '88px',
                                padding: '8px 8px',
                                borderRadius: '6px',
                                border: '1.5px solid #cbd5e1',
                                fontSize: '13px',
                                fontWeight: 700,
                                textAlign: 'right',
                                outline: 'none',
                                background: '#ffffff'
                              }}
                            />
                          </div>

                          {/* Selling Price */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 900, color: '#065935' }}>PRICE ₹*</span>
                            <input
                              ref={customItemPriceRef}
                              type="number"
                              step="any"
                              min="0.01"
                              required
                              placeholder="e.g. 999"
                              value={customItem.price}
                              onChange={(e) => setCustomItem(prev => ({ ...prev, price: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  closeCustomEntryMode();
                                } else if (e.key === 'Enter') {
                                  e.preventDefault();
                                  customItemQtyRef.current?.focus();
                                  customItemQtyRef.current?.select();
                                }
                              }}
                              style={{
                                width: '92px',
                                padding: '8px 8px',
                                borderRadius: '6px',
                                border: '2px solid #065935',
                                fontSize: '13px',
                                fontWeight: 900,
                                color: '#065935',
                                textAlign: 'right',
                                outline: 'none',
                                background: '#ffffff'
                              }}
                            />
                          </div>

                          {/* Quantity */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>QTY</span>
                            <input
                              ref={customItemQtyRef}
                              type="number"
                              min="1"
                              value={customItem.quantity}
                              onChange={(e) => setCustomItem(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  closeCustomEntryMode();
                                }
                              }}
                              style={{
                                width: '55px',
                                padding: '8px 6px',
                                borderRadius: '6px',
                                border: '1.5px solid #cbd5e1',
                                fontSize: '13px',
                                fontWeight: 800,
                                textAlign: 'center',
                                outline: 'none',
                                background: '#ffffff'
                              }}
                            />
                          </div>

                          {/* Submit */}
                          <button
                            type="submit"
                            style={{
                              padding: '8px 16px',
                              borderRadius: '6px',
                              background: '#065935',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 900,
                              cursor: 'pointer',
                              letterSpacing: '0.02em',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            + ADD TO BILL [ENTER]
                          </button>

                          {/* Cancel */}
                          <button
                            type="button"
                            onClick={closeCustomEntryMode}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              color: '#64748b',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Cancel custom mode and return to barcode/product search [ESC]"
                          >
                            ✕ CANCEL [ESC]
                          </button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr style={{ background: '#ecfdf5', borderTop: '2px solid #065935' }}>
                      <td style={{ padding: '10px 14px', color: '#065935', fontWeight: 900, fontSize: '15px' }}>+</td>
                      <td colSpan={8} style={{ padding: '8px 14px' }}>
                        <form onSubmit={handleRowSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div ref={rowContainerRef} style={{ position: 'relative', flex: 1 }}>
                            <input
                              ref={rowInputRef}
                              type="text"
                              value={rowInput}
                              onChange={(e) => {
                                setRowInput(e.target.value);
                                setShowRowSuggestions(true);
                                setRowHighlightedIndex(-1);
                              }}
                              onFocus={() => setShowRowSuggestions(true)}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  if (!showRowSuggestions && rowMatches.length > 0) setShowRowSuggestions(true);
                                  setRowHighlightedIndex(prev => Math.min(prev + 1, rowMatches.length - 1));
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setRowHighlightedIndex(prev => Math.max(prev - 1, -1));
                                } else if (e.key === 'Escape') {
                                  setShowRowSuggestions(false);
                                }
                              }}
                              placeholder="Type product name or scan barcode, press Enter to add next row..."
                              style={{
                                width: '100%',
                                padding: '9px 12px',
                                borderRadius: '6px',
                                border: '1.5px solid #065935',
                                fontSize: '13px',
                                fontWeight: 600,
                                background: '#ffffff',
                                color: '#0f172a',
                                outline: 'none'
                              }}
                            />
                            {showRowSuggestions && rowInput.trim() && rowMatches.length > 0 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 'calc(100% + 4px)',
                                  left: 0,
                                  right: 0,
                                  background: '#ffffff',
                                  border: '2px solid #065935',
                                  borderRadius: '8px',
                                  boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
                                  maxHeight: '280px',
                                  overflowY: 'auto',
                                  zIndex: 200
                                }}
                              >
                                {rowMatches.map((match, sIdx) => {
                                  const p = match.product;
                                  const v = match.matchedVariant;
                                  const displayPrice = v && v.price ? v.price : (p.sale_price > 0 ? p.sale_price : p.price);
                                  const bc = v?.barcode || p.barcode || `NP-${p.id}`;
                                  return (
                                    <div
                                      key={`row-${p.id}-${v?.id || 'main'}-${sIdx}`}
                                      onClick={() => {
                                        handlePickSuggestion(p, v);
                                        setRowInput('');
                                        setShowRowSuggestions(false);
                                        setRowHighlightedIndex(-1);
                                        setTimeout(() => rowInputRef.current?.focus(), 0);
                                      }}
                                      onMouseEnter={() => setRowHighlightedIndex(sIdx)}
                                      style={{
                                        padding: '8px 12px',
                                        borderBottom: '1px solid #f1f5f9',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: sIdx === rowHighlightedIndex ? '#ecfdf5' : '#ffffff'
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontWeight: 800, fontSize: '12.5px', color: '#0f172a' }}>
                                          {p.name} {v ? `— ${v.color_name || ''} ${v.size_name || ''}` : ''}
                                        </div>
                                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                          <span style={{ fontWeight: 800, color: '#065935' }}>{bc}</span> · Stock {v?.stock_quantity ?? p.stock_quantity ?? 50}
                                        </div>
                                      </div>
                                      <div style={{ fontWeight: 900, fontSize: '13px', color: '#0f172a' }}>
                                        ₹{Number(displayPrice).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <button
                            type="submit"
                            disabled={searching}
                            style={{
                              padding: '9px 16px',
                              borderRadius: '6px',
                              background: '#065935',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 800,
                              letterSpacing: '0.03em',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {searching ? 'ADDING...' : 'ADD ROW [ENTER]'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openCustomEntryMode(rowInput.trim())}
                            style={{
                              padding: '9px 14px',
                              borderRadius: '6px',
                              background: '#f8fafc',
                              color: '#065935',
                              border: '1.5px solid #065935',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                            title="Switch to inline custom item entry [F7]"
                          >
                            + CUSTOM ITEM [F7]
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
          </div>
        </div>

        {/* RIGHT COLUMN: FINANCIAL SUMMARY, PAYMENT & CHECKOUT (35% Width) */}
        <div
          style={{
            flex: '1 1 35%',
            display: 'flex',
            flexDirection: 'column',
            background: posTheme.rightColBg,
            borderLeft: `1px solid ${posTheme.borderCol}`,
            padding: '20px',
            overflowY: 'auto'
          }}
        >
          {/* Bill Summary Card */}
          <div style={{ background: posTheme.cardBg, borderRadius: '10px', border: `1px solid ${posTheme.cardBorder}`, padding: '18px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: posTheme.textMain, letterSpacing: '0.04em', marginBottom: '12px', borderBottom: `1px solid ${posTheme.borderTopBar}`, paddingBottom: '8px' }}>
              BILL CALCULATION
            </div>

            {/* Total MRP */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: posTheme.textSub }}>
              <span style={{ fontWeight: 600 }}>Total MRP</span>
              <span style={{ fontWeight: 700, color: posTheme.textMain }}>
                ₹{cartFinancials.totalMrp.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Final Price (Selling Price) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: posTheme.textSub }}>
              <span style={{ fontWeight: 600 }}>Final Price (Selling Price) ({cart.reduce((s, i) => s + i.quantity, 0)} items)</span>
              <span style={{ fontWeight: 800, color: posTheme.textMain }}>
                ₹{cartFinancials.totalSellingPrice.toLocaleString('en-IN')}
              </span>
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
                    border: `1px solid ${posTheme.inputBorder}`,
                    fontSize: '11px',
                    fontWeight: 700,
                    background: posTheme.inputBg,
                    color: posTheme.textMain,
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
                    border: `1.5px solid ${posTheme.inputBorder}`,
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#ef4444',
                    background: posTheme.inputBg
                  }}
                />
                {discountType === 'percent' && (
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap' }}>
                    (-₹{cartFinancials.discountAmount.toFixed(2)})
                  </span>
                )}
              </div>
            </div>

            {/* Royalty / NPPoints Loyalty Section */}
            {customerNpPoints === 0 && !showRoyaltyAdjust ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 10px 0' }}>
                <button
                  type="button"
                  onClick={() => setShowRoyaltyAdjust(true)}
                  style={{
                    background: 'transparent',
                    border: `1px dashed ${posTheme.isAccountable ? '#d97706' : '#fbbf24'}`,
                    color: posTheme.isAccountable ? '#b45309' : '#fbbf24',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>⭐</span>
                  <span>Adjust Royalty Points in Bill</span>
                </button>
              </div>
            ) : (
              <div style={{ background: posTheme.isAccountable ? '#fffbeb' : posTheme.inputBg, border: posTheme.isAccountable ? '1px solid #fef3c7' : `1px solid ${posTheme.cardBorder}`, borderRadius: '8px', padding: '10px 12px', margin: '8px 0 10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '13px' }}>⭐</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: posTheme.isAccountable ? '#92400e' : '#fbbf24' }}>Royalty Points:</span>
                    <span style={{ fontSize: '12.5px', fontWeight: 900, color: posTheme.isAccountable ? '#b45309' : '#fbbf24' }}>{customerNpPoints} pts</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = window.prompt('Adjust Customer Royalty / NPPoints balance:', String(customerNpPoints));
                        if (nextVal !== null) {
                          const parsed = Math.max(0, parseInt(nextVal, 10) || 0);
                          setCustomerNpPoints(parsed);
                          setShowRoyaltyAdjust(true);
                        }
                      }}
                      title="Adjust customer royalty points balance"
                      style={{
                        marginLeft: '4px',
                        background: posTheme.isAccountable ? '#fef3c7' : '#27272a',
                        color: posTheme.isAccountable ? '#92400e' : '#fbbf24',
                        border: '1px solid #d97706',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '1px 6px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Adjust Points
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: posTheme.textMuted, fontWeight: 700 }}>
                    (Worth: ₹{(customerNpPoints * 0.25).toFixed(2)})
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <div style={{ fontSize: '11.5px', color: posTheme.isAccountable ? '#92400e' : '#fbbf24', fontWeight: 600 }}>
                    Redeem Points (1 pt = ₹0.25):
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={cartFinancials.maxRedeemablePoints}
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(Math.min(cartFinancials.maxRedeemablePoints, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                      placeholder="0"
                      style={{
                        width: '75px',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        border: `1.5px solid ${posTheme.isAccountable ? '#d97706' : posTheme.inputBorder}`,
                        textAlign: 'right',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        color: posTheme.isAccountable ? '#b45309' : '#fbbf24',
                        background: posTheme.inputBg
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setRedeemPoints(cartFinancials.maxRedeemablePoints)}
                      style={{
                        padding: '3px 7px',
                        borderRadius: '4px',
                        background: '#d97706',
                        color: '#fff',
                        border: 'none',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {cartFinancials.pointsDiscount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11.5px', fontWeight: 800, color: '#15803d' }}>
                    <span>Royalty Points Discount:</span>
                    <span>-₹{cartFinancials.pointsDiscount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: posTheme.textMuted }}>
              <span>Taxable Value</span>
              <span>₹{cartFinancials.taxableAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: posTheme.textMuted }}>
              <span>CGST (9%)</span>
              <span>₹{cartFinancials.cgstAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: posTheme.textMuted }}>
              <span>SGST (9%)</span>
              <span>₹{cartFinancials.sgstAmount.toFixed(2)}</span>
            </div>

            {cartFinancials.roundOff > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#16a34a', fontWeight: 700 }}>
                <span>Round Off (No Paise)</span>
                <span>+₹{cartFinancials.roundOff.toFixed(2)}</span>
              </div>
            )}

            <div
              style={{
                borderTop: `2px dashed ${posTheme.borderTopBar}`,
                paddingTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <span style={{ fontSize: '15px', fontWeight: 900, color: posTheme.textMain }}>NET PAYABLE</span>
              <span style={{ fontSize: '26px', fontWeight: 900, color: posTheme.payableColor }}>
                ₹{cartFinancials.grandTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {/* YOU SAVE BANNER (Prominently displayed) */}
            {cartFinancials.totalSavings > 0 && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  border: '1.5px dashed #059669',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(5, 150, 105, 0.08)'
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#065f46', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🎉</span> YOU SAVE:
                </span>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#047857' }}>
                  ₹{cartFinancials.totalSavings.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            <div style={{ marginTop: '10px', padding: '6px 10px', background: posTheme.isAccountable ? '#f0fdf4' : posTheme.inputBg, border: posTheme.isAccountable ? '1px solid #bbf7d0' : `1px solid ${posTheme.cardBorder}`, borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 700, color: posTheme.isAccountable ? '#166534' : '#a1a1aa' }}>
              <span>✨ NPPoints to be earned:</span>
              <span style={{ fontWeight: 900, fontSize: '12px', color: posTheme.isAccountable ? '#166534' : '#f4f4f5' }}>+{cartFinancials.pointsEarned} pts (₹100 = 1pt)</span>
            </div>
          </div>

          {/* Payment Method Selector (Icon-Free Clean Buttons) */}
          <div style={{ background: posTheme.cardBg, borderRadius: '10px', border: `1px solid ${posTheme.cardBorder}`, padding: '18px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 900, color: posTheme.textMain, letterSpacing: '0.04em', marginBottom: '12px' }}>
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
                    border: paymentMethod === m ? posTheme.payActiveBorder : `1px solid ${posTheme.inputBorder}`,
                    background: paymentMethod === m ? posTheme.payActiveBg : posTheme.inputBg,
                    color: paymentMethod === m ? posTheme.payActiveColor : posTheme.textSub,
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: posTheme.textSub, marginBottom: '6px' }}>
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
                    border: `1.5px solid ${posTheme.inputBorder}`,
                    background: posTheme.inputBg,
                    fontSize: '16px',
                    fontWeight: 800,
                    color: posTheme.textMain,
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
                        border: `1px solid ${posTheme.inputBorder}`,
                        background: posTheme.inputBg,
                        color: posTheme.textMain,
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
                      border: posTheme.payActiveBorder,
                      background: posTheme.payActiveBg,
                      color: posTheme.payActiveColor,
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
                    background: cartFinancials.changeDue > 0 ? (posTheme.isAccountable ? '#fef3c7' : '#18181b') : (posTheme.isAccountable ? '#f1f5f9' : '#121215'),
                    border: cartFinancials.changeDue > 0 ? (posTheme.isAccountable ? '1px solid #f59e0b' : '1px solid #3f3f46') : `1px solid ${posTheme.cardBorder}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: posTheme.isAccountable ? '#78350f' : '#f4f4f5' }}>CHANGE RETURN:</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: posTheme.isAccountable ? '#78350f' : '#f4f4f5' }}>
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
              background: cart.length === 0 ? (posTheme.isAccountable ? '#94a3b8' : '#27272a') : posTheme.btnPrimaryBg,
              color: '#ffffff',
              border: posTheme.btnPrimaryBorder,
              fontSize: '16px',
              fontWeight: 900,
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.04em',
              boxShadow: cart.length > 0 && posTheme.isAccountable ? '0 4px 14px rgba(6, 89, 53, 0.35)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {isSubmitting
              ? (editingOrder ? 'UPDATING BILL...' : 'PROCESSING BILL...')
              : (editingOrder ? `SAVE & UPDATE BILL [F4]` : 'COMPLETE SALE [F4]')}
          </button>
        </div>
      </div>

      {/* HELD BILLS MODAL */}
      {isHeldModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsHeldModalOpen(false);
          }}
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
              width: '760px',
              maxWidth: '100%',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.28)'
            }}
          >
            <div style={{ padding: '16px 20px', background: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>HELD BILLS QUEUE</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, background: '#b45309', color: '#ffffff', padding: '2px 8px', borderRadius: '12px' }}>
                    {heldBills.length} / 15 SLOTS IN USE
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '3px' }}>
                  Unfinished bills are parked here automatically. Resume any bill to complete checkout, or remove it when no longer needed.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHeldModalOpen(false)}
                style={{ background: 'transparent', border: '1px solid #64748b', color: '#e2e8f0', borderRadius: '6px', padding: '6px 12px', fontWeight: 800, cursor: 'pointer' }}
              >
                CLOSE
              </button>
            </div>

            <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              {loadingHeldBills ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>Loading held bills...</div>
              ) : heldBills.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>NO HELD BILLS</div>
                  <div style={{ fontSize: '12.5px' }}>Click <strong>HOLD &amp; NEW BILL [F8]</strong> while billing to park up to 15 customer carts here.</div>
                </div>
              ) : (
                heldBills.map((bill, idx) => {
                  const billDate = bill.created_at ? new Date(bill.created_at) : null;
                  const itemCount = Array.isArray(bill.items)
                    ? bill.items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0)
                    : 0;
                  const isCurrent = resumedHeldId === bill.id;
                  const isSelected = selectedHeldIndex === idx;
                  return (
                    <div
                      key={bill.id}
                      onClick={() => setSelectedHeldIndex(idx)}
                      style={{
                        background: isSelected ? '#f0fdf4' : '#ffffff',
                        border: isSelected ? '2px solid #065935' : (isCurrent ? '2px solid #b45309' : '1px solid #e2e8f0'),
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginBottom: '10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'center',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 14px rgba(6, 89, 53, 0.16)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 900, color: isSelected ? '#065935' : '#64748b', background: isSelected ? '#dcfce7' : '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            SLOT #{idx + 1} {idx < 9 ? `[Key ${idx + 1}]` : ''}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: '10px', fontWeight: 900, background: '#065935', color: '#ffffff', padding: '2px 6px', borderRadius: '4px' }}>
                              ▶ SELECTED
                            </span>
                          )}
                          <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>{bill.reference}</span>
                          {isCurrent && (
                            <span style={{ fontSize: '10px', fontWeight: 900, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>
                              ● IN REGISTER
                            </span>
                          )}
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '2px 7px', borderRadius: '4px' }}>
                            ₹{Number(bill.total_amount || 0).toLocaleString('en-IN')}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{itemCount} item(s)</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#334155', fontWeight: 700, marginTop: '4px' }}>
                          {bill.customer_name || 'Walk-in Customer'}
                          {bill.customer_phone ? ` • 📞 ${bill.customer_phone}` : ''}
                          {bill.sales_person_name ? ` • 👤 Staff: ${bill.sales_person_name}` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {billDate ? billDate.toLocaleString('en-IN') : ''}
                          {Array.isArray(bill.items) && bill.items.length > 0
                            ? ` • ${bill.items.slice(0, 3).map(i => i.product_name || i.name || 'Item').join(', ')}${bill.items.length > 3 ? '…' : ''}`
                            : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResumeHeldBill(bill);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: isCurrent ? '#fef3c7' : (isSelected ? '#065935' : '#047857'),
                            color: isCurrent ? '#92400e' : '#ffffff',
                            border: isCurrent ? '1.5px solid #d97706' : 'none',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: isSelected ? '0 2px 8px rgba(6, 89, 53, 0.3)' : 'none'
                          }}
                          title="Resume this bill session (Shortcut: Enter or R)"
                        >
                          <span>{isCurrent ? 'IN REGISTER' : 'RESUME'}</span>
                          <span style={{ fontSize: '10px', opacity: 0.9, fontWeight: 800, background: 'rgba(0,0,0,0.18)', padding: '1px 5px', borderRadius: '3px' }}>
                            [ENTER / R]
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelHeldBill(bill);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            color: '#dc2626',
                            border: '1.5px solid #fca5a5',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Cancel / remove this bill (Shortcut: Del or C)"
                        >
                          <span>CANCEL</span>
                          <span style={{ fontSize: '10px', opacity: 0.9, fontWeight: 800, background: '#fee2e2', color: '#991b1b', padding: '1px 5px', borderRadius: '3px' }}>
                            [DEL / C]
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#475569', fontWeight: 700, flexWrap: 'wrap' }}>
                <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#0f172a', fontWeight: 900 }}>⌨️ SHORTCUTS:</span>
                <span><strong style={{ color: '#065935' }}>[Enter]</strong> or <strong style={{ color: '#065935' }}>[R]</strong> Resume</span>
                <span>•</span>
                <span><strong style={{ color: '#dc2626' }}>[Del]</strong> or <strong style={{ color: '#dc2626' }}>[C]</strong> Cancel</span>
                <span>•</span>
                <span><strong>[↑ / ↓]</strong> Navigate</span>
                <span>•</span>
                <span><strong>[1-9]</strong> Select Slot</span>
                <span>•</span>
                <span><strong>[Esc]</strong> Close</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  {heldBills.length} active held bill(s) — {15 - heldBills.length} slots available
                </span>
                <button
                  type="button"
                  onClick={loadHeldBillsData}
                  style={{ background: 'transparent', border: 'none', color: '#065935', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
                >
                  REFRESH
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* F2 QUICK PRODUCT SEARCH POPUP */}
      {isSearchModalOpen && (
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
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSearchModal();
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '82%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#0f172a' }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
                QUICK PRODUCT SEARCH [F2]
              </div>
              <button
                type="button"
                onClick={closeSearchModal}
                style={{ background: 'none', border: '1px solid #64748b', borderRadius: '5px', color: '#e2e8f0', fontWeight: 800, cursor: 'pointer', fontSize: '11px', padding: '5px 10px' }}
              >
                CLOSE [ESC]
              </button>
            </div>

            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <input
                ref={searchModalInputRef}
                type="text"
                value={searchModalQuery}
                onChange={(e) => {
                  setSearchModalQuery(e.target.value);
                  setSearchModalHighlighted(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSearchModalHighlighted(prev => Math.min(prev + 1, Math.max(searchModalMatches.length - 1, 0)));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSearchModalHighlighted(prev => Math.max(prev - 1, 0));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const pick = searchModalMatches[searchModalHighlighted];
                    if (pick) handlePickSearchModalItem(pick);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSearchModal();
                  }
                }}
                placeholder="Type product name, SKU or scan barcode..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '7px',
                  border: '1.5px solid #065935',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
              {searchModalMatches.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No products found. Try another name, SKU or barcode.
                </div>
              ) : (
                searchModalMatches.map((match, sIdx) => {
                  const p = match.product;
                  const v = match.matchedVariant;
                  const displayPrice = v && v.price ? v.price : (p.sale_price > 0 ? p.sale_price : p.price);
                  const bc = v?.barcode || p.barcode || `NP-${p.id}`;
                  return (
                    <div
                      key={`f2-${p.id}-${v?.id || 'main'}-${sIdx}`}
                      onClick={() => handlePickSearchModalItem(match)}
                      onMouseEnter={() => setSearchModalHighlighted(sIdx)}
                      style={{
                        padding: '10px 20px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '14px',
                        background: sIdx === searchModalHighlighted ? '#ecfdf5' : '#ffffff'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                          {p.name} {v ? `— ${v.color_name || ''} ${v.size_name || ''}` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          <span style={{ fontWeight: 800, color: '#065935' }}>{bc}</span>
                          {' · '}Stock {v?.stock_quantity ?? p.stock_quantity ?? 0}
                          {p.category_name ? ` · ${p.category_name}` : ''}
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '14px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        ₹{Number(displayPrice || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>
                ↑ ↓ Navigate · Enter Add · Esc Close
              </span>
              <span style={{ fontSize: '11.5px', color: '#065935', fontWeight: 800 }}>
                {searchModalMatches.length} result(s)
              </span>
            </div>
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
                        {RECEIPT_STORE_NAME}
                      </div>
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
                    {(() => {
                      const previewItems = completedOrder.items || [];
                      const previewTotalMrp = Math.ceil(previewItems.reduce((s, it) => s + (Number(it.mrp || it.regular_price || it.price || 0) * Number(it.quantity || 1)), 0));
                      const previewTotalSellingPrice = Math.ceil(previewItems.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0));
                      const previewNetPayable = Math.ceil(Number(completedOrder.total_amount || cartFinancials.grandTotal || previewTotalSellingPrice));
                      const previewSavings = Math.max(0, previewTotalMrp - previewNetPayable);

                      return (
                        <>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: thermalSettings.paperWidth === '58mm' ? '9px' : '10px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1.5px dashed #000000', textAlign: 'left' }}>
                                <th style={{ padding: '3px 0', width: '38%' }}>ITEM</th>
                                <th style={{ padding: '3px 0', textAlign: 'right', width: '10%' }}>QTY</th>
                                <th style={{ padding: '3px 0', textAlign: 'right', width: '17%' }}>MRP</th>
                                <th style={{ padding: '3px 0', textAlign: 'right', width: '17%' }}>PRICE</th>
                                <th style={{ padding: '3px 0', textAlign: 'right', width: '18%' }}>TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewItems.map((it, idx) => {
                                const itMrp = Number(it.mrp || it.regular_price || it.price || 0);
                                const itPrice = Number(it.price || 0);
                                const itQty = Number(it.quantity || 1);
                                const itTotal = itQty * itPrice;
                                return (
                                  <tr key={idx} style={{ verticalAlign: 'top' }}>
                                    <td style={{ padding: '3px 0' }}>
                                      <div style={{ fontWeight: 900 }}>{it.product_name}</div>
                                      <div style={{ fontSize: '8.5px', fontWeight: 700 }}>[{it.barcode || it.sku || 'ITEM'}]</div>
                                    </td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 900 }}>{itQty}</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right' }}>{itMrp.toFixed(2)}</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 800 }}>{itPrice.toFixed(2)}</td>
                                    <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 900 }}>{itTotal.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          <div style={{ borderTop: '1.5px dashed #000000', margin: '6px 0' }} />

                          {/* Financial summary */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                            <span>Items Count:</span>
                            <span style={{ fontWeight: 900 }}>{previewItems.reduce((s, i) => s + Number(i.quantity || 1), 0)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                            <span>Total MRP:</span>
                            <span style={{ fontWeight: 900 }}>Rs. {previewTotalMrp}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0' }}>
                            <span>Final Price (Selling Price):</span>
                            <span style={{ fontWeight: 900 }}>Rs. {previewTotalSellingPrice}</span>
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

                          {(Number(completedOrder.points_discount) > 0 || cartFinancials.pointsDiscount > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0', fontWeight: 900 }}>
                              <span>NPPoints Redeemed:</span>
                              <span>- Rs. {(Number(completedOrder.points_discount) || cartFinancials.pointsDiscount).toFixed(2)}</span>
                            </div>
                          )}
                          {(Number(completedOrder.points_earned) > 0 || cartFinancials.pointsEarned > 0) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0', fontWeight: 900 }}>
                              <span>NPPoints Earned:</span>
                              <span>+{Number(completedOrder.points_earned) || cartFinancials.pointsEarned} pts</span>
                            </div>
                          )}
                          {completedOrder.customer_np_points !== undefined && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', margin: '2px 0', fontWeight: 900 }}>
                              <span>Total NPPoints:</span>
                              <span>{completedOrder.customer_np_points} pts</span>
                            </div>
                          )}

                          <div style={{ borderTop: '2.5px solid #000000', margin: '6px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: thermalSettings.paperWidth === '58mm' ? '12px' : '13.5px', fontWeight: 900 }}>
                            <span>NET PAYABLE:</span>
                            <span>Rs. {previewNetPayable}</span>
                          </div>
                          <div style={{ borderTop: '2.5px solid #000000', margin: '6px 0' }} />

                          {previewSavings > 0 && (
                            <div style={{ textAlign: 'center', fontWeight: 900, fontSize: thermalSettings.paperWidth === '58mm' ? '11px' : '12px', padding: '4px 2px', border: '1.5px dashed #000000', margin: '6px 0', letterSpacing: '0.3px' }}>
                              *** YOU SAVED: ₹{previewSavings} ***
                            </div>
                          )}
                        </>
                      );
                    })()}

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
                        setTimeout(() => customerPhoneInputRef.current?.focus(), 100);
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Staff Name"
                                value={editStaffName}
                                onChange={(e) => setEditStaffName(e.target.value)}
                                style={{ padding: '6px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                              />
                              <input
                                type="text"
                                placeholder="Staff Code"
                                maxLength={50}
                                value={editStaffCode}
                                onChange={(e) => setEditStaffCode(e.target.value)}
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
                                  const staffId = String(staff.id);
                                  setSelectedSalespersonId(staffId);
                                  saveSalespersonId(staffId);
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
              <a
                href="/salespersons"
                target="_blank"
                style={{ fontSize: '11px', fontWeight: 800, color: '#065935', textDecoration: 'none' }}
              >
                📊 Open Full Sales Staff Reports &rarr;
              </a>
            </div>

            {/* Add New Staff Form */}
            <form onSubmit={handleAddStaff} style={{ padding: '16px 22px', borderTop: '1px solid #e2e8f0', background: '#fafaf9' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                Add New Staff Member
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
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
                    STAFF CODE
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (SP-0000)"
                    maxLength={50}
                    value={newStaffCode}
                    onChange={(e) => setNewStaffCode(e.target.value)}
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
