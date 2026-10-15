const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

async function submitContactMessage(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return sendError(res, 'Name, email, and message are required.', 400);
    }

    await query(
      `INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)`,
      [name, email.toLowerCase().trim(), subject || 'Store Inquiry', message]
    );

    return sendSuccess(res, null, 'Thank you! Your message has been sent successfully.', 201);
  } catch (error) {
    next(error);
  }
}

async function subscribeNewsletter(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email is required.', 400);

    await query(
      `INSERT INTO newsletter_subscribers (email) VALUES (?) ON DUPLICATE KEY UPDATE is_active = TRUE`,
      [email.toLowerCase().trim()]
    );

    return sendSuccess(res, null, 'Thank you for joining our community!', 201);
  } catch (error) {
    next(error);
  }
}

async function getContactMessagesAdmin(req, res, next) {
  try {
    const messages = await query(`SELECT * FROM contact_messages ORDER BY created_at DESC`);
    return sendSuccess(res, messages);
  } catch (error) {
    next(error);
  }
}

async function getSubscribersAdmin(req, res, next) {
  try {
    const subs = await query(`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC`);
    return sendSuccess(res, subs);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitContactMessage,
  subscribeNewsletter,
  getContactMessagesAdmin,
  getSubscribersAdmin
};

