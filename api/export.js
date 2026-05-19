const { kv } = require('@vercel/kv');
const XLSX = require('xlsx');

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

  try {
    const count = (await kv.get('response_count')) || 0;
    if (count === 0) return res.status(404).json({ error: '暂无数据' });

    const genderMap = { male: '男', female: '女', other: '其他' };
    const gradeMap = { freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四', postgrad: '研究生' };
    const majorMap = { arts: '文科', science: '理科', engineering: '工科', medicine: '医学', arts_design: '艺术/设计/体育', business: '经管', law: '法学', education: '教育学', agriculture: '农学', other: '其他' };
    const usageMap = { less1h: '<1小时', '1-3h': '1-3小时', '3-5h': '3-5小时', '5-8h': '5-8小时', over8h: '>8小时' };

    // 构建表头
    const headers = ['编号', '性别', '年级', '专业类别', '每日使用时长', '提交时间'];
    for (let i = 1; i <= 100; i++) headers.push('Q' + i);

    const rows = [headers];

    for (let i = 1; i <= count; i++) {
      const raw = await kv.get(`response:${i}`);
      if (!raw) continue;
      const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const d = r.demographics || {};
      const row = [
        r.id,
        genderMap[d.gender] || d.gender || '',
        gradeMap[d.grade] || d.grade || '',
        majorMap[d.major] || d.major || '',
        usageMap[d.usageTime] || d.usageTime || '',
        r.submitTime || ''
      ];
      for (let j = 1; j <= 100; j++) {
        row.push((r.answers && r.answers[j]) || '');
      }
      rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = headers.map(h => ({ wch: h.length > 8 ? 12 : 8 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '问卷数据汇总');

    const filename = `问卷数据汇总_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: '导出失败' });
  }
};
