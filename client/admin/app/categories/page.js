'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { ImageUploader } from '../../components/ImageUploader';
import { Icon } from '../../components/Icons';
import { getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../../lib/api';

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    parent_id: '',
    gender: '',
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
    const defaultGender = parentCat?.gender || (genderFilter === 'unisex' ? 'all' : genderFilter !== 'all' ? genderFilter : '');

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
      gender: cat.gender || '',
      description: cat.description || '',
      display_order: cat.display_order ?? 0,
      image: null
    });
    setIsModalOpen(true);
  };

  // Open the Add Product screen with this category preselected
  const goAddProduct = (categoryId) => {
    router.push(`/products?add=1&category_id=${categoryId}`);
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
      data.append('gender', formData.gender || 'none');
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
      setFormData({ name: '', slug: '', parent_id: '', gender: '', description: '', display_order: 0, image: null });
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
  const mainCategories = categories.filter(c => !c.parent_id);

  // Build a parent -> children map so the hierarchy can be traversed to any depth
  const childrenByParent = (() => {
    const map = new Map();
    categories.forEach(c => {
      const key = c.parent_id ? String(c.parent_id) : 'root';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    map.forEach(list => list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
    return map;
  })();

  const getChildren = (parentId) =>
    childrenByParent.get(parentId === null || parentId === undefined || parentId === '' ? 'root' : String(parentId)) || [];

  // Flatten all descendants of a category with their depth level (supports unlimited nesting)
  const flattenDescendants = (parentId, depth = 0) => {
    const out = [];
    getChildren(parentId).forEach(child => {
      out.push({ cat: child, depth });
      out.push(...flattenDescendants(child.id, depth + 1));
    });
    return out;
  };

  const collectDescendantIds = (rootId) => {
    const ids = new Set();
    const walk = (pid) => {
      getChildren(pid).forEach(child => {
        if (ids.has(child.id)) return;
        ids.add(child.id);
        walk(child.id);
      });
    };
    walk(rootId);
    return ids;
  };

  // Parent options for the modal — any category can be a parent, but exclude itself and its descendants
  const parentOptions = (() => {
    const options = [];
    const excluded = editingCategory ? collectDescendantIds(editingCategory.id) : new Set();
    const walk = (parentId, depth) => {
      getChildren(parentId).forEach(cat => {
        if (editingCategory && (cat.id === editingCategory.id || excluded.has(cat.id))) return;
        options.push({ cat, depth });
        walk(cat.id, depth + 1);
      });
    };
    walk(null, 0);
    return options;
  })();

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

  // Helper badge renderer for Gender / Department (supports multiple selected departments)
  const parseDepartments = (g) => {
    if (!g) return [];
    if (Array.isArray(g)) return g;
    return String(g).split(',').map(s => s.trim().toLowerCase()).filter(s => s && s !== 'none');
  };

  const normalizeGender = (g) => {
    const depts = parseDepartments(g);
    return depts.length > 0 ? depts[0] : 'none';
  };

  const deptBadgeThemes = {
    women: { label: '👩 Women', bg: '#fce7f3', color: '#be185d' },
    men: { label: '👤 Men', bg: '#e0f2fe', color: '#0369a1' },
    kids: { label: '🧒 Kids', bg: '#fef3c7', color: '#b45309' },
    boys: { label: '👦 Boys', bg: '#dbeafe', color: '#1d4ed8' },
    girls: { label: '👧 Girls', bg: '#fce7f3', color: '#be185d' },
    all: { label: '🌐 All / Unisex', bg: '#f1f5f9', color: '#475569' },
    unisex: { label: '🌐 Unisex', bg: '#f1f5f9', color: '#475569' }
  };

  const renderGenderBadge = (g) => {
    const depts = parseDepartments(g);
    if (!depts.length) {
      return (
        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
          🚫 No Department
        </span>
      );
    }
    return (
      <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {depts.map(d => {
          const theme = deptBadgeThemes[d] || { label: d, bg: '#f1f5f9', color: '#475569' };
          return (
            <span key={d} style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: theme.bg, color: theme.color }}>
              {theme.label}
            </span>
          );
        })}
      </div>
    );
  };

  // Visual level styling so a direct child is clearly distinct from deeper sub-items
  const getCategoryLevelStyle = (depth) => {
    if (depth === 0) {
      return { label: 'CHILD', badgeBg: '#bfdbfe', badgeColor: '#1e40af', accent: '#2563eb', rowBg: '#dbeafe', indent: '#1d4ed8' };
    }
    if (depth === 1) {
      return { label: 'SUB-ITEM', badgeBg: '#d8b4fe', badgeColor: '#6b21a8', accent: '#7e22ce', rowBg: '#e9d5ff', indent: '#6b21a8' };
    }
    return { label: `SUB-ITEM L${depth + 2}`, badgeBg: '#fbbf24', badgeColor: '#78350f', accent: '#d97706', rowBg: '#fde68a', indent: '#92400e' };
  };

  // Department counts
  const womenCount = categories.filter(c => parseDepartments(c.gender).includes('women') || parseDepartments(c.gender).includes('all')).length;
  const menCount = categories.filter(c => parseDepartments(c.gender).includes('men') || parseDepartments(c.gender).includes('all')).length;
  const kidsCount = categories.filter(c => parseDepartments(c.gender).includes('kids') || parseDepartments(c.gender).includes('all')).length;
  const boysCount = categories.filter(c => parseDepartments(c.gender).includes('boys') || parseDepartments(c.gender).includes('all')).length;
  const girlsCount = categories.filter(c => parseDepartments(c.gender).includes('girls') || parseDepartments(c.gender).includes('all')).length;
  const unisexCount = categories.filter(c => parseDepartments(c.gender).some(x => ['all', 'unisex'].includes(x))).length;
  const noneCount = categories.filter(c => parseDepartments(c.gender).length === 0).length;
  const totalSubcategoriesCount = categories.filter(c => Boolean(c.parent_id)).length;

  // Filtered categories according to gender filter, level filter, search query, and sorting
  const filteredMainCategories = mainCategories.filter(main => {
    const descendants = flattenDescendants(main.id).map(d => d.cat);

    // 1. Department / Gender filter (supports multiple assigned departments)
    if (genderFilter !== 'all') {
      if (genderFilter === 'unisex') {
        const isMainUnisex = parseDepartments(main.gender).some(x => ['all', 'unisex'].includes(x));
        const isSubUnisex = descendants.some(s => parseDepartments(s.gender).some(x => ['all', 'unisex'].includes(x)));
        if (!isMainUnisex && !isSubUnisex) return false;
      } else {
        const matchesMainGender = parseDepartments(main.gender).includes(genderFilter) || parseDepartments(main.gender).includes('all');
        const matchesSubGender = descendants.some(s => parseDepartments(s.gender).includes(genderFilter) || parseDepartments(s.gender).includes('all'));
        if (!matchesMainGender && !matchesSubGender) return false;
      }
    }

    // 2. Hierarchy Level Filter
    if (levelFilter === 'with_sub' && descendants.length === 0) return false;
    if (levelFilter === 'no_sub' && descendants.length > 0) return false;

    // 3. Search text query
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase();
    const matchesMain = main.name.toLowerCase().includes(q) || (main.slug && main.slug.toLowerCase().includes(q));
    const matchesSub = descendants.some(s => s.name.toLowerCase().includes(q) || (s.slug && s.slug.toLowerCase().includes(q)));
    return matchesMain || matchesSub;
  }).sort((a, b) => {
    if (categorySort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
    if (categorySort === 'sub_count') {
      const subsA = flattenDescendants(a.id).length;
      const subsB = flattenDescendants(b.id).length;
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

          {/* Department Filter Tabs (All, Women, Men, Boys, Girls, Kids, Unisex) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Categories', count: categories.length },
              { id: 'women', label: '👩 Women', count: womenCount },
              { id: 'men', label: '👤 Men', count: menCount },
              { id: 'boys', label: '👦 Boys', count: boysCount },
              { id: 'girls', label: '👧 Girls', count: girlsCount },
              { id: 'kids', label: '🧒 Kids', count: kidsCount },
              { id: 'unisex', label: '🌐 Unisex', count: unisexCount },
              { id: 'none', label: '🚫 No Department', count: noneCount }
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
                    Dept: {genderFilter === 'none' ? 'No Department' : genderFilter === 'unisex' ? 'Unisex' : genderFilter}
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
                const descendants = flattenDescendants(mainCat.id);
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
                            background: descendants.length > 0 ? '#e0f2fe' : '#f1f5f9',
                            color: descendants.length > 0 ? '#0369a1' : '#64748b'
                          }}
                        >
                          {descendants.length} {descendants.length === 1 ? 'Sub-item' : 'Sub-items'}
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
                            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', color: '#065935', borderColor: '#86efac', background: '#f0fdf4' }}
                            onClick={() => goAddProduct(mainCat.id)}
                            title="Add a new product in this category"
                          >
                            <Icon name="plus" size={13} />
                            <span>Add Product</span>
                          </button>
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
                        {descendants.length === 0 ? (
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
                              No sub-items created under <strong>{mainCat.name}</strong> yet.
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
                                {descendants.map(({ cat: sub, depth }) => {
                                  const level = getCategoryLevelStyle(depth);
                                  return (
                                  <tr key={sub.id} style={{ background: level.rowBg }}>
                                    <td style={{ width: '48px', borderLeft: `4px solid ${level.accent}` }}>
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
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: `${depth * 20}px` }}>
                                        <span style={{ color: level.indent, fontWeight: 700, fontSize: '14px' }}>↳</span>
                                        <div>
                                          <span style={{ fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.3px', padding: '2px 6px', borderRadius: '4px', background: level.badgeBg, color: level.badgeColor, marginRight: '6px' }}>
                                            {level.label}
                                          </span>
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
                                          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '5px', color: '#065935', borderColor: '#86efac', background: '#f0fdf4' }}
                                          onClick={() => goAddProduct(sub.id)}
                                          title="Add a new product in this category"
                                        >
                                          <Icon name="plus" size={12} />
                                          <span>Add Product</span>
                                        </button>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-outline"
                                          style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '5px' }}
                                          onClick={() => openAddModal(sub.id)}
                                          title="Add a sub-item inside this subcategory"
                                        >
                                          <Icon name="plus" size={12} />
                                          <span>Add Sub</span>
                                        </button>
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
                                  );
                                })}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Category Hierarchy (Parent Category) — Optional</label>
                  {formData.parent_id ? (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, parent_id: '' }))}
                      style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
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
                  {parentOptions.map(({ cat: parent, depth }) => (
                    <option key={parent.id} value={parent.id}>
                      {depth > 0 ? `${'— '.repeat(depth)}Sub-item of: ` : 'Subcategory of: '}
                      {parent.name} ({parent.gender || 'all'})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                  Optional. Choose &quot;None&quot; for a primary category, or select any category/sub-item as the parent to nest deeper (e.g. Handbags → Tote Bags → Canvas Totes).
                </span>
              </div>

              {/* Target Department / Gender (Multiple Selection) */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Departments / Target Audience (Multiple Select Allowed)
                  </label>
                  {parseDepartments(formData.gender).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender: '' }))}
                      style={{ background: 'none', border: 'none', color: '#c8102e', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                  {[
                    { id: 'women', label: '👩 Women', desc: 'Handbags, Totes, Slings' },
                    { id: 'men', label: '👤 Men', desc: 'Wallets, Backpacks, Belts' },
                    { id: 'boys', label: '👦 Boys', desc: 'Backpacks, Wallets, Belts' },
                    { id: 'girls', label: '👧 Girls', desc: 'Handbags, Pouches, Charms' },
                    { id: 'kids', label: '🧒 Kids', desc: 'School Bags, Mini Pouches' },
                    { id: 'all', label: '🌐 All / Unisex', desc: 'Common Collections' }
                  ].map(g => {
                    const selectedList = parseDepartments(formData.gender);
                    const isSelected = selectedList.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        onClick={() => {
                          let next;
                          if (g.id === 'all') {
                            next = isSelected ? [] : ['all'];
                          } else {
                            const withoutAll = selectedList.filter(x => x !== 'all');
                            if (isSelected) {
                              next = withoutAll.filter(x => x !== g.id);
                            } else {
                              next = [...withoutAll, g.id];
                            }
                          }
                          setFormData(prev => ({ ...prev, gender: next.join(',') }));
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '10px 8px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid var(--brand-red, #c8102e)' : '1px solid #e2e8f0',
                          background: isSelected ? 'rgba(200, 16, 46, 0.05)' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'center',
                          position: 'relative',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            border: isSelected ? '1px solid #c8102e' : '1px solid #cbd5e1',
                            background: isSelected ? '#c8102e' : '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 900
                          }}>
                            {isSelected ? '✓' : ''}
                          </span>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: isSelected ? 'var(--brand-red, #c8102e)' : '#111827' }}>
                            {g.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '3px' }}>
                          {g.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                  Multiple departments can be selected. Selected categories appear across all chosen department hubs (e.g. <code>/womens</code>, <code>/mens</code>, <code>/boys</code>, <code>/girls</code>, or <code>/kids</code>).
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
