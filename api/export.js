const { verifyToken } = require('./login.js');
const XLSX = require('xlsx');

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
    if (!listRes.ok) return res.status(404).json({ error: '暂无数据' });

    const files = await listRes.json();
    if (!Array.isArray(files)) return res.status(404).json({ error: '暂无数据' });

    const responseFiles = files.filter(f => f.name.startsWith('response_') && f.name.endsWith('.json'));

    const genderMap = { male: '男', female: '女', other: '其他' };
    const gradeMap = { freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四', postgrad: '研究生' };
    const majorMap = { arts: '文科', science: '理科', engineering: '工科', medicine: '医学', arts_design: '艺术/设计/体育', business: '经管', law: '法学', education: '教育学', agriculture: '农学', other: '其他' };
    const usageMap = { less1h: '<1小时', '1-3h': '1-3小时', '3-5h': '3-5小时', '5-8h': '5-8小时', over8h: '>8小时' };

    const headers = ['编号', '性别', '年级', '专业类别', '每日使用时长', '提交时间'];
    for (let i = 1; i <= 100; i++) headers.push('Q' + i);
    const rows = [headers];

    let idx = 1;
    for (const f of responseFiles) {
      try {
        const fileRes = await fetch(f.url, {
          headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
        });
        if (!fileRes.ok) continue;
        const fileData = await fileRes.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        const r = JSON.parse(content);
        const d = r.demographics || {};
        const row = [
          idx++,
          genderMap[d.gender] || d.gender || '',
          gradeMap[d.grade] || d.grade || '',
          majorMap[d.major] || d.major || '',
          usageMap[d.usageTime] || d.usageTime || '',
          r.submitTime || ''
        ];
        for (let j = 1; j <= 100; j++) row.push((r.answers && r.answers[j]) || '');
        rows.push(row);
      } catch (e) { /* skip */ }
    }

    if (rows.length <= 1) return res.status(404).json({ error: '暂无数据' });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = headers.map(h => ({ wch: h.length > 8 ? 12 : 8 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '汇总');

    const filename = `问卷汇总_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  } catch (e) {
    res.status(500).json({ error: '导出失败' });
  }
};
