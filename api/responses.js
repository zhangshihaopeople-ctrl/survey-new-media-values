const { verifyToken } = require('./login.js');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'zhangshihaopeople-ctrl';
const REPO = 'survey-new-media-values';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token)) return res.status(401).json({ error: '未授权，请先登录' });

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/responses`;
    const listRes = await fetch(url, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!listRes.ok) return res.json([]);

    const files = await listRes.json();
    if (!Array.isArray(files)) return res.json([]);

    const responseFiles = files.filter(f => f.name.startsWith('response_') && f.name.endsWith('.json'));

    const results = [];
    for (const f of responseFiles) {
      try {
        const fileRes = await fetch(f.url, {
          headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const content = Buffer.from(fileData.content, 'base64').toString('utf8');
          const data = JSON.parse(content);
          data._filename = f.name;
          results.push(data);
        }
      } catch (e) { /* skip corrupt files */ }
    }

    res.json(results);
  } catch (e) {
    res.json([]);
  }
};
