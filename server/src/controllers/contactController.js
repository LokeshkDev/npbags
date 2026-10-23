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
    const { email, phone, whatsapp_number } = req.body;
    const whatsapp = (phone || whatsapp_number || '').trim();
    const emailVal = (email || (whatsapp ? `${whatsapp.replace(/[^0-9]/g, '')}@whatsapp.npgrand.com` : '')).toLowerCase().trim();

    if (!whatsapp && !email) {
      return sendError(res, 'WhatsApp number is required.', 400);
    }

    await query(
      `INSERT INTO newsletter_subscribers (email, phone) VALUES (?, ?) ON DUPLICATE KEY UPDATE phone = VALUES(phone), is_active = TRUE`,
      [emailVal, whatsapp || null]
    );

    return sendSuccess(res, null, 'Thank you! You have joined our WhatsApp updates successfully.', 201);
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

