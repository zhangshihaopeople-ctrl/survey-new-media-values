const crypto = require('crypto');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'zhangshihaopeople-ctrl';
const REPO = 'survey-new-media-values';
const BRANCH = 'main';

async function writeFile(path, content) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const body = JSON.stringify({
    message: `[auto] 提交问卷数据`,
    content: Buffer.from(content).toString('base64'),
    branch: BRANCH
  });
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('GitHub API error: ' + res.status);
  return res.json();
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async (req, res) => {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { demographics, answers, submitTime } = req.body;
    if (!demographics || !answers) return res.status(400).json({ error: '数据不完整' });

    const ts = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    const filename = `response_${ts}_${rand}.json`;
    const record = { demographics, answers, submitTime: submitTime || new Date().toISOString() };

    await writeFile(`responses/${filename}`, JSON.stringify(record, null, 2));
    res.json({ success: true, filename });
  } catch (e) {
    res.status(500).json({ error: '保存失败' });
  }
};
