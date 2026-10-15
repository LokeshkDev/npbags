'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { ImageUploader } from '../../components/ImageUploader';
import { Icon } from '../../components/Icons';
import { getAdminBlogs, createAdminBlog, deleteAdminBlog } from '../../lib/api';

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: 'Editorial Team',
    image: null
  });
  const [saving, setSaving] = useState(false);

  const loadBlogs = () => {
    getAdminBlogs()
      .then(data => {
        if (Array.isArray(data)) setBlogs(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadBlogs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('slug', formData.slug);
      data.append('excerpt', formData.excerpt);
      data.append('content', formData.content);
      data.append('author', formData.author);
      if (formData.image) {
        data.append('cover_image', formData.image);
      }

      await createAdminBlog(data);
      setIsModalOpen(false);
      setFormData({ title: '', slug: '', excerpt: '', content: '', author: 'Editorial Team', image: null });
      loadBlogs();
    } catch (err) {
      alert(err.message || 'Error publishing article');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    try {
      await deleteAdminBlog(id);
      loadBlogs();
    } catch (err) {
      alert(err.message || 'Error deleting story');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Journal Articles & Editorial Stories" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Journal Stories</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Publish brand narratives, material craftsmanship guides, and styling journal posts.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Icon name="plus" size={16} />
              <span>Write Story</span>
            </button>
          </div>

          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cover</th>
                  <th>Article Title</th>
                  <th>Slug</th>
                  <th>Author</th>
                  <th>Published</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      No published journal articles yet.
                    </td>
                  </tr>
                ) : (
                  blogs.map(b => (
                    <tr key={b.id}>
                      <td style={{ width: '60px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', background: '#f3f4f6' }}>
                          {b.cover_image ? (
                            <img src={b.cover_image} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                              <Icon name="blog" size={18} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{b.title}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{b.slug}</td>
                      <td>{b.author || 'NP Grand'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : 'Today'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-outline"
                          style={{ color: 'var(--brand-red)', borderColor: 'var(--brand-red)', padding: '4px 8px' }}
                          onClick={() => handleDelete(b.id)}
                          title="Delete Article"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Write Article Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Write New Journal Story"
            maxWidth="720px"
          >
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Article Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. The Craft of Canvas: Built For The Long Run"
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setFormData({ ...formData, title, slug });
                  }}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Slug</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Author Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Excerpt / Teaser</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="Short 1-2 sentence teaser summary..."
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Article Story Content</label>
                <textarea
                  rows={6}
                  className="form-control"
                  placeholder="Write the full journal story..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>

              <ImageUploader
                label="Article Hero Cover Image"
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
                  <span>{saving ? 'Publishing...' : 'Publish Story'}</span>
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  );
}

