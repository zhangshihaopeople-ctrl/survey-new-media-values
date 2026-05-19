/**
 * 问卷后端服务
 * - 接收问卷提交数据
 * - 管理员登录验证
 * - 数据导出Excel
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'survey2026admin';
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

// 数据文件路径
const DATA_DIR = path.join(__dirname, 'data');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 静态文件（前端页面 + 管理后台）
app.use(express.static(path.join(__dirname, '..')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// ==================== 工具函数 ====================

function readResponses() {
  try {
    if (!fs.existsSync(RESPONSES_FILE)) return [];
    const raw = fs.readFileSync(RESPONSES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveResponses(responses) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify(responses, null, 2), 'utf8');
}

function readTokens() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) return [];
    const raw = fs.readFileSync(TOKENS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyToken(token) {
  const tokens = readTokens();
  return tokens.some(t => t.token === token && t.expiresAt > Date.now());
}

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', responses: readResponses().length });
});

// 提交问卷
app.post('/api/submit', (req, res) => {
  try {
    const { demographics, answers, submitTime } = req.body;

    if (!demographics || !answers) {
      return res.status(400).json({ error: '数据不完整' });
    }

    const responses = readResponses();

    const record = {
      id: responses.length + 1,
      demographics,
      answers,
      submitTime: submitTime || new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress
    };

    responses.push(record);
    saveResponses(responses);

    console.log(`[提交] 第 ${record.id} 份问卷已保存 (${record.submitTime})`);
    res.json({ success: true, id: record.id });
  } catch (e) {
    console.error('提交失败:', e.message);
    res.status(500).json({ error: '保存失败，请重试' });
  }
});

// 管理员登录
app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: '请输入密码' });
  }

  const inputHash = hashPassword(password);
  const correctHash = hashPassword(ADMIN_PASSWORD);

  if (inputHash !== correctHash) {
    return res.status(401).json({ error: '密码错误' });
  }

  const token = generateToken();
  const tokens = readTokens();

  // 清理过期 token
  const validTokens = tokens.filter(t => t.expiresAt > Date.now());
  validTokens.push({
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时有效
  });

  saveTokens(validTokens);
  res.json({ success: true, token });
});

// 获取所有答卷（需认证）
app.get('/api/responses', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }

  const responses = readResponses();
  // 脱敏：移除 IP
  const safe = responses.map(r => ({
    id: r.id,
    demographics: r.demographics,
    answers: r.answers,
    submitTime: r.submitTime
  }));

  res.json(safe);
});

// 导出 Excel（需认证）
app.get('/api/export', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }

  try {
    const XLSX = require('xlsx');
    const responses = readResponses();

    if (responses.length === 0) {
      return res.status(404).json({ error: '暂无数据' });
    }

    // 构建汇总表
    const headers = ['编号', '性别', '年级', '专业类别', '每日使用时长', '提交时间'];
    for (let i = 1; i <= 100; i++) headers.push('Q' + i);

    const rows = [headers];

    const genderMap = { male: '男', female: '女', other: '其他' };
    const gradeMap = { freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四', postgrad: '研究生' };
    const majorMap = {
      arts: '文科', science: '理科', engineering: '工科', medicine: '医学',
      arts_design: '艺术/设计/体育', business: '经管', law: '法学',
      education: '教育学', agriculture: '农学', other: '其他'
    };
    const usageMap = { less1h: '<1小时', '1-3h': '1-3小时', '3-5h': '3-5小时', '5-8h': '5-8小时', over8h: '>8小时' };

    responses.forEach(r => {
      const d = r.demographics || {};
      const row = [
        r.id,
        genderMap[d.gender] || d.gender || '',
        gradeMap[d.grade] || d.grade || '',
        majorMap[d.major] || d.major || '',
        usageMap[d.usageTime] || d.usageTime || '',
        r.submitTime || ''
      ];
      for (let i = 1; i <= 100; i++) {
        row.push((r.answers && r.answers[i]) || '');
      }
      rows.push(row);
    });

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
    console.error('导出失败:', e.message);
    res.status(500).json({ error: '导出失败' });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`问卷后端服务已启动: http://localhost:${PORT}`);
  console.log(`已收集 ${readResponses().length} 份答卷`);
});
