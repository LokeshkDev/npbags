'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { ImageUploader } from '../../components/ImageUploader';
import { Icon } from '../../components/Icons';
import {
  getAdminProducts,
  getAdminProductById,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  duplicateAdminProduct,
  deleteProductImage,
  replaceProductImage,
  setPrimaryProductImage,
  uploadProductGalleryImage,
  uploadCMSMedia,
  getAdminCategories
} from '../../lib/api';

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [productImages, setProductImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [isUploadingVariantIndex, setIsUploadingVariantIndex] = useState(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [saving, setSaving] = useState(false);

  const galleryFileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const [replacingImageId, setReplacingImageId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_id: '',
    gender: 'all',
    price: '',
    sale_price: '',
    badge: '',
    tagline: '',
    description: '',
    materials: '',
    care_instructions: '',
    dimension_w: '',
    dimension_h: '',
    dimension_l: '',
    dimensions: '',
    shipping_info: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    is_featured: true,
    is_new_arrival: false,
    is_best_selling: false
  });

  const generateSlug = (val) => {
    return (val || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const autoGenerateSeo = (currentForm = formData) => {
    const name = (currentForm.name || '').trim();
    const desc = (currentForm.description || currentForm.tagline || '').trim();
    const cat = categories.find(c => String(c.id) === String(currentForm.category_id));
    const catName = cat ? cat.name : '';

    const seoTitle = name ? `${name} | NP Grand Shopping` : '';

    let seoDesc = '';
    if (desc) {
      const plain = desc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      seoDesc = plain.length > 155 ? `${plain.substring(0, 152)}...` : plain;
    } else if (name) {
      seoDesc = `Buy ${name} online at NP Grand Shopping. Premium quality with fast delivery across India.`;
    }

    const kw = new Set();
    if (name) {
      name.toLowerCase().split(/\s+/).forEach(w => {
        const clean = w.replace(/[^a-z0-9]/g, '');
        if (clean.length > 2 && !['the', 'and', 'for', 'with', 'all'].includes(clean)) kw.add(clean);
      });
    }
    if (catName) kw.add(catName.toLowerCase());
    if (currentForm.badge) kw.add(currentForm.badge.toLowerCase());
    if (currentForm.materials) {
      currentForm.materials.toLowerCase().split(/[,&]/).forEach(m => {
        const clean = m.trim().replace(/[^a-z0-9 ]/g, '');
        if (clean.length > 2) kw.add(clean);
      });
    }
    kw.add('np grand');
    kw.add('online shopping');

    return {
      seo_title: seoTitle,
      seo_description: seoDesc,
      seo_keywords: Array.from(kw).slice(0, 12).join(', ')
    };
  };

  const loadData = () => {
    getAdminProducts({ limit: 100 })
      .then(data => {
        if (data && data.products) setProducts(data.products);
      })
      .catch(() => {});

    getAdminCategories()
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setProductImages([]);
    setVariants([
      { color_name: 'Standard', color_hex: '#111827', size_name: '', stock_quantity: 50, image_url: '', sku: '' }
    ]);
    const firstCat = categories[0];
    setFormData({
      name: '',
      slug: '',
      category_id: firstCat?.id || '',
      gender: firstCat?.gender || 'all',
      price: '',
      sale_price: '',
      badge: '',
      tagline: '',
      description: '',
      materials: '',
      care_instructions: '',
      dimension_w: '',
      dimension_h: '',
      dimension_l: '',
      dimensions: '',
      shipping_info: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      is_featured: true,
      is_new_arrival: false,
      is_best_selling: false
    });
    setSelectedFile(null);
    setModalOpen(true);
  };

  const handleDimensionChange = (field, val) => {
    const nextFormData = { ...formData, [field]: val };
    const w = parseFloat(field === 'dimension_w' ? val : formData.dimension_w);
    const h = parseFloat(field === 'dimension_h' ? val : formData.dimension_h);
    const l = parseFloat(field === 'dimension_l' ? val : formData.dimension_l);

    if (!isNaN(w) && !isNaN(h) && !isNaN(l) && w > 0 && h > 0 && l > 0) {
      const wInch = (w / 2.54).toFixed(1);
      const hInch = (h / 2.54).toFixed(1);
      const lInch = (l / 2.54).toFixed(1);
      nextFormData.dimensions = `${hInch}" H x ${wInch}" W x ${lInch}" D`;
    } else {
      const parts = [];
      if (!isNaN(h) && h > 0) parts.push(`${(h / 2.54).toFixed(1)}" H`);
      if (!isNaN(w) && w > 0) parts.push(`${(w / 2.54).toFixed(1)}" W`);
      if (!isNaN(l) && l > 0) parts.push(`${(l / 2.54).toFixed(1)}" D`);
      if (parts.length > 0) {
        nextFormData.dimensions = parts.join(' x ');
      }
    }
    setFormData(nextFormData);
  };

  const openEditModal = async (p) => {
    setEditingProduct(p);
    const defaultSeoTitle = p.seo_title || (p.name ? `${p.name} | NP Grand Shopping` : '');
    const defaultSeoDesc = p.seo_description || (p.description ? p.description.slice(0, 155) : (p.name ? `Buy ${p.name} online at NP Grand Shopping.` : ''));
    const defaultSeoKw = p.seo_keywords || (p.name ? p.name.toLowerCase().split(/\s+/).filter(w => w.length > 2).join(', ') : '');

    setFormData({
      name: p.name || '',
      slug: p.slug || p.id || '',
      category_id: p.category_id || '',
      gender: p.gender || 'all',
      price: p.price || '',
      sale_price: p.sale_price || '',
      badge: p.badge || '',
      tagline: p.tagline || '',
      description: p.description || '',
      materials: p.materials || '',
      care_instructions: p.care_instructions || '',
      dimension_w: p.dimension_w !== null && p.dimension_w !== undefined ? p.dimension_w : '',
      dimension_h: p.dimension_h !== null && p.dimension_h !== undefined ? p.dimension_h : '',
      dimension_l: p.dimension_l !== null && p.dimension_l !== undefined ? p.dimension_l : '',
      dimensions: p.dimensions || '',
      shipping_info: p.shipping_info || '',
      seo_title: defaultSeoTitle,
      seo_description: defaultSeoDesc,
      seo_keywords: defaultSeoKw,
      is_featured: Boolean(p.is_featured),
      is_new_arrival: Boolean(p.is_new_arrival),
      is_best_selling: Boolean(p.is_best_selling)
    });

    // Populate variants
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      setVariants(p.variants.map(v => ({
        id: v.id,
        color_name: v.color_name || 'Standard',
        color_hex: v.color_hex || '#111827',
        size_name: (v.size_name && v.size_name.toLowerCase() !== 'standard' && v.size_name.toLowerCase() !== 'one size') ? v.size_name : '',
        stock_quantity: v.stock_quantity !== undefined ? v.stock_quantity : 50,
        sku: v.sku || '',
        image_url: v.image_url || ''
      })));
    } else if (Array.isArray(p.colors) && p.colors.length > 0) {
      setVariants(p.colors.map(c => ({
        color_name: c.name || 'Standard',
        color_hex: c.hex || '#111827',
        size_name: '',
        stock_quantity: c.stock_quantity !== undefined ? c.stock_quantity : 50,
        sku: '',
        image_url: c.img || ''
      })));
    } else {
      setVariants([
        { color_name: 'Standard', color_hex: '#111827', size_name: '', stock_quantity: 50, image_url: '', sku: '' }
      ]);
    }

    // Populate images
    if (Array.isArray(p.images_detailed) && p.images_detailed.length > 0) {
      setProductImages(p.images_detailed);
    } else if (Array.isArray(p.gallery) && p.gallery.length > 0) {
      setProductImages(p.gallery.map((url, idx) => ({
        id: idx + 1,
        image_url: url,
        is_primary: idx === 0 ? 1 : 0
      })));
    } else if (Array.isArray(p.images) && p.images.length > 0) {
      setProductImages(p.images.map((url, idx) => ({
        id: idx + 1,
        image_url: url,
        is_primary: idx === 0 ? 1 : 0
      })));
    } else {
      setProductImages([]);
    }

    setSelectedFile(null);
    setModalOpen(true);

    // Fetch fresh product details to ensure verified database image IDs and primary statuses
    try {
      const detailed = await getAdminProductById(p.id);
      if (detailed) {
        if (Array.isArray(detailed.images_detailed) && detailed.images_detailed.length > 0) {
          setProductImages(detailed.images_detailed);
        }
        if (Array.isArray(detailed.variants) && detailed.variants.length > 0) {
          setVariants(detailed.variants.map(v => ({
            id: v.id,
            color_name: v.color_name || 'Standard',
            color_hex: v.color_hex || '#111827',
            size_name: (v.size_name && v.size_name.toLowerCase() !== 'standard' && v.size_name.toLowerCase() !== 'one size') ? v.size_name : '',
            stock_quantity: v.stock_quantity !== undefined ? v.stock_quantity : 50,
            sku: v.sku || '',
            image_url: v.image_url || ''
          })));
        }
        setFormData(prev => ({
          ...prev,
          materials: detailed.materials !== undefined ? (detailed.materials || '') : prev.materials,
          care_instructions: detailed.care_instructions !== undefined ? (detailed.care_instructions || '') : prev.care_instructions,
          shipping_info: detailed.shipping_info !== undefined ? (detailed.shipping_info || '') : prev.shipping_info,
          seo_title: detailed.seo_title || prev.seo_title,
          seo_description: detailed.seo_description || prev.seo_description,
          seo_keywords: detailed.seo_keywords || prev.seo_keywords
        }));
      }
    } catch (err) {
      console.warn('Could not refresh product details:', err);
    }
  };

  // Variant helpers
  const handleAddVariant = () => {
    setVariants([
      ...variants,
      { color_name: '', color_hex: '#1e293b', size_name: '', stock_quantity: 50, image_url: '', sku: '' }
    ]);
  };

  const handleRemoveVariant = (index) => {
    if (variants.length <= 1) {
      alert('A product must have at least one color/stock variant.');
      return;
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;
    setVariants(updated);
  };

  const handleUploadVariantImage = async (index, file) => {
    if (!file) return;
    setIsUploadingVariantIndex(index);
    try {
      const data = new FormData();
      data.append('image', file);
      const res = await uploadCMSMedia(data);
      if (res && res.url) {
        handleVariantChange(index, 'image_url', res.url);
      }
    } catch (err) {
      alert(err.message || 'Error uploading variant image');
    } finally {
      setIsUploadingVariantIndex(null);
    }
  };

  // Gallery image actions
  const handleDeleteImage = async (imageId) => {
    const targetImg = productImages.find(img => img.id === imageId);
    const targetUrl = targetImg?.image_url;

    if (!editingProduct) {
      setProductImages(productImages.filter(img => img.id !== imageId));
      if (targetUrl) {
        setVariants(prev => prev.map(v => v.image_url === targetUrl ? { ...v, image_url: '' } : v));
      }
      return;
    }

    if (confirm('Delete this image from product gallery?')) {
      try {
        await deleteProductImage(editingProduct.id, imageId);
        const remainingImgs = productImages.filter(img => img.id !== imageId);
        setProductImages(remainingImgs);

        // Also clear this URL from any variants so saving won't re-upload or re-link it
        if (targetUrl) {
          setVariants(prev => prev.map(v => v.image_url === targetUrl ? { ...v, image_url: '' } : v));
        }

        // Update editingProduct in local state
        setEditingProduct(prev => {
          if (!prev) return null;
          const newGallery = (prev.gallery || []).filter(u => u !== targetUrl);
          const newImages = (prev.images || []).filter(u => u !== targetUrl);
          const newPrimary = prev.primary_image === targetUrl ? (remainingImgs[0]?.image_url || newGallery[0] || null) : prev.primary_image;
          return {
            ...prev,
            gallery: newGallery,
            images: newImages,
            primary_image: newPrimary
          };
        });

        loadData();
      } catch (err) {
        alert(err.message || 'Error deleting image');
      }
    }
  };

  const handleTriggerReplaceImage = (imageId) => {
    setReplacingImageId(imageId);
    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
      replaceFileInputRef.current.click();
    }
  };

  const handleReplaceImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !replacingImageId || !editingProduct) return;
    try {
      const data = new FormData();
      data.append('image', file);
      const res = await replaceProductImage(editingProduct.id, replacingImageId, data);
      if (res && res.image_url) {
        setProductImages(productImages.map(img =>
          img.id === replacingImageId ? { ...img, image_url: res.image_url } : img
        ));
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Error replacing image');
    } finally {
      setReplacingImageId(null);
    }
  };

  const handleSetPrimaryImage = async (imageId) => {
    if (!editingProduct) {
      setProductImages(productImages.map(img => ({
        ...img,
        is_primary: img.id === imageId ? 1 : 0
      })).sort((a, b) => (b.id === imageId ? 1 : 0) - (a.id === imageId ? 1 : 0)));
      return;
    }
    try {
      await setPrimaryProductImage(editingProduct.id, imageId);
      const updatedImages = productImages.map(img => ({
        ...img,
        is_primary: img.id === imageId ? 1 : 0
      })).sort((a, b) => (b.id === imageId ? 1 : 0) - (a.id === imageId ? 1 : 0));

      setProductImages(updatedImages);

      const primaryImgObj = updatedImages.find(img => img.id === imageId);
      const primaryUrl = primaryImgObj ? primaryImgObj.image_url : null;

      if (primaryUrl) {
        setEditingProduct(prev => prev ? { ...prev, primary_image: primaryUrl, images_detailed: updatedImages } : prev);
        setProducts(prevProducts => prevProducts.map(item => {
          if (item.id === editingProduct.id) {
            return {
              ...item,
              primary_image: primaryUrl,
              images_detailed: updatedImages,
              images: updatedImages.map(i => i.image_url)
            };
          }
          return item;
        }));
      }

      loadData();
    } catch (err) {
      alert(err.message || 'Error setting primary image');
    }
  };

  const handleUploadGalleryImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !editingProduct) return;
    setIsUploadingGallery(true);
    try {
      const data = new FormData();
      data.append('image', file);
      const res = await uploadProductGalleryImage(editingProduct.id, data);
      if (res) {
        setProductImages([...productImages, { id: res.id, image_url: res.image_url, is_primary: productImages.length === 0 ? 1 : 0 }]);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Error uploading gallery image');
    } finally {
      setIsUploadingGallery(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = '';
    }
  };

  // Product Duplication
  const handleDuplicate = async (id, name) => {
    if (confirm(`Duplicate product "${name}"? A cloned copy with images and variants will be created.`)) {
      try {
        await duplicateAdminProduct(id);
        loadData();
      } catch (err) {
        alert(err.message || 'Error duplicating product');
      }
    }
  };

  // Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== undefined) {
        data.append(key, formData[key]);
      }
    });

    data.set('is_new_arrival', formData.is_new_arrival ? '1' : '0');
    data.set('is_best_selling', formData.is_best_selling ? '1' : '0');
    data.set('is_featured', formData.is_featured ? '1' : '0');

    data.append('variants', JSON.stringify(variants));

    if (selectedFile) {
      data.append('images', selectedFile);
    }

    try {
      if (editingProduct) {
        await updateAdminProduct(editingProduct.id, data);
      } else {
        await createAdminProduct(data);
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteAdminProduct(id);
        loadData();
      } catch (err) {
        alert(err.message || 'Error deleting product');
      }
    }
  };

  const filtered = products.filter(p =>
    (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
    (p.slug && p.slug.toLowerCase().includes(search.toLowerCase())) ||
    (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase())) ||
    (p.cat && p.cat.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Product Catalog Management" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search products by title, slug or category..."
                className="form-control"
                style={{ width: '340px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={openAddModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="plus" size={16} />
              <span>Add New Product</span>
            </button>
          </div>

          <div className="admin-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Sale</th>
                    <th>Variants</th>
                    <th>Badge</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        No products found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(p => {
                      const img = p.primary_image || (p.gallery && p.gallery[0]) || (p.images && p.images[0]) || '';
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <img
                                src={img}
                                alt=""
                                style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', background: '#f3f4f6' }}
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = '/assets/bestsellers/best-handbag.png';
                                }}
                              />
                              <div>
                                <strong>{p.name}</strong>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span>slug: <code>{p.slug || p.id}</code></span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>{p.category_name || p.cat || '—'}</td>
                          <td><strong>₹{p.price}</strong></td>
                          <td>{p.sale_price > 0 ? `₹${p.sale_price}` : '—'}</td>
                          <td>
                            {p.colors && p.colors.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {p.colors.slice(0, 4).map((c, idx) => (
                                  <span
                                    key={idx}
                                    title={`${c.name} (${c.stock_quantity || 0} in stock)`}
                                    style={{
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '50%',
                                      backgroundColor: c.hex,
                                      border: '1px solid #ccc',
                                      display: 'inline-block'
                                    }}
                                  />
                                ))}
                                {p.colors.length > 4 && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>+{p.colors.length - 4}</span>}
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Standard</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              {p.is_new_arrival ? (
                                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                                  New Arrival
                                </span>
                              ) : null}
                              {p.is_best_selling ? (
                                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: '11px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                                  Best Selling
                                </span>
                              ) : null}
                              {p.badge && !p.is_new_arrival && !p.is_best_selling && (
                                <span className="badge badge-info">{p.badge}</span>
                              )}
                              {!p.badge && !p.is_new_arrival && !p.is_best_selling && '—'}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-success">Active</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                onClick={() => openEditModal(p)}
                                title="Edit Product"
                              >
                                <Icon name="edit" size={14} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                onClick={() => handleDuplicate(p.id, p.name)}
                                title="Duplicate Product"
                              >
                                <Icon name="copy" size={14} />
                                <span>Duplicate</span>
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-danger"
                                style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                onClick={() => handleDelete(p.id, p.name)}
                                title="Delete Product"
                              >
                                <Icon name="trash" size={14} />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for replacing an image */}
      <input
        type="file"
        ref={replaceFileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleReplaceImageFileChange}
      />

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
        maxWidth="860px"
      >
        <form onSubmit={handleSubmit} style={{ maxHeight: '78vh', overflowY: 'auto', paddingRight: '8px' }}>
          {/* Basic Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                required
                className="form-control"
                value={formData.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoSlug = generateSlug(val);
                  const newFormData = { ...formData, name: val, slug: autoSlug };

                  // Auto-update SEO title if blank or currently synced with previous title
                  const prevAutoTitle = formData.name ? `${formData.name} | NP Grand Shopping` : '';
                  if (!formData.seo_title || formData.seo_title === prevAutoTitle) {
                    newFormData.seo_title = val ? `${val} | NP Grand Shopping` : '';
                  }

                  // Auto-populate keywords if empty
                  if (!formData.seo_keywords && val) {
                    const seo = autoGenerateSeo(newFormData);
                    newFormData.seo_keywords = seo.seo_keywords;
                    if (!formData.seo_description) {
                      newFormData.seo_description = seo.seo_description;
                    }
                  }

                  setFormData(newFormData);
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={formData.category_id}
                onChange={(e) => {
                  const catId = e.target.value;
                  const catObj = categories.find(c => String(c.id) === String(catId));
                  setFormData(prev => ({
                    ...prev,
                    category_id: catId,
                    gender: catObj?.gender && catObj.gender !== 'all' ? catObj.gender : prev.gender
                  }));
                }}
              >
                <option value="">-- Select Category --</option>
                {categories.filter(c => !c.parent_id).map(mainCat => {
                  const subCats = categories.filter(sub => sub.parent_id === mainCat.id);
                  return (
                    <React.Fragment key={mainCat.id}>
                      <option value={mainCat.id} style={{ fontWeight: 600 }}>{mainCat.name} ({mainCat.gender || 'all'})</option>
                      {subCats.map(sub => (
                        <option key={sub.id} value={sub.id}>&nbsp;&nbsp;↳ {sub.name} ({sub.gender || 'all'})</option>
                      ))}
                    </React.Fragment>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department / Gender</label>
              <select
                className="form-control"
                value={formData.gender || 'all'}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="women">👩 Women</option>
                <option value="men">👤 Men</option>
                <option value="kids">🧒 Kids</option>
                <option value="all">🌐 All / Unisex</option>
              </select>
            </div>
          </div>

          {/* Slug (URL Handle) with Auto-generation */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label className="form-label" style={{ margin: 0 }}>Product Slug (URL Handle) *</label>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                style={{ padding: '2px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setFormData({ ...formData, slug: generateSlug(formData.name) })}
                title="Regenerate slug from current product title"
              >
                ⚡ Auto Slug from Title
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. the-everyday-tote"
              className="form-control"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
            />
            <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
              Storefront URL: <code>/product/{formData.slug || 'your-slug'}</code>
            </span>
          </div>

          {/* Pricing & Badge */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Regular Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                className="form-control"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Sale Price (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Badge</label>
              <input
                type="text"
                placeholder="Bestseller, New, Trending"
                className="form-control"
                value={formData.badge}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              />
            </div>
          </div>

          {/* Tagline & Description */}
          <div className="form-group">
            <label className="form-label">Tagline</label>
            <input
              type="text"
              placeholder="Short catchy summary..."
              className="form-control"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Full Description</label>
            <textarea
              rows={3}
              className="form-control"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Dimensions Section with separate W:, H:, L: */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                Product Dimensions (Separate W, H, L in cm)
              </label>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Auto-converts to inches below</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>W: Width (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 30"
                  className="form-control"
                  value={formData.dimension_w}
                  onChange={(e) => handleDimensionChange('dimension_w', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>H: Height (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 44"
                  className="form-control"
                  value={formData.dimension_h}
                  onChange={(e) => handleDimensionChange('dimension_h', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '12px' }}>L: Length / Depth (cm)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 14"
                  className="form-control"
                  value={formData.dimension_l}
                  onChange={(e) => handleDimensionChange('dimension_l', e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
                  Product Dimensions (Inches) / Summary Text
                </label>
                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 500 }}>
                  Auto-calculated from cm (Editable)
                </span>
              </div>
              <input
                type="text"
                placeholder='e.g. 15.7" H x 12.6" W x 17.7" D'
                className="form-control"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
              />
            </div>
          </div>

          {/* Showcase Visibility Checkboxes: New Arrival & Best Selling */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                Homepage Showcase Badges & Sections
              </label>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                Check to display this product in dedicated homepage showcase sections.
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#fff', padding: '10px 14px', borderRadius: '6px', border: formData.is_new_arrival ? '1.5px solid #10b981' : '1px solid #e5e7eb', transition: 'border-color 0.2s' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                  checked={Boolean(formData.is_new_arrival)}
                  onChange={(e) => setFormData({ ...formData, is_new_arrival: e.target.checked })}
                />
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>New Arrival</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Show in New Arrivals section</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#fff', padding: '10px 14px', borderRadius: '6px', border: formData.is_best_selling ? '1.5px solid #f59e0b' : '1px solid #e5e7eb', transition: 'border-color 0.2s' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
                  checked={Boolean(formData.is_best_selling)}
                  onChange={(e) => setFormData({ ...formData, is_best_selling: e.target.checked })}
                />
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>Best Selling</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Show in Best Selling section</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: '#fff', padding: '10px 14px', borderRadius: '6px', border: formData.is_featured ? '1.5px solid #3b82f6' : '1px solid #e5e7eb', transition: 'border-color 0.2s' }}>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', accentColor: '#3b82f6', cursor: 'pointer' }}
                  checked={Boolean(formData.is_featured)}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                />
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>Featured Collection</strong>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Curated catalog showcase</span>
                </div>
              </label>
            </div>
          </div>

          {/* Materials & Care Instructions (Shown in PDP Materials & Care Tab) */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Materials & Care Instructions</strong>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '2px 0 0' }}>
                These details display directly under the &quot;Materials &amp; Care&quot; tab on the product detail page.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Materials &amp; Fabric</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Crafted with 100% GOTS-certified heavyweight organic cotton canvas and vegetable-tanned full grain leather trims."
                  className="form-control"
                  value={formData.materials}
                  onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Care Instructions</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Spot clean with warm water and mild organic detergent. Air dry in shade. Avoid machine washing."
                  className="form-control"
                  value={formData.care_instructions}
                  onChange={(e) => setFormData({ ...formData, care_instructions: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '18px' }}>
            <label className="form-label">Shipping &amp; Delivery Information</label>
            <input
              type="text"
              placeholder="e.g. Free standard insured shipping across India on all orders over ₹499. Dispatches within 24 hours."
              className="form-control"
              value={formData.shipping_info}
              onChange={(e) => setFormData({ ...formData, shipping_info: e.target.value })}
            />
          </div>

          {/* SEO Metadata & Search Preview */}
          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '14px', color: '#166534' }}>Search Engine Optimization (SEO)</strong>
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Google Ready</span>
                </div>
                <p style={{ fontSize: '12px', color: '#15803d', margin: '2px 0 0' }}>
                  Configure Google title, meta description, and search keywords for this product.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                style={{ padding: '6px 12px', fontSize: '12px', background: '#ffffff', borderColor: '#86efac', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  const seo = autoGenerateSeo();
                  setFormData({
                    ...formData,
                    seo_title: seo.seo_title,
                    seo_description: seo.seo_description,
                    seo_keywords: seo.seo_keywords
                  });
                }}
              >
                <span>⚡ Auto-Generate SEO from Details</span>
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#166534' }}>SEO Meta Title</label>
              <input
                type="text"
                placeholder="e.g. The Everyday Tote | NP Grand Shopping"
                className="form-control"
                value={formData.seo_title}
                onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                maxLength={70}
              />
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Recommended: 50-60 characters for best Google display</span>
                <span>{(formData.seo_title || '').length}/70</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: '#166534' }}>SEO Meta Description</label>
              <textarea
                rows={2}
                placeholder="e.g. Crafted with organic cotton canvas. Shop The Everyday Tote online at NP Grand Shopping with fast delivery and easy returns."
                className="form-control"
                value={formData.seo_description}
                onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                maxLength={160}
              />
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Recommended: 150-160 characters</span>
                <span>{(formData.seo_description || '').length}/160</span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ color: '#166534' }}>SEO Meta Keywords (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. tote bag, organic canvas, everyday carry, shopping, accessories"
                className="form-control"
                value={formData.seo_keywords}
                onChange={(e) => setFormData({ ...formData, seo_keywords: e.target.value })}
              />
            </div>

            {/* Google Search Live Preview */}
            {(formData.name || formData.seo_title) && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ffffff', borderRadius: '6px', border: '1px solid #dcfce7' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#65a30d', fontWeight: 700, marginBottom: '4px' }}>Google Search Preview</div>
                <div style={{ fontSize: '15px', color: '#1a0dab', fontWeight: 500, lineHeight: 1.3, textDecoration: 'underline' }}>
                  {formData.seo_title || `${formData.name || 'Product'} | NP Grand Shopping`}
                </div>
                <div style={{ fontSize: '12px', color: '#006621', lineHeight: 1.4 }}>
                  https://npgrandshopping.com/product/{formData.slug || 'product-slug'}
                </div>
                <div style={{ fontSize: '12px', color: '#545454', lineHeight: 1.4, marginTop: '2px' }}>
                  {formData.seo_description || (formData.description ? formData.description.slice(0, 150) : 'Buy authentic products online from NP Grand Shopping.')}
                </div>
              </div>
            )}
          </div>

          {/* Color Options with Image Upload & Qty per Color */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Color Variants, Stock Quantity & Color Images</strong>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                  Specify color name, hex code, live stock inventory (qty), and specific image for each color.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={handleAddVariant}
              >
                <Icon name="plus" size={14} />
                <span>Add Color</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {variants.map((v, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.1fr 85px 105px 95px 1.4fr auto',
                    gap: '8px',
                    alignItems: 'center',
                    background: '#ffffff',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Color Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Warm Oatmeal"
                      style={{ height: '36px', fontSize: '13px' }}
                      value={v.color_name}
                      onChange={(e) => handleVariantChange(idx, 'color_name', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Color</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        style={{ width: '32px', height: '36px', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                        value={v.color_hex || '#000000'}
                        onChange={(e) => handleVariantChange(idx, 'color_hex', e.target.value)}
                      />
                      <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'monospace' }}>{v.color_hex}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Size (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 18L, M"
                      style={{ height: '36px', fontSize: '12px' }}
                      value={v.size_name || ''}
                      onChange={(e) => handleVariantChange(idx, 'size_name', e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Stock (Qty)</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="50"
                      style={{ height: '36px', fontSize: '13px' }}
                      value={v.stock_quantity}
                      onChange={(e) => handleVariantChange(idx, 'stock_quantity', parseInt(e.target.value, 10) || 0)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>Color Image URL / Upload</label>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Image URL or upload"
                        style={{ height: '36px', fontSize: '12px' }}
                        value={v.image_url || ''}
                        onChange={(e) => handleVariantChange(idx, 'image_url', e.target.value)}
                      />
                      <label
                        className="admin-btn admin-btn-outline"
                        style={{ height: '36px', padding: '0 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', margin: 0, whiteSpace: 'nowrap', fontSize: '11px' }}
                        title="Upload Image for this Color"
                      >
                        <Icon name="upload" size={14} />
                        <span>{isUploadingVariantIndex === idx ? '...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleUploadVariantImage(idx, e.target.files[0])}
                        />
                      </label>
                      {v.image_url && (
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                          <img
                            src={v.image_url}
                            alt="Variant"
                            style={{ width: '34px', height: '34px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                            title={v.image_url}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/assets/bestsellers/best-handbag.png';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleVariantChange(idx, 'image_url', '')}
                            style={{
                              position: 'absolute',
                              top: '-6px',
                              right: '-6px',
                              background: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              fontSize: '11px',
                              lineHeight: '15px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              padding: 0,
                              fontWeight: 'bold',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }}
                            title="Remove image from this variant"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ paddingTop: '16px' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-outline"
                      style={{ color: '#ef4444', borderColor: '#ef4444', padding: '6px 8px' }}
                      onClick={() => handleRemoveVariant(idx)}
                      title="Remove variant"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product Gallery Management (Delete & Replace Option) */}
          {editingProduct && productImages.length > 0 && (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Product Gallery Images</strong>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    Delete individual images, replace existing photos, or set primary cover image.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={galleryFileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleUploadGalleryImage}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline"
                    style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => galleryFileInputRef.current?.click()}
                    disabled={isUploadingGallery}
                  >
                    <Icon name="plus" size={14} />
                    <span>{isUploadingGallery ? 'Uploading...' : 'Add Image'}</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                {productImages.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      border: img.is_primary ? '2px solid #10b981' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ height: '110px', background: '#f1f5f9', position: 'relative' }}>
                      <img
                        src={img.image_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/assets/bestsellers/best-handbag.png';
                        }}
                      />
                      {img.is_primary ? (
                        <span
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            background: '#10b981',
                            color: '#fff',
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}
                        >
                          Primary
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(img.id)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            left: '4px',
                            background: 'rgba(0,0,0,0.6)',
                            color: '#fff',
                            fontSize: '9px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Make Primary
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', borderTop: '1px solid #e2e8f0' }}>
                      <button
                        type="button"
                        onClick={() => handleTriggerReplaceImage(img.id)}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          fontSize: '11px',
                          border: 'none',
                          background: '#f8fafc',
                          color: '#2563eb',
                          cursor: 'pointer',
                          borderRight: '1px solid #e2e8f0'
                        }}
                        title="Replace this image"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        style={{
                          padding: '6px 8px',
                          fontSize: '11px',
                          border: 'none',
                          background: '#f8fafc',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                        title="Delete image"
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Image Upload */}
          <ImageUploader
            label={editingProduct ? "Upload Additional Images (Saved to Cloudflare R2)" : "Upload Product Cover Image"}
            currentImage={editingProduct?.primary_image || editingProduct?.gallery?.[0]}
            onFileSelect={(file) => setSelectedFile(file)}
          />

          <div className="modal-footer" style={{ padding: '16px 0 0', marginTop: '20px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
