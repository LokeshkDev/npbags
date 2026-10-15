'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { Topbar } from '../../../components/Topbar';
import { Icon } from '../../../components/Icons';
import { getAdminCMSSections, updateAdminCMSSection, getAdminCategories } from '../../../lib/api';

export default function AdminCMSSectionsPage() {
  const [sections, setSections] = useState({
    main_navigation: {
      is_visible: 1,
      content: {
        items: [
          {
            id: 'menu_collections',
            label: 'Collections',
            url: '/shop',
            has_submenu: true,
            subitems: [
              { label: 'All Collections', url: '/shop' },
              { label: 'Everyday Essentials', url: '/shop?category=Everyday+essentials' },
              { label: 'On The Go', url: '/shop?category=On+the+go' },
              { label: 'Travel Edit', url: '/shop?category=Travel+edit' }
            ]
          },
          { id: 'menu_new', label: 'New Arrivals', url: '/shop?filter=new', has_submenu: false, subitems: [] },
          { id: 'menu_story', label: 'Our Story', url: '/about', has_submenu: false, subitems: [] },
          { id: 'menu_why', label: 'Why Us', url: '/#benefits', has_submenu: false, subitems: [] },
          { id: 'menu_blog', label: 'Editorial', url: '/blog', has_submenu: false, subitems: [] },
          { id: 'menu_contact', label: 'Contact', url: '/contact', has_submenu: false, subitems: [] }
        ]
      }
    },
    announcement: {
      is_visible: 1,
      content: {
        items: [
          'Complimentary delivery on qualifying orders over ₹499',
          'Fresh picks. Thoughtful details.',
          'Easy 30-day exchanges'
        ]
      }
    },
    hero_carousel: {
      is_visible: 1,
      content: {
        slides: [
          {
            kicker: 'Summer Collection 2026',
            heading: 'Everyday, Elevated.',
            lead: 'Carry less, keep more with sustainably crafted everyday bags.',
            primaryText: 'Explore Collection',
            primaryUrl: '/shop',
            secondaryText: 'Read Journal',
            secondaryUrl: '/blog',
            image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1600&q=85'
          },
          {
            kicker: 'Handcrafted Quality',
            heading: 'Form Meets Utility.',
            lead: 'Every stitch reinforced for life on the move.',
            primaryText: 'Shop New Arrivals',
            primaryUrl: '/shop',
            secondaryText: 'Our Story',
            secondaryUrl: '/about',
            image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1600&q=85'
          }
        ]
      }
    },
    trust_strip: {
      is_visible: 1,
      content: {
        items: [
          { icon: 'delivery', title: 'Free Delivery', subtitle: 'On qualifying orders over ₹499' },
          { icon: 'shieldCheck', title: '30-Day Exchanges', subtitle: 'Simple, hassle-free returns' },
          { icon: 'star', title: 'Handcrafted Quality', subtitle: 'Direct artisan craftsmanship' },
          { icon: 'bag', title: '100% Secure Checkout', subtitle: 'Encrypted UPI, Cards & COD' }
        ]
      }
    },
    editorial_banner: {
      is_visible: 1,
      content: {
        eyebrow: 'A Little More Considered',
        heading: 'Good design.\nBetter everyday.',
        body: "We believe the pieces you reach for most should be the ones you love most. That's why we focus on useful details, considered design and lasting style.",
        buttonText: 'Get to know us',
        buttonUrl: '/about',
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85'
      }
    },
    benefits_section: {
      is_visible: 1,
      content: {
        eyebrow: 'The difference is in the details',
        heading: 'Why shop with us?',
        items: [
          { icon: 'sparkles', title: 'Considered by design', description: 'Practical details and versatile styles that work with your everyday routine.' },
          { icon: 'shieldCheck', title: 'Made for real life', description: 'Easy-to-use pieces designed to go from busy weekdays to relaxed weekends.' },
          { icon: 'user', title: 'Here for you', description: 'A friendly team and a straightforward shopping experience, every step of the way.' }
        ]
      }
    },
    newsletter_section: {
      is_visible: 1,
      content: {
        heading: 'Stay in the loop',
        body: 'Subscribe for thoughtfully curated updates, new arrival drops, and 10% off your first bag.',
        buttonText: 'Subscribe'
      }
    }
  });

  const [activeTab, setActiveTab] = useState('main_navigation');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    getAdminCMSSections()
      .then(data => {
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => {
            if (item.section_key) {
              let parsedContent = item.content;
              if (typeof parsedContent === 'string') {
                try { parsedContent = JSON.parse(parsedContent); } catch (e) {}
              }
              map[item.section_key] = {
                title: item.title,
                subtitle: item.subtitle,
                is_visible: item.is_visible ? 1 : 0,
                content: parsedContent
              };
            }
          });
          setSections(prev => ({
            ...prev,
            ...map
          }));
        } else if (data && typeof data === 'object') {
          setSections(prev => ({
            ...prev,
            ...data
          }));
        }
      })
      .catch((err) => console.warn('Could not load CMS sections:', err));
  }, []);

  const handleSave = async (sectionKey) => {
    setSaving(true);
    setSaveMessage('');
    try {
      const sectionData = sections[sectionKey];
      await updateAdminCMSSection(sectionKey, {
        title: sectionData?.title || null,
        subtitle: sectionData?.subtitle || null,
        is_visible: sectionData?.is_visible ? 1 : 0,
        content: sectionData?.content
      });
      setSaveMessage(`Section "${sectionKey}" saved successfully!`);
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Error saving section');
    } finally {
      setSaving(false);
    }
  };

  const updateSectionContent = (sectionKey, newContent) => {
    setSections(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        content: newContent
      }
    }));
  };

  const toggleVisibility = (sectionKey) => {
    setSections(prev => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        is_visible: prev[sectionKey]?.is_visible ? 0 : 1
      }
    }));
  };

  // Top-level Navigation Menu helpers
  const handleAddMenuItem = () => {
    const currentItems = sections.main_navigation?.content?.items || [];
    const newItem = {
      id: `menu_${Date.now()}`,
      label: 'New Link',
      url: '/shop',
      has_submenu: false,
      subitems: []
    };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: [...currentItems, newItem]
    });
  };

  const handleUpdateMenuItem = (index, field, value) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    currentItems[index] = { ...currentItems[index], [field]: value };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleDeleteMenuItem = (index) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    currentItems.splice(index, 1);
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleMoveMenuItem = (index, direction) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    const temp = currentItems[index];
    currentItems[index] = currentItems[targetIndex];
    currentItems[targetIndex] = temp;
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  // Sub-menu helpers
  const handleAddSubItem = (menuIndex) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    const subitems = [...(currentItems[menuIndex].subitems || [])];
    subitems.push({
      id: `sub_${Date.now()}`,
      label: 'Sub Link',
      url: '/shop'
    });
    currentItems[menuIndex] = { ...currentItems[menuIndex], subitems, has_submenu: true };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleUpdateSubItem = (menuIndex, subIndex, field, value) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    const subitems = [...(currentItems[menuIndex].subitems || [])];
    subitems[subIndex] = { ...subitems[subIndex], [field]: value };
    currentItems[menuIndex] = { ...currentItems[menuIndex], subitems };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleDeleteSubItem = (menuIndex, subIndex) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    const subitems = [...(currentItems[menuIndex].subitems || [])];
    subitems.splice(subIndex, 1);
    currentItems[menuIndex] = { ...currentItems[menuIndex], subitems };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleMoveSubItem = (menuIndex, subIndex, direction) => {
    const currentItems = [...(sections.main_navigation?.content?.items || [])];
    const subitems = [...(currentItems[menuIndex].subitems || [])];
    const targetSubIndex = subIndex + direction;
    if (targetSubIndex < 0 || targetSubIndex >= subitems.length) return;
    const temp = subitems[subIndex];
    subitems[subIndex] = subitems[targetSubIndex];
    subitems[targetSubIndex] = temp;
    currentItems[menuIndex] = { ...currentItems[menuIndex], subitems };
    updateSectionContent('main_navigation', {
      ...sections.main_navigation?.content,
      items: currentItems
    });
  };

  const handleImportCategoriesToSubmenu = async (menuIndex) => {
    try {
      const cats = await getAdminCategories();
      if (Array.isArray(cats) && cats.length > 0) {
        const subitems = [{ label: 'All Collections', url: '/shop' }];
        cats.filter(c => !c.parent_id).forEach(main => {
          subitems.push({
            label: main.name,
            url: `/shop?category=${encodeURIComponent(main.slug || main.name)}`
          });
          const subs = cats.filter(s => s.parent_id === main.id);
          subs.forEach(sub => {
            subitems.push({
              label: `↳ ${sub.name}`,
              url: `/shop?category=${encodeURIComponent(sub.slug || sub.name)}`
            });
          });
        });

        const currentItems = [...(sections.main_navigation?.content?.items || [])];
        currentItems[menuIndex] = {
          ...currentItems[menuIndex],
          has_submenu: true,
          subitems
        };
        updateSectionContent('main_navigation', {
          ...sections.main_navigation?.content,
          items: currentItems
        });
      }
    } catch (e) {
      alert('Could not fetch categories');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Homepage CMS & Section Controls" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Homepage Sections</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Control header navigation menus, banners, tickers, promotional stories, and visibility of all storefront sections.
              </p>
            </div>
            {saveMessage && (
              <div style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                ✓ {saveMessage}
              </div>
            )}
          </div>

          {/* Section Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'main_navigation', label: 'Header Navigation & Menus', icon: 'menu' },
              { id: 'announcement', label: 'Announcement Ticker', icon: 'sparkles' },
              { id: 'hero_carousel', label: 'Hero Carousel', icon: 'banner' },
              { id: 'trust_strip', label: 'Trust Badges', icon: 'shieldCheck' },
              { id: 'editorial_banner', label: 'Editorial Story', icon: 'image' },
              { id: 'benefits_section', label: 'Benefits Grid', icon: 'star' },
              { id: 'newsletter_section', label: 'Newsletter Copy', icon: 'mail' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid var(--brand-red)' : '2px solid transparent',
                  color: activeTab === tab.id ? 'var(--brand-red)' : 'var(--muted)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon name={tab.icon} size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Tab Panel */}
          <div className="stat-card">
            {/* Visibility & Save Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(sections[activeTab]?.is_visible)}
                    onChange={() => toggleVisibility(activeTab)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--brand-green)' }}
                  />
                  <span>Show this section on Storefront</span>
                </label>
                <span className={`badge ${sections[activeTab]?.is_visible ? 'badge-success' : 'badge-warning'}`}>
                  {sections[activeTab]?.is_visible ? 'Visible' : 'Hidden'}
                </span>
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => handleSave(activeTab)}
                disabled={saving}
              >
                <Icon name="check" size={16} />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>

            {/* Header Navigation & Menus Editor */}
            {activeTab === 'main_navigation' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                      Storefront Header Navigation Menus
                    </h3>
                    <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '4px 0 0' }}>
                      Reorder navigation tabs, configure target URLs, and nest dropdown sub-menus with custom order.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={handleAddMenuItem}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                  >
                    <Icon name="plus" size={15} />
                    <span>Add Menu Item</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {(!sections.main_navigation?.content?.items || sections.main_navigation.content.items.length === 0) ? (
                    <div style={{ padding: '36px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '8px', color: 'var(--muted)' }}>
                      No menu items yet. Click &quot;Add Menu Item&quot; to begin building your header navigation.
                    </div>
                  ) : (
                    sections.main_navigation.content.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '16px 20px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        {/* Top-Level Item Header & Ordering Controls */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 700,
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderRadius: '4px'
                              }}
                            >
                              #{idx + 1}
                            </span>
                            <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{item.label || 'Untitled Menu'}</strong>
                            {item.has_submenu && (
                              <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                Dropdown Menu ({item.subitems?.length || 0} items)
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* Reorder Buttons */}
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleMoveMenuItem(idx, -1)}
                              disabled={idx === 0}
                              title="Move Menu Item Up"
                            >
                              <Icon name="chevronUp" size={14} />
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleMoveMenuItem(idx, 1)}
                              disabled={idx === sections.main_navigation.content.items.length - 1}
                              title="Move Menu Item Down"
                            >
                              <Icon name="chevronDown" size={14} />
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ color: '#ef4444', borderColor: '#ef4444', padding: '4px 8px' }}
                              onClick={() => handleDeleteMenuItem(idx)}
                              title="Delete Menu Item"
                            >
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Top-Level Item Inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr auto', gap: '14px', alignItems: 'center' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Menu Label</label>
                            <input
                              type="text"
                              className="form-control"
                              value={item.label || ''}
                              placeholder="e.g. Collections, Shop, About"
                              onChange={(e) => handleUpdateMenuItem(idx, 'label', e.target.value)}
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '12px' }}>Target URL / Route</label>
                            <input
                              type="text"
                              className="form-control"
                              value={item.url || ''}
                              placeholder="e.g. /shop, /about, /blog"
                              onChange={(e) => handleUpdateMenuItem(idx, 'url', e.target.value)}
                            />
                          </div>

                          <div style={{ paddingTop: '22px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(item.has_submenu)}
                                onChange={(e) => handleUpdateMenuItem(idx, 'has_submenu', e.target.checked)}
                                style={{ width: '16px', height: '16px', accentColor: 'var(--brand-green)' }}
                              />
                              <span style={{ fontWeight: 600 }}>Has Sub-menu Dropdown</span>
                            </label>
                          </div>
                        </div>

                        {/* Nested Sub-Menu Section */}
                        {item.has_submenu && (
                          <div style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                              <div>
                                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>Nested Sub-Menu Links</strong>
                                <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>
                                  ({item.subitems?.length || 0} links)
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-outline"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => handleImportCategoriesToSubmenu(idx)}
                                  title="Auto-fill sub-menu from existing store categories"
                                >
                                  <span>Sync Store Categories</span>
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-outline"
                                  style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleAddSubItem(idx)}
                                >
                                  <Icon name="plus" size={12} />
                                  <span>Add Sub Link</span>
                                </button>
                              </div>
                            </div>

                            {(!item.subitems || item.subitems.length === 0) ? (
                              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
                                No sub-menu links added yet. Click &quot;Add Sub Link&quot; or &quot;Sync Store Categories&quot;.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {item.subitems.map((sub, sIdx) => (
                                  <div
                                    key={sub.id || sIdx}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'auto 1.2fr 1.5fr auto',
                                      gap: '8px',
                                      alignItems: 'center',
                                      background: '#ffffff',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, minWidth: '22px' }}>
                                        {idx + 1}.{sIdx + 1}
                                      </span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-outline"
                                          style={{ padding: '1px 4px', fontSize: '10px', height: '16px', lineHeight: '10px' }}
                                          onClick={() => handleMoveSubItem(idx, sIdx, -1)}
                                          disabled={sIdx === 0}
                                          title="Move Sub-menu Up"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-outline"
                                          style={{ padding: '1px 4px', fontSize: '10px', height: '16px', lineHeight: '10px' }}
                                          onClick={() => handleMoveSubItem(idx, sIdx, 1)}
                                          disabled={sIdx === item.subitems.length - 1}
                                          title="Move Sub-menu Down"
                                        >
                                          ▼
                                        </button>
                                      </div>
                                    </div>

                                    <input
                                      type="text"
                                      className="form-control"
                                      style={{ height: '32px', fontSize: '12px' }}
                                      placeholder="Sub Link Title (e.g. Travel Backpacks)"
                                      value={sub.label || ''}
                                      onChange={(e) => handleUpdateSubItem(idx, sIdx, 'label', e.target.value)}
                                    />

                                    <input
                                      type="text"
                                      className="form-control"
                                      style={{ height: '32px', fontSize: '12px' }}
                                      placeholder="Sub Link URL (e.g. /shop?category=travel-backpacks)"
                                      value={sub.url || ''}
                                      onChange={(e) => handleUpdateSubItem(idx, sIdx, 'url', e.target.value)}
                                    />

                                    <button
                                      type="button"
                                      className="admin-btn admin-btn-outline"
                                      style={{ color: '#ef4444', borderColor: '#ef4444', padding: '4px 6px', height: '32px' }}
                                      onClick={() => handleDeleteSubItem(idx, sIdx)}
                                      title="Remove Sub Link"
                                    >
                                      <Icon name="trash" size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Announcement Section Editor */}
            {activeTab === 'announcement' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Marquee Ticker Messages</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(sections.announcement?.content?.items || []).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-control"
                        value={item}
                        onChange={(e) => {
                          const updated = [...(sections.announcement?.content?.items || [])];
                          updated[idx] = e.target.value;
                          updateSectionContent('announcement', { items: updated });
                        }}
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn-outline"
                        style={{ color: 'var(--brand-red)', borderColor: 'var(--brand-red)' }}
                        onClick={() => {
                          const updated = sections.announcement?.content?.items?.filter((_, i) => i !== idx);
                          updateSectionContent('announcement', { items: updated });
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline"
                    style={{ alignSelf: 'flex-start', marginTop: '8px' }}
                    onClick={() => {
                      const updated = [...(sections.announcement?.content?.items || []), 'New announcement text'];
                      updateSectionContent('announcement', { items: updated });
                    }}
                  >
                    <Icon name="plus" size={16} />
                    <span>Add Ticker Item</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hero Carousel Editor */}
            {activeTab === 'hero_carousel' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Hero Slides</h3>
                {(sections.hero_carousel?.content?.slides || []).map((slide, idx) => (
                  <div key={idx} style={{ padding: '18px', border: '1px solid var(--line)', borderRadius: '10px', marginBottom: '16px', background: '#fafbfc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <strong style={{ fontSize: '14px' }}>Slide #{idx + 1}</strong>
                      <button
                        type="button"
                        className="admin-btn admin-btn-outline"
                        style={{ color: 'var(--brand-red)', padding: '4px 8px' }}
                        onClick={() => {
                          const updated = sections.hero_carousel?.content?.slides?.filter((_, i) => i !== idx);
                          updateSectionContent('hero_carousel', { slides: updated });
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Kicker / Eyebrow</label>
                        <input
                          type="text"
                          className="form-control"
                          value={slide.kicker || ''}
                          onChange={(e) => {
                            const updated = [...sections.hero_carousel.content.slides];
                            updated[idx] = { ...updated[idx], kicker: e.target.value };
                            updateSectionContent('hero_carousel', { slides: updated });
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Heading</label>
                        <input
                          type="text"
                          className="form-control"
                          value={slide.heading || ''}
                          onChange={(e) => {
                            const updated = [...sections.hero_carousel.content.slides];
                            updated[idx] = { ...updated[idx], heading: e.target.value };
                            updateSectionContent('hero_carousel', { slides: updated });
                          }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subheading / Lead</label>
                      <input
                        type="text"
                        className="form-control"
                        value={slide.lead || ''}
                        onChange={(e) => {
                          const updated = [...sections.hero_carousel.content.slides];
                          updated[idx] = { ...updated[idx], lead: e.target.value };
                          updateSectionContent('hero_carousel', { slides: updated });
                        }}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Primary Button Text</label>
                        <input
                          type="text"
                          className="form-control"
                          value={slide.primaryText || ''}
                          onChange={(e) => {
                            const updated = [...sections.hero_carousel.content.slides];
                            updated[idx] = { ...updated[idx], primaryText: e.target.value };
                            updateSectionContent('hero_carousel', { slides: updated });
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Primary Button URL</label>
                        <input
                          type="text"
                          className="form-control"
                          value={slide.primaryUrl || ''}
                          onChange={(e) => {
                            const updated = [...sections.hero_carousel.content.slides];
                            updated[idx] = { ...updated[idx], primaryUrl: e.target.value };
                            updateSectionContent('hero_carousel', { slides: updated });
                          }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Background / Banner Image URL</label>
                      <input
                        type="text"
                        className="form-control"
                        value={slide.image || ''}
                        placeholder="https://... or uploaded image URL"
                        onChange={(e) => {
                          const updated = [...sections.hero_carousel.content.slides];
                          updated[idx] = { ...updated[idx], image: e.target.value };
                          updateSectionContent('hero_carousel', { slides: updated });
                        }}
                      />
                    </div>
                    <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px', color: '#166534', marginTop: '8px' }}>
                      💡 <strong>Clean Graphic Banner Tip:</strong> If Kicker, Heading, Subheading, and Button text are left blank, the storefront automatically renders your pure original image with <em>no color overlay</em>, linking directly to the Primary Button URL / Target URL.
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => {
                    const newSlide = {
                      kicker: 'New Collection',
                      heading: 'Crafted For Life',
                      lead: 'Versatile essentials for work and travel.',
                      primaryText: 'Shop Now',
                      primaryUrl: '/shop',
                      image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1600&q=85'
                    };
                    const updated = [...(sections.hero_carousel?.content?.slides || []), newSlide];
                    updateSectionContent('hero_carousel', { slides: updated });
                  }}
                >
                  <Icon name="plus" size={16} />
                  <span>Add Slide</span>
                </button>
              </div>
            )}

            {/* Trust Strip Editor */}
            {activeTab === 'trust_strip' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>4 Value Proposition Badges</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {(sections.trust_strip?.content?.items || []).map((item, idx) => (
                    <div key={idx} style={{ padding: '16px', border: '1px solid var(--line)', borderRadius: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Badge #{idx + 1} Title</label>
                        <input
                          type="text"
                          className="form-control"
                          value={item.title || ''}
                          onChange={(e) => {
                            const updated = [...sections.trust_strip.content.items];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            updateSectionContent('trust_strip', { items: updated });
                          }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Subtitle</label>
                        <input
                          type="text"
                          className="form-control"
                          value={item.subtitle || ''}
                          onChange={(e) => {
                            const updated = [...sections.trust_strip.content.items];
                            updated[idx] = { ...updated[idx], subtitle: e.target.value };
                            updateSectionContent('trust_strip', { items: updated });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editorial Banner */}
            {activeTab === 'editorial_banner' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Editorial Brand Story</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Eyebrow</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.editorial_banner?.content?.eyebrow || ''}
                      onChange={(e) => updateSectionContent('editorial_banner', { ...sections.editorial_banner.content, eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heading</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.editorial_banner?.content?.heading || ''}
                      onChange={(e) => updateSectionContent('editorial_banner', { ...sections.editorial_banner.content, heading: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Story Paragraph</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    value={sections.editorial_banner?.content?.body || ''}
                    onChange={(e) => updateSectionContent('editorial_banner', { ...sections.editorial_banner.content, body: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Button Text</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.editorial_banner?.content?.buttonText || ''}
                      onChange={(e) => updateSectionContent('editorial_banner', { ...sections.editorial_banner.content, buttonText: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Image URL</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.editorial_banner?.content?.image || ''}
                      onChange={(e) => updateSectionContent('editorial_banner', { ...sections.editorial_banner.content, image: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Benefits Section */}
            {activeTab === 'benefits_section' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Benefits Highlights</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Section Eyebrow</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.benefits_section?.content?.eyebrow || ''}
                      onChange={(e) => updateSectionContent('benefits_section', { ...sections.benefits_section.content, eyebrow: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section Heading</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sections.benefits_section?.content?.heading || ''}
                      onChange={(e) => updateSectionContent('benefits_section', { ...sections.benefits_section.content, heading: e.target.value })}
                    />
                  </div>
                </div>
                {(sections.benefits_section?.content?.items || []).map((item, idx) => (
                  <div key={idx} style={{ padding: '14px', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Benefit #{idx + 1} Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={item.title || ''}
                        onChange={(e) => {
                          const updated = [...sections.benefits_section.content.items];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          updateSectionContent('benefits_section', { ...sections.benefits_section.content, items: updated });
                        }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Description</label>
                      <input
                        type="text"
                        className="form-control"
                        value={item.description || ''}
                        onChange={(e) => {
                          const updated = [...sections.benefits_section.content.items];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          updateSectionContent('benefits_section', { ...sections.benefits_section.content, items: updated });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Newsletter Section */}
            {activeTab === 'newsletter_section' && (
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Newsletter Subscription Copy</h3>
                <div className="form-group">
                  <label className="form-label">Callout Heading</label>
                  <input
                    type="text"
                    className="form-control"
                    value={sections.newsletter_section?.content?.heading || ''}
                    onChange={(e) => updateSectionContent('newsletter_section', { ...sections.newsletter_section.content, heading: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description Body</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={sections.newsletter_section?.content?.body || ''}
                    onChange={(e) => updateSectionContent('newsletter_section', { ...sections.newsletter_section.content, body: e.target.value })}
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

