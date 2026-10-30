'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { ImageUploader } from '../../components/ImageUploader';
import { Icon } from '../../components/Icons';
import { getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../../lib/api';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parent_id: '',
    gender: 'all',
    description: '',
    display_order: 0,
    image: null
  });
  const [saving, setSaving] = useState(false);
  const [genderFilter, setGenderFilter] = useState('all'); // 'all', 'women', 'men', 'kids', 'unisex'
  const [levelFilter, setLevelFilter] = useState('all'); // 'all', 'with_sub', 'no_sub'
  const [categorySort, setCategorySort] = useState('order'); // 'order', 'name_asc', 'sub_count'

  const loadCategories = () => {
    getAdminCategories()
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = (parentId = '') => {
    setEditingCategory(null);
    const parentCat = categories.find(c => String(c.id) === String(parentId));
    const defaultGender = parentCat?.gender || (genderFilter !== 'all' ? genderFilter : 'all');

    setFormData({
      name: '',
      slug: '',
      parent_id: parentId ? String(parentId) : '',
      gender: defaultGender,
      description: '',
      display_order: 0,
      image: null
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      parent_id: cat.parent_id ? String(cat.parent_id) : '',
      gender: cat.gender || 'all',
      description: cat.description || '',
      display_order: cat.display_order ?? 0,
      image: null
    });
    setIsModalOpen(true);
  };

  // Helper to auto-generate slug from current category name
  const generateSlugFromName = () => {
    if (!formData.name) return;
    const cleanSlug = formData.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setFormData(prev => ({ ...prev, slug: cleanSlug }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('slug', formData.slug);
      data.append('parent_id', formData.parent_id ? formData.parent_id : '');
      data.append('gender', formData.gender || 'all');
      data.append('description', formData.description || '');
      data.append('display_order', formData.display_order);
      if (formData.image) {
        data.append('image', formData.image);
      }

      if (editingCategory) {
        await updateAdminCategory(editingCategory.id, data);
      } else {
        await createAdminCategory(data);
      }

      setIsModalOpen(false);
      setFormData({ name: '', slug: '', parent_id: '', gender: 'all', description: '', display_order: 0, image: null });
      loadCategories();
    } catch (err) {
      alert(err.message || 'Error saving category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Any subcategories will become top-level.`)) return;
    try {
      await deleteAdminCategory(id);
      loadCategories();
    } catch (err) {
      alert(err.message || 'Error deleting category');
    }
  };

  // State for expanded accordion category IDs
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [categorySearch, setCategorySearch] = useState('');

  // Top level categories
  const topLevelCategories = categories.filter(c => !c.parent_id && (!editingCategory || c.id !== editingCategory.id));
  const mainCategories = categories.filter(c => !c.parent_id);

  // Initialize all main categories expanded on first load
  useEffect(() => {
    if (categories.length > 0 && expandedIds.size === 0) {
      const allMainIds = new Set(categories.filter(c => !c.parent_id).map(c => c.id));
      setExpandedIds(allMainIds);
    }
  }, [categories]);

  const toggleAccordion = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(mainCategories.map(c => c.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  // Helper badge renderer for Gender / Department
  const renderGenderBadge = (g) => {
    const val = (g || 'all').toLowerCase();
    if (val === 'women') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#fce7f3', color: '#be185d' }}>
          👩 Women
        </span>
      );
    }
    if (val === 'men') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1' }}>
          👤 Men
        </span>
      );
    }
    if (val === 'kids') {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#fef3c7', color: '#b45309' }}>
          🧒 Kids
        </span>
      );
    }
    return (
      <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b' }}>
        🌐 Unisex
      </span>
    );
  };

  // Department counts
  const womenCount = categories.filter(c => (c.gender || '').toLowerCase() === 'women').length;
  const menCount = categories.filter(c => (c.gender || '').toLowerCase() === 'men').length;
  const kidsCount = categories.filter(c => (c.gender || '').toLowerCase() === 'kids').length;
  const unisexCount = categories.filter(c => {
    const g = (c.gender || 'all').toLowerCase();
    return g === 'all' || g === 'unisex';
  }).length;
  const totalSubcategoriesCount = categories.filter(c => Boolean(c.parent_id)).length;

  // Filtered categories according to gender filter, level filter, search query, and sorting
  const filteredMainCategories = mainCategories.filter(main => {
    const subcats = categories.filter(c => c.parent_id === main.id);

    // 1. Department / Gender filter
    if (genderFilter !== 'all') {
      if (genderFilter === 'unisex') {
        const isMainUnisex = (main.gender || 'all').toLowerCase() === 'all' || (main.gender || '').toLowerCase() === 'unisex';
        const isSubUnisex = subcats.some(s => (s.gender || 'all').toLowerCase() === 'all' || (s.gender || '').toLowerCase() === 'unisex');
        if (!isMainUnisex && !isSubUnisex) return false;
      } else {
        const matchesMainGender = (main.gender || 'all').toLowerCase() === genderFilter;
        const matchesSubGender = subcats.some(s => (s.gender || 'all').toLowerCase() === genderFilter);
        if (!matchesMainGender && !matchesSubGender) return false;
      }
    }

    // 2. Hierarchy Level Filter
    if (levelFilter === 'with_sub' && subcats.length === 0) return false;
    if (levelFilter === 'no_sub' && subcats.length > 0) return false;

    // 3. Search text query
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase();
    const matchesMain = main.name.toLowerCase().includes(q) || (main.slug && main.slug.toLowerCase().includes(q));
    const matchesSub = subcats.some(s => s.name.toLowerCase().includes(q) || (s.slug && s.slug.toLowerCase().includes(q)));
    return matchesMain || matchesSub;
  }).sort((a, b) => {
    if (categorySort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (categorySort === 'sub_count') {
      const subsA = categories.filter(c => c.parent_id === a.id).length;
      const subsB = categories.filter(c => c.parent_id === b.id).length;
      return subsB - subsA;
    }
    // Default display order
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  const hasCategoryFilters = Boolean(
    categorySearch.trim() ||
    genderFilter !== 'all' ||
    levelFilter !== 'all' ||
    categorySort !== 'order'
  );

  const handleClearCategoryFilters = () => {
    setCategorySearch('');
    setGenderFilter('all');
    setLevelFilter('all');
    setCategorySort('order');
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Collections & Categories" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Product Categories &amp; Taxonomy</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Organize main categories, subcategories, and departments (Women, Men, Kids) for storefront navigation and dedicated department hubs.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/banners"
                className="admin-btn admin-btn-outline"
                style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span>🖼️ Category Page Banners</span>
              </Link>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={expandedIds.size === mainCategories.length ? handleCollapseAll : handleExpandAll}
                style={{ fontSize: '13px' }}
              >
                {expandedIds.size === mainCategories.length ? 'Collapse All' : 'Expand All'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => openAddModal()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Icon name="plus" size={16} />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Department Filter Tabs (All, Women, Men, Kids, Unisex) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Categories', count: categories.length },
              { id: 'women', label: '👩 Women', count: womenCount },
              { id: 'men', label: '👤 Men', count: menCount },
              { id: 'kids', label: '🧒 Kids', count: kidsCount },
              { id: 'unisex', label: '🌐 Unisex', count: unisexCount }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGenderFilter(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12.5px',
                  fontWeight: genderFilter === tab.id ? 700 : 500,
                  border: genderFilter === tab.id ? '1.5px solid var(--ink, #111)' : '1px solid #e2e8f0',
                  background: genderFilter === tab.id ? 'var(--ink, #111)' : '#ffffff',
                  color: genderFilter === tab.id ? '#ffffff' : '#4b5563',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: genderFilter === tab.id ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    color: genderFilter === tab.id ? '#ffffff' : '#64748b'
                  }}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Category Filter and Search Toolbar */}
          <div className="admin-card" style={{ padding: '14px 18px', marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'center' }}>
              {/* Search bar */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search categories or subcategories..."
                  className="form-control"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ paddingLeft: '34px', fontSize: '13px', height: '38px', background: '#ffffff' }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Icon name="search" size={15} />
                </span>
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Hierarchy / Level Filter */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer' }}
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                >
                  <option value="all">📂 Hierarchy: All Levels ({mainCategories.length} Main, {totalSubcategoriesCount} Subs)</option>
                  <option value="with_sub">📂 Has Subcategories Only</option>
                  <option value="no_sub">📄 Standalone Categories (No Subcategories)</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer' }}
                  value={categorySort}
                  onChange={(e) => setCategorySort(e.target.value)}
                >
                  <option value="order">↕️ Sort: Custom Display Order</option>
                  <option value="name_asc">Name: A → Z</option>
                  <option value="sub_count">Most Subcategories First</option>
                </select>
              </div>
            </div>

            {/* Active Filters Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Showing <strong>{filteredMainCategories.length}</strong> of {mainCategories.length} main categories ({categories.length} total categories)</span>
                {genderFilter !== 'all' && (
                  <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Dept: {genderFilter}
                    <button type="button" onClick={() => setGenderFilter('all')} style={{ border: 'none', background: 'none', color: '#9d174d', cursor: 'pointer', padding: 0 }}>✕</button>
                  </span>
                )}
                {levelFilter !== 'all' && (
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Level: {levelFilter.replace('_', ' ')}
                    <button type="button" onClick={() => setLevelFilter('all')} style={{ border: 'none', background: 'none', color: '#1e40af', cursor: 'pointer', padding: 0 }}>✕</button>
                  </span>
                )}
              </div>

              {hasCategoryFilters && (
                <button
                  type="button"
                  onClick={handleClearCategoryFilters}
                  style={{
                    fontSize: '12px',
                    color: '#ef4444',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✕ Reset All Filters
                </button>
              )}
            </div>
          </div>

          {/* Categories Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredMainCategories.length === 0 ? (
              <div className="stat-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                <Icon name="grid" size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ margin: 0 }}>No categories found matching your search or department filter.</p>
              </div>
            ) : (
              filteredMainCategories.map(mainCat => {
                const subcategories = categories
                  .filter(c => c.parent_id === mainCat.id)
                  .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
                const isExpanded = expandedIds.has(mainCat.id);

                return (
                  <div
                    key={mainCat.id}
                    style={{
                      background: '#fff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                  >
                    {/* Accordion Header */}
                    <div
                      onClick={() => toggleAccordion(mainCat.id)}
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExpanded ? '#fafafa' : '#ffffff',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                        <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s' }}>
                          <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={18} />
                        </span>

                        {/* Thumbnail */}
                        <div style={{ width: '42px', height: '42px', borderRadius: '6px', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                          {mainCat.image ? (
                            <img src={mainCat.image} alt={mainCat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              <Icon name="grid" size={20} />
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{mainCat.name}</strong>
                            <code style={{ fontSize: '11px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>
                              /{mainCat.slug}
                            </code>
                            {renderGenderBadge(mainCat.gender)}
                          </div>
                          {mainCat.description && (
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px', maxWidth: '450px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mainCat.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Meta & Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        {/* Subcategory count badge */}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: subcategories.length > 0 ? '#e0f2fe' : '#f1f5f9',
                            color: subcategories.length > 0 ? '#0369a1' : '#64748b'
                          }}
                        >
                          {subcategories.length} {subcategories.length === 1 ? 'Subcategory' : 'Subcategories'}
                        </span>

                        {/* Products count */}
                        <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          <strong>{mainCat.product_count || 0}</strong> products
                        </span>

                        {/* Order */}
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Order: {mainCat.display_order ?? 0}
                        </span>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                            onClick={() => openAddModal(mainCat.id)}
                            title="Add subcategory under this category"
                          >
                            <Icon name="plus" size={13} />
                            <span>Add Sub</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                            onClick={() => openEditModal(mainCat)}
                            title="Edit Category"
                          >
                            <Icon name="edit" size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                            onClick={() => handleDelete(mainCat.id, mainCat.name)}
                            title="Delete Category"
                          >
                            <Icon name="trash" size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Subcategories Panel */}
                    {isExpanded && (
                      <div style={{ background: '#f8fafc', padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
                        {subcategories.length === 0 ? (
                          <div
                            style={{
                              padding: '24px',
                              textAlign: 'center',
                              background: '#ffffff',
                              border: '1px dashed #cbd5e1',
                              borderRadius: '8px'
                            }}
                          >
                            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--muted)' }}>
                              No subcategories created under <strong>{mainCat.name}</strong> yet.
                            </p>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => openAddModal(mainCat.id)}
                            >
                              <Icon name="plus" size={12} />
                              <span>Create First Subcategory</span>
                            </button>
                          </div>
                        ) : (
                          <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            <table className="admin-table" style={{ margin: 0 }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ width: '40px', fontSize: '11px' }}>Cover</th>
                                  <th style={{ fontSize: '11px' }}>Subcategory Name</th>
                                  <th style={{ fontSize: '11px' }}>Slug</th>
                                  <th style={{ fontSize: '11px' }}>Department</th>
                                  <th style={{ fontSize: '11px' }}>Products</th>
                                  <th style={{ fontSize: '11px' }}>Order</th>
                                  <th style={{ fontSize: '11px' }}>Status</th>
                                  <th style={{ textAlign: 'right', fontSize: '11px' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subcategories.map(sub => (
                                  <tr key={sub.id}>
                                    <td style={{ width: '48px' }}>
                                      <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', background: '#f8fafc' }}>
                                        {sub.image ? (
                                          <img src={sub.image} alt={sub.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                            <Icon name="grid" size={16} />
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#0284c7', fontWeight: 700, fontSize: '14px' }}>↳</span>
                                        <div>
                                          <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{sub.name}</strong>
                                          {sub.description && (
                                            <div style={{ fontSize: '11px', color: 'var(--muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {sub.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <code style={{ fontSize: '11px', color: '#475569' }}>{sub.slug}</code>
                                    </td>
                                    <td>
                                      {renderGenderBadge(sub.gender)}
                                    </td>
                                    <td>
                                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{sub.product_count || 0}</span>
                                    </td>
                                    <td>
                                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{sub.display_order ?? 0}</span>
                                    </td>
                                    <td>
                                      <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>Active</span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-outline"
                                          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '5px' }}
                                          onClick={() => openEditModal(sub)}
                                          title="Edit Subcategory"
                                        >
                                          <Icon name="edit" size={12} />
                                          <span>Edit</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-danger"
                                          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '5px' }}
                                          onClick={() => handleDelete(sub.id, sub.name)}
                                          title="Delete Subcategory"
                                        >
                                          <Icon name="trash" size={12} />
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add / Edit Category Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingCategory ? `Edit Category: ${editingCategory.name}` : 'Add New Category'}
          >
            <form onSubmit={handleSubmit}>
              {/* Parent Category Selector */}
              <div className="form-group">
                <label className="form-label">Category Hierarchy (Parent Category)</label>
                <select
                  className="form-control"
                  value={formData.parent_id}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const parentCat = categories.find(c => String(c.id) === String(pid));
                    setFormData(prev => ({
                      ...prev,
                      parent_id: pid,
                      gender: parentCat?.gender || prev.gender
                    }));
                  }}
                >
                  <option value="">-- None (Top-Level Main Category) --</option>
                  {topLevelCategories.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      Subcategory of: {parent.name} ({parent.gender || 'all'})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                  Choose &quot;None&quot; for a primary category (e.g. Handbags, Accessories), or select a parent category to create a subcategory (e.g. Tote Bags under Handbags).
                </span>
              </div>

              {/* Target Department / Gender */}
              <div className="form-group">
                <label className="form-label">Department / Target Audience *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '6px' }}>
                  {[
                    { id: 'women', label: '👩 Women', desc: 'Handbags, Totes, Slings' },
                    { id: 'men', label: '👤 Men', desc: 'Wallets, Backpacks, Belts' },
                    { id: 'kids', label: '🧒 Kids', desc: 'School Bags, Mini Pouches' },
                    { id: 'all', label: '🌐 All / Unisex', desc: 'Common Collections' }
                  ].map(g => (
                    <label
                      key={g.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10px 8px',
                        borderRadius: '8px',
                        border: formData.gender === g.id ? '2px solid var(--brand-red, #c8102e)' : '1px solid #e2e8f0',
                        background: formData.gender === g.id ? 'rgba(200, 16, 46, 0.05)' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="radio"
                        name="category-gender"
                        value={g.id}
                        checked={formData.gender === g.id}
                        onChange={() => setFormData({ ...formData, gender: g.id })}
                        style={{ display: 'none' }}
                      />
                      <span style={{ fontWeight: '700', fontSize: '13px', color: formData.gender === g.id ? 'var(--brand-red, #c8102e)' : '#111827' }}>
                        {g.label}
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '3px' }}>
                        {g.desc}
                      </span>
                    </label>
                  ))}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                  Assigning to Women, Men, or Kids enables dedicated department hubs at <code>/womens</code>, <code>/mens</code>, or <code>/kids</code>.
                </span>
              </div>

              {/* Category Name */}
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tote Bags"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const newForm = { ...formData, name };
                    if (!editingCategory) {
                      newForm.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    }
                    setFormData(newForm);
                  }}
                  required
                />
              </div>

              {/* Slug with Auto-Generate Button */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Slug (URL Handle) *</label>
                  <button
                    type="button"
                    onClick={generateSlugFromName}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      padding: '3px 9px',
                      color: '#1e293b',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Auto-generate slug from Category Name"
                  >
                    <span>⚡ Auto-Generate from Name</span>
                  </button>
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. tote-bags"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                  URL preview: <code>npgrand.com/shop?category={formData.slug || 'category-slug'}</code>
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Brief description of products in this category..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                />
              </div>

              <ImageUploader
                label="Category Cover Image (Saved to Cloudflare R2)"
                currentImage={editingCategory?.image}
                onFileSelect={(file) => setFormData({ ...formData, image: file })}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={saving}
                >
                  <Icon name="check" size={16} />
                  <span>{saving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}</span>
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  );
}
