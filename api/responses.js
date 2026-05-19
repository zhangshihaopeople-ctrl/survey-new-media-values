const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // 验证 token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未授权，请先登录' });

  const expires = await kv.get(`token:${token}`);
  if (!expires || Number(expires) < Date.now()) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }

  // 读取所有响应
  const count = (await kv.get('response_count')) || 0;
  const responses = [];

  for (let i = 1; i <= count; i++) {
    const raw = await kv.get(`response:${i}`);
    if (raw) {
      const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
      responses.push({
        id: r.id,
        demographics: r.demographics,
        answers: r.answers,
        submitTime: r.submitTime
      });
    }
  }

  res.json(responses);
};
