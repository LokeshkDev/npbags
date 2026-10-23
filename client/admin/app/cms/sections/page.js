'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { Topbar } from '../../../components/Topbar';
import { Icon } from '../../../components/Icons';
import { getAdminCMSSections, updateAdminCMSSection, uploadCMSMedia, reorderAdminCMSSections } from '../../../lib/api';

// Reusable Image Upload & Dimension Component
function CMSImageUploader({ label, value, onChange, recommendedDimension }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('folder', 'cms');

      const res = await uploadCMSMedia(formData);
      const url = res?.url || (res?.data && res.data.url);
      if (url) {
        onChange(url);
      } else {
        throw new Error('Image URL was not returned');
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>{label}</label>
        {recommendedDimension && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#065935',
              background: '#eaf4ee',
              border: '1px solid #cce5d5',
              padding: '2px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>📐</span> {recommendedDimension}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        {/* Preview Thumbnail */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          {value ? (
            <img src={value} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Icon name="image" size={26} style={{ color: '#94a3b8' }} />
          )}
        </div>

        {/* Input & Upload Controls */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. /assets/... or paste image URL"
              className="form-input"
              style={{ flex: 1, fontSize: '13px', padding: '7px 12px' }}
            />
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontSize: '12.5px', padding: '7px 14px' }}
            >
              <Icon name="upload" size={14} />
              <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {error && (
            <div style={{ color: '#c8102e', fontSize: '11.5px', fontWeight: 600 }}>
              ✕ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const defaultBodyOrder = [
  'hero_carousel',
  'category_strip',
  'audience_cards',
  'jewellery_gallery',
  'shop_by_price',
  'featured_collection',
  'trust_strip',
  'campaign_banners',
  'newsletter_section'
];

const sectionLabels = {
  hero_carousel: 'Hero Slider',
  category_strip: 'Category Shortcuts',
  audience_cards: 'Audience Cards',
  jewellery_gallery: 'Jewellery Collections',
  shop_by_price: 'Shop by Price',
  featured_collection: 'Best Sellers',
  trust_strip: 'Service Guarantees',
  campaign_banners: 'Campaign Banners',
  newsletter_section: 'Newsletter Card'
};

export default function AdminCMSSectionsPage() {
  const [sections, setSections] = useState({});
  const [sectionOrder, setSectionOrder] = useState(defaultBodyOrder);
  const [activeTab, setActiveTab] = useState('category_strip');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Fetch sections from MySQL via admin API
  useEffect(() => {
    setLoading(true);
    getAdminCMSSections()
      .then((data) => {
        if (Array.isArray(data)) {
          const map = {};
          // Extract order for homepage body sections
          const sortedFromDb = [...data]
            .filter((item) => defaultBodyOrder.includes(item.section_key))
            .sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0))
            .map((item) => item.section_key);

          if (sortedFromDb.length > 0) {
            const missing = defaultBodyOrder.filter((k) => !sortedFromDb.includes(k));
            setSectionOrder([...sortedFromDb, ...missing]);
          }

          data.forEach((item) => {
            if (item.section_key) {
              let parsedContent = item.content;
              if (typeof parsedContent === 'string') {
                try {
                  parsedContent = JSON.parse(parsedContent);
                } catch (e) {}
              }
              map[item.section_key] = {
                title: item.title,
                subtitle: item.subtitle,
                is_visible: item.is_visible ? 1 : 0,
                display_order: Number(item.display_order) || 0,
                content: parsedContent || {}
              };
            }
          });
          setSections(map);
        }
      })
      .catch((err) => console.warn('Could not load CMS sections:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (sectionKey) => {
    setSaving(true);
    setSaveMessage('');
    try {
      const sectionData = sections[sectionKey] || {};
      await updateAdminCMSSection(sectionKey, {
        title: sectionData.title || null,
        subtitle: sectionData.subtitle || null,
        is_visible: sectionData.is_visible !== undefined ? sectionData.is_visible : 1,
        content: sectionData.content || {}
      });
      setSaveMessage(`Section "${sectionKey}" saved to MySQL successfully!`);
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Error saving section');
    } finally {
      setSaving(false);
    }
  };

  const moveSection = async (sectionKey, direction) => {
    const currentIndex = sectionOrder.indexOf(sectionKey);
    if (currentIndex === -1) return;
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= sectionOrder.length) return;

    const newOrder = [...sectionOrder];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    setSectionOrder(newOrder);
    setReordering(true);
    try {
      await reorderAdminCMSSections(newOrder);
      setSaveMessage(`Homepage order updated: "${sectionLabels[sectionKey] || sectionKey}" moved ${direction === -1 ? 'up' : 'down'}.`);
      setTimeout(() => setSaveMessage(''), 3500);
    } catch (err) {
      console.error('Failed to save section order:', err);
      alert('Error updating section order: ' + (err.message || 'Server error'));
    } finally {
      setReordering(false);
    }
  };

  const updateContent = (sectionKey, updater) => {
    setSections((prev) => {
      const current = prev[sectionKey] || { is_visible: 1, content: {} };
      const updatedContent = typeof updater === 'function' ? updater(current.content || {}) : updater;
      return {
        ...prev,
        [sectionKey]: {
          ...current,
          content: updatedContent
        }
      };
    });
  };

  const toggleVisibility = (sectionKey) => {
    setSections((prev) => {
      const current = prev[sectionKey] || { is_visible: 1, content: {} };
      return {
        ...prev,
        [sectionKey]: {
          ...current,
          is_visible: current.is_visible ? 0 : 1
        }
      };
    });
  };

  // --- Add & Delete Handlers for Cards Across All Tabs ---
  // 1. Category Shortcuts
  const addCategoryItem = () => {
    const currentItems = sections.category_strip?.content?.items || [];
    const newItem = {
      id: `cat_${Date.now()}`,
      name: `Category ${currentItems.length + 1}`,
      link: '/shop',
      image: ''
    };
    updateContent('category_strip', {
      ...sections.category_strip?.content,
      items: [...currentItems, newItem]
    });
  };

  const deleteCategoryItem = (idx) => {
    const currentItems = sections.category_strip?.content?.items || [];
    const newItems = currentItems.filter((_, i) => i !== idx);
    updateContent('category_strip', {
      ...sections.category_strip?.content,
      items: newItems
    });
  };

  // 2. Audience Cards
  const addAudienceCard = () => {
    const currentCards = sections.audience_cards?.content?.cards || [];
    const newCard = {
      id: `audience_${Date.now()}`,
      tag: 'NEW COLLECTION',
      title: `Collection ${currentCards.length + 1}`,
      sub: 'Handpicked styles & essentials',
      btnText: 'Shop Now',
      btnClass: currentCards.length % 2 === 0 ? 'audience-btn--red' : 'audience-btn--green',
      link: '/shop',
      image: ''
    };
    updateContent('audience_cards', {
      ...sections.audience_cards?.content,
      cards: [...currentCards, newCard]
    });
  };

  const deleteAudienceCard = (idx) => {
    const currentCards = sections.audience_cards?.content?.cards || [];
    const newCards = currentCards.filter((_, i) => i !== idx);
    updateContent('audience_cards', {
      ...sections.audience_cards?.content,
      cards: newCards
    });
  };

  // 3. Jewellery Collections
  const addJewelleryItem = () => {
    const currentItems = sections.jewellery_gallery?.content?.items || [];
    const newItem = {
      name: `Collection ${currentItems.length + 1}`,
      link: '/shop?category=Accessories',
      image: ''
    };
    updateContent('jewellery_gallery', {
      ...sections.jewellery_gallery?.content,
      items: [...currentItems, newItem]
    });
  };

  const deleteJewelleryItem = (idx) => {
    const currentItems = sections.jewellery_gallery?.content?.items || [];
    const newItems = currentItems.filter((_, i) => i !== idx);
    updateContent('jewellery_gallery', {
      ...sections.jewellery_gallery?.content,
      items: newItems
    });
  };

  // 4. Shop by Price
  const addPriceTier = () => {
    const currentTiers = sections.shop_by_price?.content?.tiers || [];
    const newTier = {
      prefix: 'Under',
      amount: '₹999',
      themeClass: 'price-card--sage',
      link: '/shop?max_price=999',
      image: ''
    };
    updateContent('shop_by_price', {
      ...sections.shop_by_price?.content,
      tiers: [...currentTiers, newTier]
    });
  };

  const deletePriceTier = (idx) => {
    const currentTiers = sections.shop_by_price?.content?.tiers || [];
    const newTiers = currentTiers.filter((_, i) => i !== idx);
    updateContent('shop_by_price', {
      ...sections.shop_by_price?.content,
      tiers: newTiers
    });
  };

  // 5. Trust Strip / Service Guarantees
  const addTrustItem = () => {
    const currentItems = sections.trust_strip?.content?.items || [];
    const newItem = {
      title: `Guarantee ${currentItems.length + 1}`,
      desc: '100% Quality & Care',
      image: ''
    };
    updateContent('trust_strip', {
      ...sections.trust_strip?.content,
      items: [...currentItems, newItem]
    });
  };

  const deleteTrustItem = (idx) => {
    const currentItems = sections.trust_strip?.content?.items || [];
    const newItems = currentItems.filter((_, i) => i !== idx);
    updateContent('trust_strip', {
      ...sections.trust_strip?.content,
      items: newItems
    });
  };

  // 6. Campaign Banners
  const addCampaignBanner = () => {
    const currentBanners = sections.campaign_banners?.content?.banners || [];
    const newBanner = {
      id: `banner_${Date.now()}`,
      title: 'Special\nEdition',
      subtitle: 'Exclusive seasonal release',
      ctaText: 'Discover',
      link: '/shop',
      image: ''
    };
    updateContent('campaign_banners', {
      ...sections.campaign_banners?.content,
      banners: [...currentBanners, newBanner]
    });
  };

  const deleteCampaignBanner = (idx) => {
    const currentBanners = sections.campaign_banners?.content?.banners || [];
    const newBanners = currentBanners.filter((_, i) => i !== idx);
    updateContent('campaign_banners', {
      ...sections.campaign_banners?.content,
      banners: newBanners
    });
  };

  const tabs = [
    { id: 'category_strip', label: '1. Category Shortcuts', icon: 'grid', badge: `${sections.category_strip?.content?.items?.length || 0} items` },
    { id: 'audience_cards', label: '2. Audience Cards', icon: 'star', badge: `${sections.audience_cards?.content?.cards?.length || 0} cards` },
    { id: 'jewellery_gallery', label: '3. Jewellery Collections', icon: 'sparkles', badge: `${sections.jewellery_gallery?.content?.items?.length || 0} items` },
    { id: 'shop_by_price', label: '4. Shop by Price', icon: 'tag', badge: `${sections.shop_by_price?.content?.tiers?.length || 0} tiers` },
    { id: 'trust_strip', label: '5. Service Guarantees', icon: 'shieldCheck', badge: `${sections.trust_strip?.content?.items?.length || 0} badges` },
    { id: 'campaign_banners', label: '6. Campaign Banners', icon: 'banner', badge: `${sections.campaign_banners?.content?.banners?.length || 0} cards` },
    { id: 'newsletter_section', label: '7. Newsletter Card', icon: 'mail', badge: 'Full Width' },
    { id: 'hero_carousel', label: '8. Hero Slider (Up to 3)', icon: 'image', badge: `${sections.hero_carousel?.content?.slides?.length || 1} slides` },
    { id: 'main_navigation', label: '9. Header & Nav Ribbon', icon: 'menu', badge: 'Nav' },
    { id: 'announcement', label: '10. Top Announcement', icon: 'bell', badge: 'Ticker' },
    { id: 'footer_section', label: '11. Footer Columns', icon: 'info', badge: 'Info' }
  ];

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Homepage CMS & Section Controls" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)' }}>Homepage Sections Manager</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Manage all visual sections with card image upload, dimension guidelines, and direct MySQL synchronization.
              </p>
            </div>
            {saveMessage && (
              <div style={{ background: '#eaf4ee', color: '#065935', border: '1px solid #cce5d5', padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 700 }}>
                ✓ {saveMessage}
              </div>
            )}
          </div>

          {/* Section Order Placement Bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>↕️</span> Homepage Section Placement Order (Move Up / Down)
                </h2>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                  Live storefront order sequence. Click ▲ or ▼ to move up or down — changes save directly to MySQL and sync to the storefront.
                </p>
              </div>
              {reordering && (
                <span style={{ fontSize: '12px', color: '#065935', fontWeight: 700 }}>
                  Saving order to database...
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              {sectionOrder.map((key, idx) => {
                const isActive = activeTab === key;
                const isFirst = idx === 0;
                const isLast = idx === sectionOrder.length - 1;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: isActive ? '#eaf4ee' : '#ffffff',
                      border: isActive ? '1.5px solid #065935' : '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: isActive ? '#065935' : '#1e293b',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab(key)}
                      style={{ background: 'none', border: 'none', padding: 0, fontWeight: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                      title="Click to view/edit section"
                    >
                      {sectionLabels[key] || key}
                    </button>
                    <div style={{ display: 'flex', gap: '3px', marginLeft: '4px' }}>
                      <button
                        type="button"
                        disabled={isFirst || reordering}
                        onClick={() => moveSection(key, -1)}
                        style={{
                          background: isFirst ? '#f1f5f9' : '#e2e8f0',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: isFirst ? 'not-allowed' : 'pointer',
                          color: isFirst ? '#94a3b8' : '#0f172a'
                        }}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={isLast || reordering}
                        onClick={() => moveSection(key, 1)}
                        style={{
                          background: isLast ? '#f1f5f9' : '#e2e8f0',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 800,
                          cursor: isLast ? 'not-allowed' : 'pointer',
                          color: isLast ? '#94a3b8' : '#0f172a'
                        }}
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--line)', marginBottom: '22px', overflowX: 'auto', paddingBottom: '2px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  border: 'none',
                  background: activeTab === tab.id ? '#ffffff' : 'none',
                  borderBottom: activeTab === tab.id ? '3px solid var(--np-green, #065935)' : '3px solid transparent',
                  color: activeTab === tab.id ? 'var(--np-green, #065935)' : 'var(--muted)',
                  fontWeight: activeTab === tab.id ? 800 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderRadius: '6px 6px 0 0'
                }}
              >
                <span>{tab.label}</span>
                <span style={{ fontSize: '10px', background: activeTab === tab.id ? '#eaf4ee' : '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                  {tab.badge}
                </span>
              </button>
            ))}
          </div>

          {/* Active Tab Panel Card */}
          <div className="stat-card" style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            {/* Top Visibility, Order & Save Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sections[activeTab]?.is_visible)}
                    onChange={() => toggleVisibility(activeTab)}
                    style={{ width: '18px', height: '18px', accentColor: '#065935' }}
                  />
                  <span>Show this section on storefront</span>
                </label>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: sections[activeTab]?.is_visible ? '#eaf4ee' : '#fee2e2',
                    color: sections[activeTab]?.is_visible ? '#065935' : '#c8102e'
                  }}
                >
                  {sections[activeTab]?.is_visible ? '● Active' : '○ Hidden'}
                </span>

                {sectionOrder.includes(activeTab) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px', paddingLeft: '14px', borderLeft: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                      Placement: <strong>#{sectionOrder.indexOf(activeTab) + 1}</strong> of {sectionOrder.length}
                    </span>
                    <button
                      type="button"
                      disabled={sectionOrder.indexOf(activeTab) === 0 || reordering}
                      onClick={() => moveSection(activeTab, -1)}
                      className="admin-btn admin-btn-outline"
                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}
                      title="Move section up"
                    >
                      ▲ Up
                    </button>
                    <button
                      type="button"
                      disabled={sectionOrder.indexOf(activeTab) === sectionOrder.length - 1 || reordering}
                      onClick={() => moveSection(activeTab, 1)}
                      className="admin-btn admin-btn-outline"
                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}
                      title="Move section down"
                    >
                      ▼ Down
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => handleSave(activeTab)}
                disabled={saving}
                style={{ background: '#065935', borderColor: '#065935', padding: '9px 24px', fontSize: '13.5px', fontWeight: 700 }}
              >
                <Icon name="check" size={16} />
                <span>{saving ? 'Saving to MySQL...' : 'Save Section'}</span>
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading CMS sections from database...</div>
            ) : null}

            {/* TAB 1: CATEGORY SHORTCUTS (ITEMS) */}
            {activeTab === 'category_strip' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Shop by Category Shortcuts ({sections.category_strip?.content?.items?.length || 0} Cards)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Configure circular unshaped category shortcuts with slow auto-scroll marquee.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCategoryItem}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Category Card
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {(sections.category_strip?.content?.items || []).map((cat, idx) => (
                    <div key={cat.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#065935' }}>
                          #{idx + 1} {cat.name || 'Untitled Category'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCategoryItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Card
                        </button>
                      </div>

                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Category Name</label>
                        <input
                          type="text"
                          value={cat.name || ''}
                          onChange={(e) => {
                            const newItems = [...(sections.category_strip?.content?.items || [])];
                            newItems[idx] = { ...newItems[idx], name: e.target.value };
                            updateContent('category_strip', { ...sections.category_strip?.content, items: newItems });
                          }}
                          className="form-input"
                          style={{ fontSize: '13px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Shop URL</label>
                        <input
                          type="text"
                          value={cat.link || ''}
                          onChange={(e) => {
                            const newItems = [...(sections.category_strip?.content?.items || [])];
                            newItems[idx] = { ...newItems[idx], link: e.target.value };
                            updateContent('category_strip', { ...sections.category_strip?.content, items: newItems });
                          }}
                          className="form-input"
                          style={{ fontSize: '13px' }}
                        />
                      </div>

                      <CMSImageUploader
                        label="Category Card Image"
                        value={cat.image}
                        recommendedDimension="240 × 240 px (1:1 Transparent PNG)"
                        onChange={(newUrl) => {
                          const newItems = [...(sections.category_strip?.content?.items || [])];
                          newItems[idx] = { ...newItems[idx], image: newUrl };
                          updateContent('category_strip', { ...sections.category_strip?.content, items: newItems });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: AUDIENCE FEATURE CARDS (WOMEN, MEN, KIDS) */}
            {activeTab === 'audience_cards' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Collections by Audience ({sections.audience_cards?.content?.cards?.length || 0} Cards)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Full-cover lifestyle photos with zero color overlay. Curated for Women, Men, Kids and more.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addAudienceCard}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Audience Card
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                  {(sections.audience_cards?.content?.cards || []).map((card, idx) => (
                    <div key={card.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: '#065935' }}>
                          Card #{idx + 1}: {card.title || 'Untitled Card'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAudienceCard(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Card
                        </button>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Eyebrow Tag</label>
                        <input
                          type="text"
                          value={card.tag || ''}
                          onChange={(e) => {
                            const newCards = [...(sections.audience_cards?.content?.cards || [])];
                            newCards[idx] = { ...newCards[idx], tag: e.target.value };
                            updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Card Title</label>
                        <input
                          type="text"
                          value={card.title || ''}
                          onChange={(e) => {
                            const newCards = [...(sections.audience_cards?.content?.cards || [])];
                            newCards[idx] = { ...newCards[idx], title: e.target.value };
                            updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Subtitle</label>
                        <input
                          type="text"
                          value={card.sub || ''}
                          onChange={(e) => {
                            const newCards = [...(sections.audience_cards?.content?.cards || [])];
                            newCards[idx] = { ...newCards[idx], sub: e.target.value };
                            updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>CTA Button Text</label>
                          <input
                            type="text"
                            value={card.btnText || ''}
                            onChange={(e) => {
                              const newCards = [...(sections.audience_cards?.content?.cards || [])];
                              newCards[idx] = { ...newCards[idx], btnText: e.target.value };
                              updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                            }}
                            className="form-input"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>Shop URL</label>
                          <input
                            type="text"
                            value={card.link || ''}
                            onChange={(e) => {
                              const newCards = [...(sections.audience_cards?.content?.cards || [])];
                              newCards[idx] = { ...newCards[idx], link: e.target.value };
                              updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                            }}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <CMSImageUploader
                        label="Background Cover Image"
                        value={card.image}
                        recommendedDimension="900 × 600 px (3:2 Aspect Ratio)"
                        onChange={(newUrl) => {
                          const newCards = [...(sections.audience_cards?.content?.cards || [])];
                          newCards[idx] = { ...newCards[idx], image: newUrl };
                          updateContent('audience_cards', { ...sections.audience_cards?.content, cards: newCards });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: JEWELLERY COLLECTIONS (ITEMS) */}
            {activeTab === 'jewellery_gallery' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Jewellery Collections ({sections.jewellery_gallery?.content?.items?.length || 0} Items)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Rendered in 134px circular masks without borders, spanning full width across rows of 6.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addJewelleryItem}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Jewellery Item
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Section Title</label>
                    <input
                      type="text"
                      value={sections.jewellery_gallery?.content?.title || ''}
                      onChange={(e) => updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Section Subtitle</label>
                    <input
                      type="text"
                      value={sections.jewellery_gallery?.content?.subtitle || ''}
                      onChange={(e) => updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, subtitle: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>View All Link</label>
                    <input
                      type="text"
                      value={sections.jewellery_gallery?.content?.view_all_url || ''}
                      onChange={(e) => updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, view_all_url: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                  {(sections.jewellery_gallery?.content?.items || []).map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#065935' }}>
                          #{idx + 1} {item.name || 'Untitled Item'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteJewelleryItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Item
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Label</label>
                          <input
                            type="text"
                            value={item.name || ''}
                            onChange={(e) => {
                              const newItems = [...(sections.jewellery_gallery?.content?.items || [])];
                              newItems[idx] = { ...newItems[idx], name: e.target.value };
                              updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, items: newItems });
                            }}
                            className="form-input"
                            style={{ fontSize: '12.5px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Target Link</label>
                          <input
                            type="text"
                            value={item.link || ''}
                            onChange={(e) => {
                              const newItems = [...(sections.jewellery_gallery?.content?.items || [])];
                              newItems[idx] = { ...newItems[idx], link: e.target.value };
                              updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, items: newItems });
                            }}
                            className="form-input"
                            style={{ fontSize: '12.5px' }}
                          />
                        </div>
                      </div>

                      <CMSImageUploader
                        label="Jewellery Circle Image"
                        value={item.image}
                        recommendedDimension="270 × 270 px (1:1 Circular Mask)"
                        onChange={(newUrl) => {
                          const newItems = [...(sections.jewellery_gallery?.content?.items || [])];
                          newItems[idx] = { ...newItems[idx], image: newUrl };
                          updateContent('jewellery_gallery', { ...sections.jewellery_gallery?.content, items: newItems });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: SHOP BY PRICE (TIERS) */}
            {activeTab === 'shop_by_price' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Shop by Price ({sections.shop_by_price?.content?.tiers?.length || 0} Price Tiers)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Compact price tier cards with large premium typography, price values, and pill CTA buttons.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addPriceTier}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Price Tier
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Section Title</label>
                    <input
                      type="text"
                      value={sections.shop_by_price?.content?.title || ''}
                      onChange={(e) => updateContent('shop_by_price', { ...sections.shop_by_price?.content, title: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px' }}>Section Subtitle</label>
                    <input
                      type="text"
                      value={sections.shop_by_price?.content?.subtitle || ''}
                      onChange={(e) => updateContent('shop_by_price', { ...sections.shop_by_price?.content, subtitle: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {(sections.shop_by_price?.content?.tiers || []).map((tier, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#065935' }}>
                          Tier #{idx + 1}: {tier.prefix} {tier.amount}
                        </div>
                        <button
                          type="button"
                          onClick={() => deletePriceTier(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Tier
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>Prefix</label>
                          <input
                            type="text"
                            value={tier.prefix || ''}
                            onChange={(e) => {
                              const newTiers = [...(sections.shop_by_price?.content?.tiers || [])];
                              newTiers[idx] = { ...newTiers[idx], prefix: e.target.value };
                              updateContent('shop_by_price', { ...sections.shop_by_price?.content, tiers: newTiers });
                            }}
                            className="form-input"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>Amount</label>
                          <input
                            type="text"
                            value={tier.amount || ''}
                            onChange={(e) => {
                              const newTiers = [...(sections.shop_by_price?.content?.tiers || [])];
                              newTiers[idx] = { ...newTiers[idx], amount: e.target.value };
                              updateContent('shop_by_price', { ...sections.shop_by_price?.content, tiers: newTiers });
                            }}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Shop URL</label>
                        <input
                          type="text"
                          value={tier.link || ''}
                          onChange={(e) => {
                            const newTiers = [...(sections.shop_by_price?.content?.tiers || [])];
                            newTiers[idx] = { ...newTiers[idx], link: e.target.value };
                            updateContent('shop_by_price', { ...sections.shop_by_price?.content, tiers: newTiers });
                          }}
                          className="form-input"
                        />
                      </div>

                      <CMSImageUploader
                        label="Product Preview Image"
                        value={tier.image}
                        recommendedDimension="300 × 240 px (Transparent Product)"
                        onChange={(newUrl) => {
                          const newTiers = [...(sections.shop_by_price?.content?.tiers || [])];
                          newTiers[idx] = { ...newTiers[idx], image: newUrl };
                          updateContent('shop_by_price', { ...sections.shop_by_price?.content, tiers: newTiers });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: SERVICE GUARANTEES / TRUST STRIP (ITEMS) */}
            {activeTab === 'trust_strip' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Service Guarantees ({sections.trust_strip?.content?.items?.length || 0} Badges)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Guarantee bubbles with high-res extracted icons and trust badges.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTrustItem}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Guarantee Badge
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                  {(sections.trust_strip?.content?.items || []).map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: '#065935' }}>
                          Badge #{idx + 1}: {item.title || 'Untitled Badge'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteTrustItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Badge
                        </button>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Title</label>
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => {
                            const newItems = [...(sections.trust_strip?.content?.items || [])];
                            newItems[idx] = { ...newItems[idx], title: e.target.value };
                            updateContent('trust_strip', { ...sections.trust_strip?.content, items: newItems });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Description</label>
                        <input
                          type="text"
                          value={item.desc || ''}
                          onChange={(e) => {
                            const newItems = [...(sections.trust_strip?.content?.items || [])];
                            newItems[idx] = { ...newItems[idx], desc: e.target.value };
                            updateContent('trust_strip', { ...sections.trust_strip?.content, items: newItems });
                          }}
                          className="form-input"
                        />
                      </div>

                      <CMSImageUploader
                        label="Trust Icon Image"
                        value={item.image}
                        recommendedDimension="96 × 96 px (1:1 Clean PNG/SVG)"
                        onChange={(newUrl) => {
                          const newItems = [...(sections.trust_strip?.content?.items || [])];
                          newItems[idx] = { ...newItems[idx], image: newUrl };
                          updateContent('trust_strip', { ...sections.trust_strip?.content, items: newItems });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: SPECIAL CAMPAIGN BANNERS (CARDS) */}
            {activeTab === 'campaign_banners' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                      Special Campaign Banners ({sections.campaign_banners?.content?.banners?.length || 0} Cards)
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Promotional cards with zero color overlay and pill CTA buttons.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCampaignBanner}
                    className="admin-btn admin-btn-outline"
                    style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                  >
                    + Add Campaign Banner
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
                  {(sections.campaign_banners?.content?.banners || []).map((banner, idx) => (
                    <div key={banner.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px', background: '#fafbfc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: '#065935' }}>
                          Banner #{idx + 1}: {banner.title?.replace('\n', ' ') || 'Untitled Banner'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteCampaignBanner(idx)}
                          style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '2px 6px' }}
                        >
                          ✕ Delete Banner
                        </button>
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Headline</label>
                        <input
                          type="text"
                          value={banner.title || ''}
                          onChange={(e) => {
                            const newBanners = [...(sections.campaign_banners?.content?.banners || [])];
                            newBanners[idx] = { ...newBanners[idx], title: e.target.value };
                            updateContent('campaign_banners', { ...sections.campaign_banners?.content, banners: newBanners });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '12px' }}>Subtitle</label>
                        <input
                          type="text"
                          value={banner.subtitle || ''}
                          onChange={(e) => {
                            const newBanners = [...(sections.campaign_banners?.content?.banners || [])];
                            newBanners[idx] = { ...newBanners[idx], subtitle: e.target.value };
                            updateContent('campaign_banners', { ...sections.campaign_banners?.content, banners: newBanners });
                          }}
                          className="form-input"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>CTA Text</label>
                          <input
                            type="text"
                            value={banner.ctaText || ''}
                            onChange={(e) => {
                              const newBanners = [...(sections.campaign_banners?.content?.banners || [])];
                              newBanners[idx] = { ...newBanners[idx], ctaText: e.target.value };
                              updateContent('campaign_banners', { ...sections.campaign_banners?.content, banners: newBanners });
                            }}
                            className="form-input"
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label className="form-label" style={{ fontSize: '12px' }}>Target Link</label>
                          <input
                            type="text"
                            value={banner.link || ''}
                            onChange={(e) => {
                              const newBanners = [...(sections.campaign_banners?.content?.banners || [])];
                              newBanners[idx] = { ...newBanners[idx], link: e.target.value };
                              updateContent('campaign_banners', { ...sections.campaign_banners?.content, banners: newBanners });
                            }}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <CMSImageUploader
                        label="Banner Background Image"
                        value={banner.image}
                        recommendedDimension="800 × 480 px (5:3 Aspect Ratio)"
                        onChange={(newUrl) => {
                          const newBanners = [...(sections.campaign_banners?.content?.banners || [])];
                          newBanners[idx] = { ...newBanners[idx], image: newUrl };
                          updateContent('campaign_banners', { ...sections.campaign_banners?.content, banners: newBanners });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: NEWSLETTER CARD (FULL WIDTH) */}
            {activeTab === 'newsletter_section' && (
              <div style={{ maxWidth: '640px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                  Newsletter Community Card (Clean Full-Width UI)
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                  Mint card with circular/square envelope icon, headline, and pill form.
                </p>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Headline Title</label>
                  <input
                    type="text"
                    value={sections.newsletter_section?.content?.title || ''}
                    onChange={(e) => updateContent('newsletter_section', { ...sections.newsletter_section?.content, title: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Subtitle Description</label>
                  <input
                    type="text"
                    value={sections.newsletter_section?.content?.subtitle || ''}
                    onChange={(e) => updateContent('newsletter_section', { ...sections.newsletter_section?.content, subtitle: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Button Text</label>
                  <input
                    type="text"
                    value={sections.newsletter_section?.content?.button_text || ''}
                    onChange={(e) => updateContent('newsletter_section', { ...sections.newsletter_section?.content, button_text: e.target.value })}
                    className="form-input"
                  />
                </div>

                <CMSImageUploader
                  label="Newsletter Badge Icon"
                  value={sections.newsletter_section?.content?.icon}
                  recommendedDimension="110 × 110 px (1:1 Clean PNG)"
                  onChange={(newUrl) => updateContent('newsletter_section', { ...sections.newsletter_section?.content, icon: newUrl })}
                />
              </div>
            )}

            {/* TAB 8: HERO BANNER SLIDER (UP TO 3 SLIDES) */}
            {activeTab === 'hero_carousel' && (() => {
              const currentSlides = (Array.isArray(sections.hero_carousel?.content?.slides) && sections.hero_carousel.content.slides.length > 0)
                ? sections.hero_carousel.content.slides
                : [
                    {
                      id: 1,
                      image: sections.hero_carousel?.content?.banner_image || '',
                      link: sections.hero_carousel?.content?.button_url || '/shop',
                      title: 'Slide 1'
                    }
                  ];

              const updateSlides = (newSlides) => {
                updateContent('hero_carousel', {
                  ...sections.hero_carousel?.content,
                  slides: newSlides,
                  banner_image: newSlides[0]?.image || '',
                  button_url: newSlides[0]?.link || '/shop'
                });
              };

              const addSlide = () => {
                if (currentSlides.length >= 3) return;
                const newId = Date.now();
                const nextSlideNum = currentSlides.length + 1;
                updateSlides([
                  ...currentSlides,
                  {
                    id: newId,
                    image: '',
                    link: '/shop',
                    title: `Slide ${nextSlideNum}`
                  }
                ]);
              };

              const removeSlide = (idx) => {
                if (currentSlides.length <= 1) return;
                const updated = currentSlides.filter((_, i) => i !== idx);
                updateSlides(updated);
              };

              const updateSlideField = (idx, field, val) => {
                const updated = currentSlides.map((slide, i) => (i === idx ? { ...slide, [field]: val } : slide));
                updateSlides(updated);
              };

              return (
                <div style={{ maxWidth: '820px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                        Hero Banner Sliders (Up to 3 Slides)
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        Configure up to 3 rotating full-width banner slides. Displays edge-to-edge on storefront with smooth auto-scroll.
                      </p>
                    </div>

                    {currentSlides.length < 3 && (
                      <button
                        type="button"
                        onClick={addSlide}
                        className="admin-btn admin-btn-outline"
                        style={{ fontSize: '13px', fontWeight: 700, borderColor: '#065935', color: '#065935' }}
                      >
                        + Add Slide ({currentSlides.length}/3)
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {currentSlides.map((slide, idx) => (
                      <div
                        key={slide.id || idx}
                        className="cms-item-card"
                        style={{ border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '18px', background: '#fafbfc' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #eef2f6', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#065935', color: '#ffffff', borderRadius: '6px', fontSize: '12px', fontWeight: 800, padding: '2px 8px' }}>
                              Slide #{idx + 1}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>
                              {slide.title || `Banner Slide ${idx + 1}`}
                            </span>
                          </div>

                          {currentSlides.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSlide(idx)}
                              style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
                            >
                              ✕ Remove Slide
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Slide Label / Alt Text</label>
                            <input
                              type="text"
                              value={slide.title || ''}
                              onChange={(e) => updateSlideField(idx, 'title', e.target.value)}
                              className="form-input"
                              placeholder="e.g. Festive Sale / New Collection"
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Click Link URL</label>
                            <input
                              type="text"
                              value={slide.link || ''}
                              onChange={(e) => updateSlideField(idx, 'link', e.target.value)}
                              className="form-input"
                              placeholder="e.g. /shop or /collections"
                            />
                          </div>
                        </div>

                        <CMSImageUploader
                          label="Slide Banner Image"
                          value={slide.image}
                          recommendedDimension="1440 × 420 px (Wide Banner — JPG/PNG)"
                          onChange={(newUrl) => updateSlideField(idx, 'image', newUrl)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* TAB 9: MAIN NAVIGATION & BRAND LOGO */}
            {activeTab === 'main_navigation' && (
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                  Header &amp; Brand Logo
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                  Brand logo with upload &amp; dimensions, search placeholder, and navigation items.
                </p>

                <div style={{ maxWidth: '520px', marginBottom: '20px' }}>
                  <CMSImageUploader
                    label="Brand Logo"
                    value={sections.main_navigation?.content?.logo_url}
                    recommendedDimension="220 × 52 px (Transparent PNG / SVG)"
                    onChange={(newUrl) => updateContent('main_navigation', { ...sections.main_navigation?.content, logo_url: newUrl })}
                  />

                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label className="form-label">Search Input Placeholder</label>
                    <input
                      type="text"
                      value={sections.main_navigation?.content?.search_placeholder || ''}
                      onChange={(e) => updateContent('main_navigation', { ...sections.main_navigation?.content, search_placeholder: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 10: STORE ANNOUNCEMENT */}
            {activeTab === 'announcement' && (
              <div style={{ maxWidth: '520px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                  Store Announcement Ticker &amp; Links
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                  Top banner highlights and support utility links.
                </p>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Shipping Highlight</label>
                  <input
                    type="text"
                    value={sections.announcement?.content?.shipping_text || ''}
                    onChange={(e) => updateContent('announcement', { ...sections.announcement?.content, shipping_text: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Returns Highlight</label>
                  <input
                    type="text"
                    value={sections.announcement?.content?.returns_text || ''}
                    onChange={(e) => updateContent('announcement', { ...sections.announcement?.content, returns_text: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Payments Highlight</label>
                  <input
                    type="text"
                    value={sections.announcement?.content?.payments_text || ''}
                    onChange={(e) => updateContent('announcement', { ...sections.announcement?.content, payments_text: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {/* TAB 11: FOOTER SECTION */}
            {activeTab === 'footer_section' && (
              <div style={{ maxWidth: '600px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>
                  Footer Columns &amp; Brand Information
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                  Footer brand logo in original color, white column titles, contact info and copyright.
                </p>

                <CMSImageUploader
                  label="Footer Brand Logo"
                  value={sections.footer_section?.content?.logo_url}
                  recommendedDimension="200 × 46 px (Original Color PNG)"
                  onChange={(newUrl) => updateContent('footer_section', { ...sections.footer_section?.content, logo_url: newUrl })}
                />

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">About Brand Paragraph</label>
                  <textarea
                    rows={3}
                    value={sections.footer_section?.content?.about || ''}
                    onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, about: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      value={sections.footer_section?.content?.phone || ''}
                      onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, phone: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="text"
                      value={sections.footer_section?.content?.email || ''}
                      onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, email: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Working Hours</label>
                  <input
                    type="text"
                    value={sections.footer_section?.content?.hours || ''}
                    onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, hours: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Physical Address</label>
                  <input
                    type="text"
                    value={sections.footer_section?.content?.address || ''}
                    onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, address: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Copyright Text</label>
                  <input
                    type="text"
                    value={sections.footer_section?.content?.copyright || ''}
                    onChange={(e) => updateContent('footer_section', { ...sections.footer_section?.content, copyright: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
