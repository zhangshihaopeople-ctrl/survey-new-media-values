const crypto = require('crypto');
const { kv } = require('@vercel/kv');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'survey2026admin';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请输入密码' });

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  const correctHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

  if (inputHash !== correctHash) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await kv.set(`token:${token}`, Date.now() + 86400000); // 24h

  res.json({ success: true, token });
};
