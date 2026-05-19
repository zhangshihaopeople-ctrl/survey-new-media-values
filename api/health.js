const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const OWNER = 'zhangshihaopeople-ctrl';
const REPO = 'survey-new-media-values';

module.exports = async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/responses`;
    const fetchRes = await fetch(url, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    if (!fetchRes.ok) {
      return res.json({ status: 'ok', responses: 0 });
    }
    const files = await fetchRes.json();
    const count = Array.isArray(files) ? files.filter(f => f.name.startsWith('response_')).length : 0;
    res.json({ status: 'ok', responses: count });
  } catch (e) {
    res.json({ status: 'ok', responses: 0 });
  }
};
