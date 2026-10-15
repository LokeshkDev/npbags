const slugify = require('slugify');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile, deleteUploadedFile } = require('../middleware/upload');

async function getBlogs(req, res, next) {
  try {
    const blogs = await query(`SELECT id, slug, title, excerpt, cover_image, author, created_at FROM blogs WHERE is_published = TRUE ORDER BY created_at DESC`);
    return sendSuccess(res, blogs);
  } catch (error) {
    next(error);
  }
}

async function getBlogBySlug(req, res, next) {
  try {
    const { slug } = req.params;
    const blogs = await query(`SELECT * FROM blogs WHERE slug = ? AND is_published = TRUE`, [slug]);
    if (blogs.length === 0) return sendError(res, 'Blog post not found', 404);
    return sendSuccess(res, blogs[0]);
  } catch (error) {
    next(error);
  }
}

async function getAllBlogsAdmin(req, res, next) {
  try {
    const blogs = await query(`SELECT * FROM blogs ORDER BY created_at DESC`);
    return sendSuccess(res, blogs);
  } catch (error) {
    next(error);
  }
}

async function createBlog(req, res, next) {
  try {
    const { title, excerpt, content, author } = req.body;
    if (!title || !content) return sendError(res, 'Title and content are required.', 400);

    const slug = slugify(title, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 1000);
    let cover_image = req.body.cover_image || null;
    if (req.file) {
      cover_image = await processUploadedFile(req.file, 'blogs');
    }

    const result = await query(
      `INSERT INTO blogs (slug, title, excerpt, content, cover_image, author, is_published)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [slug, title, excerpt || null, content, cover_image, author || 'Editorial Team']
    );

    return sendSuccess(res, { id: result.insertId, slug }, 'Article published successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function updateBlog(req, res, next) {
  try {
    const { id } = req.params;
    const { title, excerpt, content, author, is_published } = req.body;

    let cover_image = undefined;
    if (req.file) {
      cover_image = await processUploadedFile(req.file, 'blogs');
      const old = await query(`SELECT cover_image FROM blogs WHERE id = ?`, [id]);
      if (old.length > 0) deleteUploadedFile(old[0].cover_image);
    } else if (req.body.cover_image) {
      cover_image = req.body.cover_image;
    }

    await query(
      `UPDATE blogs SET
         title = COALESCE(?, title),
         excerpt = COALESCE(?, excerpt),
         content = COALESCE(?, content),
         cover_image = COALESCE(?, cover_image),
         author = COALESCE(?, author),
         is_published = COALESCE(?, is_published)
       WHERE id = ?`,
      [
        title || null,
        excerpt || null,
        content || null,
        cover_image,
        author || null,
        is_published !== undefined ? is_published : null,
        id
      ]
    );

    return sendSuccess(res, { id }, 'Article updated successfully');
  } catch (error) {
    next(error);
  }
}

async function deleteBlog(req, res, next) {
  try {
    const { id } = req.params;
    const old = await query(`SELECT cover_image FROM blogs WHERE id = ?`, [id]);
    if (old.length > 0) deleteUploadedFile(old[0].cover_image);

    await query(`DELETE FROM blogs WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Article deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBlogs,
  getBlogBySlug,
  getAllBlogsAdmin,
  createBlog,
  updateBlog,
  deleteBlog
};

