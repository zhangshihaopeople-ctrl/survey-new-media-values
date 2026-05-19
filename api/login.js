const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'survey2026admin';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'survey-secret-key-2026';

function generateToken() {
  const ts = Date.now();
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(String(ts)).digest('hex');
  return `${ts}:${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  const [ts, sig] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(ts).digest('hex');
  if (sig !== expected) return false;
  // 24小时有效
  return (Date.now() - Number(ts)) < 86400000;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: '请输入密码' });

  const inputHash = crypto.createHash('sha256').update(password).digest('hex');
  const correctHash = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

  if (inputHash !== correctHash) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = generateToken();
  res.json({ success: true, token });
};

module.exports.verifyToken = verifyToken;
