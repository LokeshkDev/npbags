const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile } = require('../middleware/upload');

// Get all CMS sections for storefront
async function getCMSSections(req, res, next) {
  try {
    const rows = await query(`SELECT section_key, title, subtitle, content, is_visible FROM cms_sections`);
    const sections = {};
    rows.forEach(r => {
      let content = r.content;
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) {}
      }
      sections[r.section_key] = {
        title: r.title,
        subtitle: r.subtitle,
        is_visible: Boolean(r.is_visible),
        content: content,
        ...(typeof content === 'object' && content !== null ? content : {})
      };
    });

    return sendSuccess(res, sections);
  } catch (error) {
    next(error);
  }
}

// Admin: Get all sections with metadata for management
async function getAdminCMSSections(req, res, next) {
  try {
    const rows = await query(`SELECT * FROM cms_sections ORDER BY section_key ASC`);
    const formatted = rows.map(r => {
      let content = r.content;
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) {}
      }
      return {
        ...r,
        is_visible: Boolean(r.is_visible),
        content
      };
    });
    return sendSuccess(res, formatted);
  } catch (error) {
    next(error);
  }
}

// Admin: Update section content
async function updateCMSSection(req, res, next) {
  try {
    const { section_key } = req.params;
    const { title, subtitle, content, is_visible } = req.body;

    const existing = await query(`SELECT section_key FROM cms_sections WHERE section_key = ?`, [section_key]);

    const contentJson = typeof content === 'string' ? content : JSON.stringify(content || {});

    if (existing.length === 0) {
      await query(
        `INSERT INTO cms_sections (section_key, title, subtitle, content, is_visible)
         VALUES (?, ?, ?, ?, ?)`,
        [section_key, title || null, subtitle || null, contentJson, is_visible !== undefined ? is_visible : true]
      );
    } else {
      await query(
        `UPDATE cms_sections SET
           title = COALESCE(?, title),
           subtitle = COALESCE(?, subtitle),
           content = COALESCE(?, content),
           is_visible = COALESCE(?, is_visible)
         WHERE section_key = ?`,
        [title || null, subtitle || null, content ? contentJson : null, is_visible !== undefined ? is_visible : null, section_key]
      );
    }

    return sendSuccess(res, { section_key }, `Section '${section_key}' updated successfully`);
  } catch (error) {
    next(error);
  }
}

// Upload CMS media (banners, editorial images, category covers)
async function uploadCMSImage(req, res, next) {
  try {
    if (!req.file) {
      return sendError(res, 'No image file uploaded.', 400);
    }
    const imageUrl = await processUploadedFile(req.file, 'cms');
    return sendSuccess(res, { url: imageUrl }, 'Image uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
}

// Get delivery settings
async function getDeliverySettings(req, res, next) {
  try {
    const rows = await query(`SELECT * FROM delivery_settings WHERE id = 1`);
    const settings = rows[0] || {
      free_delivery_threshold: 499.00,
      standard_shipping_fee: 49.00,
      express_shipping_fee: 99.00,
      estimated_delivery_days: '2-4 business days',
      cod_enabled: true,
      return_window_days: 30
    };
    return sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

// Admin: Update delivery settings
async function updateDeliverySettings(req, res, next) {
  try {
    const {
      free_delivery_threshold,
      standard_shipping_fee,
      express_shipping_fee,
      estimated_delivery_days,
      cod_enabled,
      return_window_days
    } = req.body;

    await query(
      `INSERT INTO delivery_settings (id, free_delivery_threshold, standard_shipping_fee, express_shipping_fee, estimated_delivery_days, cod_enabled, return_window_days)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         free_delivery_threshold = VALUES(free_delivery_threshold),
         standard_shipping_fee = VALUES(standard_shipping_fee),
         express_shipping_fee = VALUES(express_shipping_fee),
         estimated_delivery_days = VALUES(estimated_delivery_days),
         cod_enabled = VALUES(cod_enabled),
         return_window_days = VALUES(return_window_days)`,
      [
        free_delivery_threshold !== undefined ? parseFloat(free_delivery_threshold) : 499.00,
        standard_shipping_fee !== undefined ? parseFloat(standard_shipping_fee) : 49.00,
        express_shipping_fee !== undefined ? parseFloat(express_shipping_fee) : 99.00,
        estimated_delivery_days || '2-4 business days',
        cod_enabled !== undefined ? Boolean(cod_enabled) : true,
        return_window_days !== undefined ? parseInt(return_window_days, 10) : 30
      ]
    );

    const updated = await query(`SELECT * FROM delivery_settings WHERE id = 1`);
    return sendSuccess(res, updated[0], 'Delivery settings updated successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCMSSections,
  getAdminCMSSections,
  updateCMSSection,
  uploadCMSImage,
  getDeliverySettings,
  updateDeliverySettings
};

