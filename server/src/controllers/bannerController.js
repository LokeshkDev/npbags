const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { processUploadedFile, deleteUploadedFile } = require('../middleware/upload');

async function getBanners(req, res, next) {
  try {
    const banners = await query(`SELECT * FROM banners WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC`);
    return sendSuccess(res, banners);
  } catch (error) {
    next(error);
  }
}

async function getAllBannersAdmin(req, res, next) {
  try {
    const banners = await query(`SELECT * FROM banners ORDER BY sort_order ASC, id ASC`);
    return sendSuccess(res, banners);
  } catch (error) {
    next(error);
  }
}

async function createBanner(req, res, next) {
  try {
    const { eyebrow, title, text, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, note, sort_order } = req.body;
    let image = req.body.image;
    if (req.file) {
      image = await processUploadedFile(req.file, 'banners');
    }

    if (!image) {
      return sendError(res, 'Banner image is required.', 400);
    }

    const result = await query(
      `INSERT INTO banners (eyebrow, title, text, image, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eyebrow || null,
        title,
        text || null,
        image,
        cta_primary_text || 'Shop Now',
        cta_primary_link || '/shop',
        cta_secondary_text || 'Explore',
        cta_secondary_link || '#story',
        note || null,
        sort_order || 0
      ]
    );

    return sendSuccess(res, { id: result.insertId }, 'Banner created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function updateBanner(req, res, next) {
  try {
    const { id } = req.params;
    const { eyebrow, title, text, cta_primary_text, cta_primary_link, cta_secondary_text, cta_secondary_link, note, sort_order, is_active } = req.body;

    let image = undefined;
    if (req.file) {
      image = await processUploadedFile(req.file, 'banners');
      const old = await query(`SELECT image FROM banners WHERE id = ?`, [id]);
      if (old.length > 0) deleteUploadedFile(old[0].image);
    } else if (req.body.image) {
      image = req.body.image;
    }

    await query(
      `UPDATE banners SET
         eyebrow = COALESCE(?, eyebrow),
         title = COALESCE(?, title),
         text = COALESCE(?, text),
         image = COALESCE(?, image),
         cta_primary_text = COALESCE(?, cta_primary_text),
         cta_primary_link = COALESCE(?, cta_primary_link),
         cta_secondary_text = COALESCE(?, cta_secondary_text),
         cta_secondary_link = COALESCE(?, cta_secondary_link),
         note = COALESCE(?, note),
         sort_order = COALESCE(?, sort_order),
         is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        eyebrow || null,
        title || null,
        text || null,
        image,
        cta_primary_text || null,
        cta_primary_link || null,
        cta_secondary_text || null,
        cta_secondary_link || null,
        note || null,
        sort_order !== undefined ? sort_order : null,
        is_active !== undefined ? is_active : null,
        id
      ]
    );

    return sendSuccess(res, { id }, 'Banner updated successfully');
  } catch (error) {
    next(error);
  }
}

async function deleteBanner(req, res, next) {
  try {
    const { id } = req.params;
    const old = await query(`SELECT image FROM banners WHERE id = ?`, [id]);
    if (old.length > 0) deleteUploadedFile(old[0].image);

    await query(`DELETE FROM banners WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Banner deleted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBanners,
  getAllBannersAdmin,
  createBanner,
  updateBanner,
  deleteBanner
};

