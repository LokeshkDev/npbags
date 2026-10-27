'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import {
  getAdminBanners,
  createAdminBanner,
  deleteAdminBanner,
  getAdminCategories,
  updateCategoryBanner,
  uploadCMSMedia,
  getAdminCMSSections,
  updateAdminCMSSection
} from '../../lib/api';

// Dedicated Banner Image Uploader Component for a Category
function CategoryBannerUploader({ category, onBannerUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(category.banner_image || '');
  const [showUrlField, setShowUrlField] = useState(false);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setUrlInput(category.banner_image || '');
  }, [category.banner_image]);

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'category-banners');

      const res = await uploadCMSMedia(formData);
      const uploadedUrl = res?.url || (res?.data && res.data.url);
      if (!uploadedUrl) throw new Error('Image URL was not returned by server');

      await updateCategoryBanner(category.id, uploadedUrl);
      onBannerUpdated(category.id, uploadedUrl);
      setUrlInput(uploadedUrl);
      setMsg('✓ Banner uploaded successfully!');
      setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      alert(err.message || 'Error uploading banner');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveUrl = async () => {
    setUploading(true);
    setMsg('');
    try {
      await updateCategoryBanner(category.id, urlInput.trim());
      onBannerUpdated(category.id, urlInput.trim());
      setMsg('✓ Banner URL saved!');
      setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      alert(err.message || 'Error saving banner URL');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBanner = async () => {
    if (!confirm(`Remove custom banner for "${category.name}"?`)) return;
    setUploading(true);
    try {
      await updateCategoryBanner(category.id, '');
      onBannerUpdated(category.id, '');
      setUrlInput('');
      setMsg('Banner removed.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Error removing banner');
    } finally {
      setUploading(false);
    }
  };

  const currentBanner = category.banner_image || category.image;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Banner Card Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {category.name}
            </h3>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                background: category.gender === 'women' ? '#fce7f3' : category.gender === 'men' ? '#e0f2fe' : category.gender === 'kids' ? '#fef3c7' : '#f1f5f9',
                color: category.gender === 'women' ? '#9d174d' : category.gender === 'men' ? '#0369a1' : category.gender === 'kids' ? '#b45309' : '#475569'
              }}
            >
              {category.gender || 'All'}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px', display: 'block' }}>
            /shop?category={category.slug}
          </span>
        </div>

        {msg && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#065935', background: '#eaf4ee', padding: '3px 10px', borderRadius: '4px' }}>
            {msg}
          </span>
        )}
      </div>

      {/* Pure Banner Preview: NO OVERLAY, NO TEXT ON IMAGE, 100% CLEAN */}
      <div
        style={{
          width: '100%',
          height: '180px',
          background: '#f8fafc',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {currentBanner ? (
          <img
            src={currentBanner}
            alt={category.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>🖼️</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>No custom banner uploaded</span>
            <span style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>Default shop banner will be used</span>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#ffffff',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10.5px',
            fontWeight: 700,
            pointerEvents: 'none'
          }}
        >
          {category.banner_image ? 'Custom Banner' : 'Default Fallback'}
        </div>
      </div>

      {/* Banner Upload Controls */}
      <div style={{ padding: '16px 20px', background: '#fafafa', marginTop: 'auto', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#065935',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📷 {uploading ? 'Uploading...' : 'Upload Banner'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowUrlField(!showUrlField)}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              {showUrlField ? 'Close URL' : 'Paste URL'}
            </button>
          </div>

          {category.banner_image && (
            <button
              type="button"
              onClick={handleRemoveBanner}
              disabled={uploading}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Remove
            </button>
          )}
        </div>

        {/* URL Input Accordion */}
        {showUrlField && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={urlInput}
              placeholder="https://.../banner.jpg"
              onChange={(e) => setUrlInput(e.target.value)}
              style={{
                flexGrow: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                fontFamily: 'monospace'
              }}
            />
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={uploading}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
          Recommended: 1600 × 400 px (Wide panoramic banner — JPG/WebP)
        </div>
      </div>
    </div>
  );
}

// Department / Main Shop Banner Uploader Component
function PageBannerItem({ pageKey, title, route, currentUrl, onSave }) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(currentUrl || '');
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setUrl(currentUrl || '');
  }, [currentUrl]);

  const handleUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploading(true);
    setMsg('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'page-banners');

      const res = await uploadCMSMedia(formData);
      const uploadedUrl = res?.url || (res?.data && res.data.url);
      if (!uploadedUrl) throw new Error('Failed to retrieve image URL');

      await onSave(pageKey, uploadedUrl);
      setUrl(uploadedUrl);
      setMsg('✓ Banner saved!');
      setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      alert(err.message || 'Error uploading banner');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1.5px solid #e2e8f0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {title}
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
            {route}
          </span>
        </div>
        {msg && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#065935', background: '#eaf4ee', padding: '3px 10px', borderRadius: '4px' }}>
            {msg}
          </span>
        )}
      </div>

      {/* Pure Banner Preview: NO OVERLAY, NO TEXT */}
      <div style={{ width: '100%', height: '180px', background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
        {url ? (
          <img src={url} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>🖼️</span>
            <span>No banner image uploaded</span>
          </div>
        )}
      </div>

      <div style={{ padding: '16px 20px', background: '#fafafa', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#065935',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          📷 {uploading ? 'Uploading...' : 'Upload Page Banner'}
        </button>
        <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
          Recommended: 1800 × 450 px
        </span>
      </div>
    </div>
  );
}

export default function AdminBannersPage() {
  const [activeTab, setActiveTab] = useState('category_banners'); // 'category_banners' | 'page_banners' | 'hero_slides'
  const [categories, setCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categorySearch, setCategorySearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');

  // Page banners state from cms_sections
  const [pageBanners, setPageBanners] = useState({
    shop: '',
    womens: '',
    mens: '',
    kids: ''
  });

  // Hero Slides state
  const [heroBanners, setHeroBanners] = useState([]);
  const [isHeroModalOpen, setIsHeroModalOpen] = useState(false);
  const [heroFormData, setHeroFormData] = useState({
    title: '',
    subtitle: '',
    link_url: '/shop',
    sort_order: 0,
    image: null
  });
  const [savingHero, setSavingHero] = useState(false);

  // 1. Load Categories
  const loadCategories = () => {
    setLoadingCats(true);
    getAdminCategories()
      .then(res => {
        const list = res?.data || (Array.isArray(res) ? res : []);
        setCategories(list);
      })
      .catch(err => console.error('Failed to load categories:', err))
      .finally(() => setLoadingCats(false));
  };

  // 2. Load Page Banners from CMS
  const loadPageBanners = () => {
    getAdminCMSSections()
      .then(sections => {
        if (Array.isArray(sections)) {
          const found = sections.find(s => s.section_key === 'page_banners');
          if (found && found.content) {
            setPageBanners(found.content);
          }
        }
      })
      .catch(() => {});
  };

  // 3. Load Hero Slides
  const loadHeroBanners = () => {
    getAdminBanners()
      .then(data => {
        if (Array.isArray(data)) setHeroBanners(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadCategories();
    loadPageBanners();
    loadHeroBanners();
  }, []);

  const handleCategoryBannerUpdated = (catId, newBannerUrl) => {
    setCategories(prev =>
      prev.map(c => (c.id === catId ? { ...c, banner_image: newBannerUrl } : c))
    );
  };

  const handleSavePageBanner = async (key, url) => {
    const updated = { ...pageBanners, [key]: url };
    setPageBanners(updated);
    await updateAdminCMSSection('page_banners', {
      title: 'Page & Department Banners',
      content: updated
    });
  };

  const handleHeroSubmit = async (e) => {
    e.preventDefault();
    setSavingHero(true);
    try {
      const data = new FormData();
      data.append('title', heroFormData.title);
      data.append('subtitle', heroFormData.subtitle);
      data.append('link_url', heroFormData.link_url);
      data.append('sort_order', heroFormData.sort_order);
      if (heroFormData.image) {
        data.append('image', heroFormData.image);
      }

      await createAdminBanner(data);
      setIsHeroModalOpen(false);
      setHeroFormData({ title: '', subtitle: '', link_url: '/shop', sort_order: 0, image: null });
      loadHeroBanners();
    } catch (err) {
      alert(err.message || 'Error creating hero slide');
    } finally {
      setSavingHero(false);
    }
  };

  const handleHeroDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      await deleteAdminBanner(id);
      loadHeroBanners();
    } catch (err) {
      alert(err.message || 'Error deleting banner');
    }
  };

  // Filter Categories
  const filteredCategories = categories.filter(c => {
    const matchSearch =
      !categorySearch.trim() ||
      c.name.toLowerCase().includes(categorySearch.toLowerCase().trim()) ||
      (c.slug && c.slug.toLowerCase().includes(categorySearch.toLowerCase().trim()));
    const matchGender =
      genderFilter === 'all' ||
      (c.gender && c.gender.toLowerCase() === genderFilter.toLowerCase());
    return matchSearch && matchGender;
  });

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Store & Category Page Banners" />

        <div className="admin-content">
          {/* Header Title & Intro */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>
              Page &amp; Category Banners Manager
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
              Upload and manage pure, high-resolution banner images for each category shop page and department. Rendered on the storefront with <strong>no text overlays</strong> and <strong>no dark opacity or color overlays</strong>.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1.5px solid var(--line)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '2px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('category_banners')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: activeTab === 'category_banners' ? '#ffffff' : 'none',
                borderBottom: activeTab === 'category_banners' ? '3px solid #065935' : '3px solid transparent',
                color: activeTab === 'category_banners' ? '#065935' : 'var(--muted)',
                fontWeight: activeTab === 'category_banners' ? 800 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0'
              }}
            >
              <span>📁 Category Shop Page Banners</span>
              <span style={{ fontSize: '11px', background: activeTab === 'category_banners' ? '#eaf4ee' : '#f1f5f9', padding: '1px 8px', borderRadius: '10px' }}>
                {categories.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('page_banners')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: activeTab === 'page_banners' ? '#ffffff' : 'none',
                borderBottom: activeTab === 'page_banners' ? '3px solid #065935' : '3px solid transparent',
                color: activeTab === 'page_banners' ? '#065935' : 'var(--muted)',
                fontWeight: activeTab === 'page_banners' ? 800 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0'
              }}
            >
              <span>🏬 Department &amp; Shop Banners</span>
              <span style={{ fontSize: '11px', background: activeTab === 'page_banners' ? '#eaf4ee' : '#f1f5f9', padding: '1px 8px', borderRadius: '10px' }}>
                4
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hero_slides')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: activeTab === 'hero_slides' ? '#ffffff' : 'none',
                borderBottom: activeTab === 'hero_slides' ? '3px solid #065935' : '3px solid transparent',
                color: activeTab === 'hero_slides' ? '#065935' : 'var(--muted)',
                fontWeight: activeTab === 'hero_slides' ? 800 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                borderRadius: '6px 6px 0 0'
              }}
            >
              <span>✨ Homepage Hero Slides</span>
              <span style={{ fontSize: '11px', background: activeTab === 'hero_slides' ? '#eaf4ee' : '#f1f5f9', padding: '1px 8px', borderRadius: '10px' }}>
                {heroBanners.length}
              </span>
            </button>
          </div>

          {/* ==============================================================
              TAB 1: CATEGORY SHOP PAGE BANNERS
              ============================================================== */}
          {activeTab === 'category_banners' && (
            <div>
              {/* Filter & Search Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' }}>
                {/* Gender Tabs */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['all', 'women', 'men', 'kids'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenderFilter(g)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '12.5px',
                        fontWeight: genderFilter === g ? 700 : 500,
                        background: genderFilter === g ? '#065935' : '#f1f5f9',
                        color: genderFilter === g ? '#ffffff' : '#334155',
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {g === 'all' ? 'All Categories' : g}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ maxWidth: '300px', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Search category banner..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff'
                    }}
                  />
                </div>
              </div>

              {/* Category Banners Grid */}
              {loadingCats ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading category banners...
                </div>
              ) : filteredCategories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>No categories found</h3>
                  <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Try adjusting your search query or department filter.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                  {filteredCategories.map(cat => (
                    <CategoryBannerUploader
                      key={cat.id}
                      category={cat}
                      onBannerUpdated={handleCategoryBannerUpdated}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==============================================================
              TAB 2: DEPARTMENT & MAIN SHOP BANNERS
              ============================================================== */}
          {activeTab === 'page_banners' && (
            <div>
              <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '20px' }}>
                Manage full-width panoramic banners for top-level storefront department hubs. Displayed without any dark gradient overlays or text sitting on top of the image.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '24px' }}>
                <PageBannerItem
                  pageKey="shop"
                  title="Main Shop Page Banner"
                  route="/shop"
                  currentUrl={pageBanners.shop}
                  onSave={handleSavePageBanner}
                />
                <PageBannerItem
                  pageKey="womens"
                  title="Women's Department Banner"
                  route="/womens"
                  currentUrl={pageBanners.womens}
                  onSave={handleSavePageBanner}
                />
                <PageBannerItem
                  pageKey="mens"
                  title="Men's Department Banner"
                  route="/mens"
                  currentUrl={pageBanners.mens}
                  onSave={handleSavePageBanner}
                />
                <PageBannerItem
                  pageKey="kids"
                  title="Kids' Department Banner"
                  route="/kids"
                  currentUrl={pageBanners.kids}
                  onSave={handleSavePageBanner}
                />
              </div>
            </div>
          )}

          {/* ==============================================================
              TAB 3: HOMEPAGE HERO PROMO SLIDES
              ============================================================== */}
          {activeTab === 'hero_slides' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                    Promotional Hero Carousel Slides
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0' }}>
                    Slides appearing on the homepage hero carousel with call-to-action buttons.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setIsHeroModalOpen(true)}
                  style={{ background: '#065935', borderColor: '#065935' }}
                >
                  <Icon name="plus" size={15} />
                  <span>Add Hero Slide</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {heroBanners.length === 0 ? (
                  <div className="stat-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                    No promotional slides found. Add your first hero slide!
                  </div>
                ) : (
                  heroBanners.map(b => (
                    <div key={b.id} className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ height: '180px', background: '#f3f4f6', position: 'relative' }}>
                        {b.image_url || b.image ? (
                          <img src={b.image_url || b.image} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                            <Icon name="banner" size={40} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{b.title || 'Untitled Banner'}</h3>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ color: 'var(--brand-red)', borderColor: 'var(--brand-red)', padding: '4px 8px' }}
                            onClick={() => handleHeroDelete(b.id)}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                        {b.subtitle && <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{b.subtitle}</p>}
                        <div style={{ fontSize: '12px', color: 'var(--brand-red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Icon name="externalLink" size={12} />
                          <span>{b.link_url || '/shop'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Hero Modal */}
              <Modal
                isOpen={isHeroModalOpen}
                onClose={() => setIsHeroModalOpen(false)}
                title="Add Promotional Hero Slide"
              >
                <form onSubmit={handleHeroSubmit}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Banner Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Handcrafted Luxury Bags"
                      value={heroFormData.title}
                      onChange={(e) => setHeroFormData({ ...heroFormData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Subtitle / Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Curated for timeless elegance"
                      value={heroFormData.subtitle}
                      onChange={(e) => setHeroFormData({ ...heroFormData, subtitle: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label">Target Link URL</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="/shop"
                      value={heroFormData.link_url}
                      onChange={(e) => setHeroFormData({ ...heroFormData, link_url: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label">Banner Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setHeroFormData({ ...heroFormData, image: e.target.files[0] })}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="admin-btn admin-btn-outline" onClick={() => setIsHeroModalOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="admin-btn admin-btn-primary" disabled={savingHero}>
                      {savingHero ? 'Saving...' : 'Create Hero Slide'}
                    </button>
                  </div>
                </form>
              </Modal>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
