const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  const count = await kv.get('response_count') || 0;
  res.json({ status: 'ok', responses: Number(count) });
};
