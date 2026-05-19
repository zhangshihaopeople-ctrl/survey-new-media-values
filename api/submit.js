const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { demographics, answers, submitTime } = req.body;
    if (!demographics || !answers) {
      return res.status(400).json({ error: '数据不完整' });
    }

    const count = (await kv.get('response_count')) || 0;
    const id = Number(count) + 1;

    const record = { id, demographics, answers, submitTime: submitTime || new Date().toISOString() };

    await kv.set(`response:${id}`, JSON.stringify(record));
    await kv.set('response_count', id);

    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: '保存失败，请重试' });
  }
};
