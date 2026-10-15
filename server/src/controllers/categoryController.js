const slugify = require('slugify');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile, deleteUploadedFile } = require('../middleware/upload');

async function getAllCategories(req, res, next) {
  try {
    const categories = await query(
      `SELECT c.*, parent.name AS parent_name, parent.slug AS parent_slug, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN categories parent ON c.parent_id = parent.id
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
       WHERE c.is_active = TRUE
       GROUP BY c.id
       ORDER BY COALESCE(c.parent_id, c.id) ASC, (c.parent_id IS NOT NULL) ASC, c.display_order ASC, c.name ASC`
    );

    // Also build a nested tree: main categories with their subcategories array
    const categoryMap = {};
    const rootCategories = [];

    categories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, subcategories: [] };
    });

    categories.forEach(cat => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].subcategories.push(categoryMap[cat.id]);
      } else if (!cat.parent_id) {
        rootCategories.push(categoryMap[cat.id]);
      }
    });

    return sendSuccess(res, categories, 'Categories retrieved successfully', 200, {
      tree: rootCategories
    });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug: customSlug, parent_id, description, display_order } = req.body;
    if (!name) return sendError(res, 'Category name is required.', 400);

    let slug = customSlug
      ? slugify(customSlug, { lower: true, strict: true })
      : slugify(name, { lower: true, strict: true });

    const existing = await query(`SELECT id FROM categories WHERE slug = ?`, [slug]);
    if (existing.length > 0) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    let image = null;
    if (req.file) {
      image = await processUploadedFile(req.file, 'categories');
    }

    const parentIdVal = parent_id && parent_id !== '0' && parent_id !== 'null' ? parseInt(parent_id, 10) : null;

    const result = await query(
      `INSERT INTO categories (parent_id, slug, name, description, image, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [parentIdVal, slug, name, description || null, image, display_order || 0]
    );

    return sendSuccess(res, { id: result.insertId, parent_id: parentIdVal, slug, name }, 'Category created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug: customSlug, parent_id, description, display_order, is_active } = req.body;

    let image = undefined;
    if (req.file) {
      image = await processUploadedFile(req.file, 'categories');
      const old = await query(`SELECT image FROM categories WHERE id = ?`, [id]);
      if (old.length > 0 && old[0].image) {
        deleteUploadedFile(old[0].image);
      }
    }

    let newSlug = undefined;
    if (customSlug) {
      newSlug = slugify(customSlug, { lower: true, strict: true });
      const duplicateSlug = await query(`SELECT id FROM categories WHERE slug = ? AND id != ?`, [newSlug, id]);
      if (duplicateSlug.length > 0) {
        return sendError(res, `Slug "${newSlug}" is already taken by another category.`, 400);
      }
    }

    let parentIdVal = undefined;
    if (parent_id !== undefined) {
      parentIdVal = (parent_id && parent_id !== '0' && parent_id !== 'null') ? parseInt(parent_id, 10) : null;
      // Prevent setting parent to itself
      if (parentIdVal === parseInt(id, 10)) {
        return sendError(res, 'A category cannot be its own parent.', 400);
      }
    }

    await query(
      `UPDATE categories SET
         name = COALESCE(?, name),
         slug = COALESCE(?, slug),
         parent_id = ?,
         description = COALESCE(?, description),
         image = COALESCE(?, image),
         display_order = COALESCE(?, display_order),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name || null,
        newSlug || null,
        parentIdVal !== undefined ? parentIdVal : null,
        description || null,
        image,
        display_order !== undefined ? display_order : null,
        is_active !== undefined ? is_active : null,
        id
      ]
    );

    return sendSuccess(res, { id }, 'Category updated successfully');
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const old = await query(`SELECT image FROM categories WHERE id = ?`, [id]);
    if (old.length > 0 && old[0].image) {
      deleteUploadedFile(old[0].image);
    }

    // Children will have parent_id set to NULL automatically by foreign key ON DELETE SET NULL
    await query(`DELETE FROM categories WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
};

