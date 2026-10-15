const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

async function getWishlist(req, res, next) {
  try {
    const items = await query(
      `SELECT w.id AS wishlist_id, w.created_at AS added_at, p.*
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );

    for (const item of items) {
      const imgs = await query(
        `SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC LIMIT 1`,
        [item.id]
      );
      item.primary_image = imgs.length > 0 ? imgs[0].image_url : null;
    }

    return sendSuccess(res, items);
  } catch (error) {
    next(error);
  }
}

async function addToWishlist(req, res, next) {
  try {
    const { product_id } = req.body;
    if (!product_id) return sendError(res, 'Product ID is required.', 400);

    await query(
      `INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)`,
      [req.user.id, product_id]
    );

    return sendSuccess(res, { product_id }, 'Product added to wishlist');
  } catch (error) {
    next(error);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    const { productId } = req.params;
    await query(`DELETE FROM wishlist WHERE user_id = ? AND product_id = ?`, [req.user.id, productId]);
    return sendSuccess(res, { product_id: productId }, 'Product removed from wishlist');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist
};

