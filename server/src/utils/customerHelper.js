const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

/**
 * Finds an existing customer or creates a new customer in the `users` table
 * during in-store POS billing or hold operations.
 *
 * @param {Object} customerData
 * @param {string} customerData.name - Customer full name
 * @param {string} customerData.phone - Customer phone number
 * @param {string} customerData.email - Customer email address
 * @returns {Promise<number|null>} User ID if found or created, otherwise null
 */
async function findOrCreateCustomer({ name, phone, email }) {
  const cleanPhone = (phone || '').trim().replace(/\D/g, '');
  const cleanEmail = (email || '').trim().toLowerCase();
  const rawName = (name || '').trim();
  const isGenericName = !rawName || rawName.toLowerCase() === 'walk-in customer';

  // If no contact info and generic name, don't create a junk user
  if (!cleanPhone && (!cleanEmail || cleanEmail.includes('walkin@')) && isGenericName) {
    return null;
  }

  const tenDigit = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

  // 1. Check if customer already exists by email
  let existingUser = null;
  if (cleanEmail && !cleanEmail.includes('@pos.npgrand.com') && !cleanEmail.includes('walkin@')) {
    const byEmail = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (byEmail && byEmail.length > 0) {
      existingUser = byEmail[0];
    }
  }

  // 2. Check if customer already exists by phone
  if (!existingUser && cleanPhone && cleanPhone.length >= 5) {
    const byPhone = await query(
      `SELECT * FROM users WHERE (phone LIKE ? OR phone LIKE ?) AND role = 'customer' LIMIT 1`,
      [`%${cleanPhone}%`, `%${tenDigit}%`]
    );
    if (byPhone && byPhone.length > 0) {
      existingUser = byPhone[0];
    }
  }

  // 3. Update existing user if more complete info is provided
  if (existingUser) {
    const updates = [];
    const params = [];

    // If existing user has generic name but a real name is now provided
    if (!isGenericName && (!existingUser.name || existingUser.name.toLowerCase() === 'walk-in customer')) {
      updates.push('name = ?');
      params.push(rawName);
    }

    // If existing user has no phone but phone is now provided
    if (cleanPhone && (!existingUser.phone || !existingUser.phone.trim())) {
      updates.push('phone = ?');
      params.push(cleanPhone);
    }

    // If real email is provided and user had dummy pos email
    if (cleanEmail && !cleanEmail.includes('walkin@') && (!existingUser.email || existingUser.email.includes('@pos.npgrand.com'))) {
      const conflict = await query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [cleanEmail, existingUser.id]);
      if (conflict.length === 0) {
        updates.push('email = ?');
        params.push(cleanEmail);
      }
    }

    if (updates.length > 0) {
      params.push(existingUser.id);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return existingUser.id;
  }

  // 4. Create new customer record in `users`
  const finalName = !isGenericName ? rawName : (cleanPhone ? `Customer ${cleanPhone.slice(-4)}` : 'Walk-in Customer');

  let finalEmail = cleanEmail && !cleanEmail.includes('walkin@') ? cleanEmail : null;
  if (!finalEmail) {
    const suffix = cleanPhone ? cleanPhone : `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    finalEmail = `${suffix}@pos.npgrand.com`;
  }

  // Check email uniqueness, adjust if needed
  const existingEmail = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [finalEmail]);
  if (existingEmail.length > 0) {
    finalEmail = `${cleanPhone || 'pos'}_${Date.now()}@pos.npgrand.com`;
  }

  const defaultPassword = 'NPGrand@' + (cleanPhone ? cleanPhone.slice(-4) : '1234');
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const insertResult = await query(
    `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, 'customer')`,
    [finalName, finalEmail, hashedPassword, cleanPhone || null]
  );

  return insertResult.insertId;
}

module.exports = {
  findOrCreateCustomer
};

