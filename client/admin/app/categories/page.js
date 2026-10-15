'use client';

import React, { useState, useEffect } from 'react';
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
    description: '',
    display_order: 0,
    image: null
  });
  const [saving, setSaving] = useState(false);

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
    setFormData({
      name: '',
      slug: '',
      parent_id: parentId ? String(parentId) : '',
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
      description: cat.description || '',
      display_order: cat.display_order ?? 0,
      image: null
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('slug', formData.slug);
      data.append('parent_id', formData.parent_id ? formData.parent_id : '');
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
      setFormData({ name: '', slug: '', parent_id: '', description: '', display_order: 0, image: null });
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

  // Filtered categories
  const filteredMainCategories = mainCategories.filter(main => {
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase();
    const matchesMain = main.name.toLowerCase().includes(q) || (main.slug && main.slug.toLowerCase().includes(q));
    const subcats = categories.filter(c => c.parent_id === main.id);
    const matchesSub = subcats.some(s => s.name.toLowerCase().includes(q) || (s.slug && s.slug.toLowerCase().includes(q)));
    return matchesMain || matchesSub;
  });

  // Orphaned subcategories
  const orphanedSubcategories = categories.filter(c => c.parent_id && !mainCategories.some(m => m.id === c.parent_id));

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Collections & Categories" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Product Categories & Subcategories</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Organize main categories and subcategories in an accordion structure for storefront navigation and catalog hierarchy.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
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

          {/* Search bar */}
          <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search categories or subcategories..."
                className="form-control"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
                <Icon name="search" size={16} />
              </span>
            </div>
          </div>

          {/* Categories Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredMainCategories.length === 0 ? (
              <div className="stat-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
                <Icon name="grid" size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p style={{ margin: 0 }}>No categories found matching your search.</p>
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

                        {/* Actions buttons */}
                        <div
                          style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => openAddModal(mainCat.id)}
                            title="Add subcategory under this category"
                          >
                            <Icon name="plus" size={12} />
                            <span>Add Sub</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => openEditModal(mainCat)}
                            title="Edit Main Category"
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-outline"
                            style={{ color: '#ef4444', borderColor: '#ef4444', padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => handleDelete(mainCat.id, mainCat.name)}
                            title="Delete Category"
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Accordion Body: Subcategories */}
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
                                          style={{ padding: '3px 7px', fontSize: '11px' }}
                                          onClick={() => openEditModal(sub)}
                                          title="Edit Subcategory"
                                        >
                                          <Icon name="edit" size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="admin-btn admin-btn-outline"
                                          style={{ color: '#ef4444', borderColor: '#ef4444', padding: '3px 7px', fontSize: '11px' }}
                                          onClick={() => handleDelete(sub.id, sub.name)}
                                          title="Delete Subcategory"
                                        >
                                          <Icon name="trash" size={12} />
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

            {/* Standalone / Orphaned Subcategories (if any) */}
            {orphanedSubcategories.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: '10px',
                  border: '1px solid #fde68a',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  marginTop: '12px'
                }}
              >
                <div style={{ padding: '14px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <strong style={{ fontSize: '14px', color: '#92400e' }}>Standalone / Unparented Categories</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#b45309' }}>
                    These categories had a parent category that was deleted. You can reassign them by clicking edit.
                  </p>
                </div>
                <div style={{ padding: '12px' }}>
                  <table className="admin-table" style={{ margin: 0 }}>
                    <tbody>
                      {orphanedSubcategories.map(sub => (
                        <tr key={sub.id}>
                          <td><strong>{sub.name}</strong></td>
                          <td><code>{sub.slug}</code></td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ padding: '3px 7px', fontSize: '11px', marginRight: '6px' }}
                              onClick={() => openEditModal(sub)}
                            >
                              <Icon name="edit" size={12} />
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-outline"
                              style={{ color: '#ef4444', borderColor: '#ef4444', padding: '3px 7px', fontSize: '11px' }}
                              onClick={() => handleDelete(sub.id, sub.name)}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                >
                  <option value="">-- None (Top-Level Main Category) --</option>
                  {topLevelCategories.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      Subcategory of: {parent.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                  Choose &quot;None&quot; to make this a primary category, or select a parent category to create a subcategory.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Travel Backpacks"
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

              <div className="form-group">
                <label className="form-label">Slug (URL Handle) *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. travel-backpacks"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                  required
                />
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
