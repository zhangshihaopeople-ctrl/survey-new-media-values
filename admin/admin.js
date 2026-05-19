/**
 * 问卷管理后台 — 前端逻辑
 */

// 后端 API 地址（部署后替换为实际地址）
const API_BASE = 'https://survey-new-media-values-fa7i.vercel.app';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  loginPanel: $('#login-panel'),
  dataPanel: $('#data-panel'),
  passwordInput: $('#password-input'),
  loginError: $('#login-error'),
  btnLogin: $('#btn-login'),
  btnRefresh: $('#btn-refresh'),
  btnExport: $('#btn-export'),
  btnLogout: $('#btn-logout'),
  totalCount: $('#total-count'),
  todayCount: $('#today-count'),
  completeRate: $('#complete-rate'),
  tableBody: $('#table-body'),
  toast: $('#toast')
};

const TOKEN_KEY = 'survey_admin_token';

// ==================== 工具函数 ====================

function showToast(msg, duration = 2000) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(DOM.toast._timer);
  DOM.toast._timer = setTimeout(() => DOM.toast.classList.remove('show'), duration);
}

async function apiRequest(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

// ==================== 登录 ====================

async function login() {
  const password = DOM.passwordInput.value.trim();
  if (!password) {
    DOM.loginError.textContent = '请输入密码';
    DOM.loginError.classList.add('show');
    return;
  }

  DOM.btnLogin.disabled = true;
  DOM.btnLogin.textContent = '登录中...';
  DOM.loginError.classList.remove('show');

  try {
    const data = await apiRequest('POST', '/api/login', { password });
    sessionStorage.setItem(TOKEN_KEY, data.token);
    showPanel('data');
    await loadData();
    showToast('登录成功');
  } catch (e) {
    DOM.loginError.textContent = e.message;
    DOM.loginError.classList.add('show');
  } finally {
    DOM.btnLogin.disabled = false;
    DOM.btnLogin.textContent = '登 录';
  }
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  showPanel('login');
  DOM.passwordInput.value = '';
  showToast('已退出登录');
}

// ==================== 面板切换 ====================

function showPanel(panel) {
  if (panel === 'login') {
    DOM.loginPanel.classList.remove('hidden');
    DOM.dataPanel.classList.add('hidden');
  } else {
    DOM.loginPanel.classList.add('hidden');
    DOM.dataPanel.classList.remove('hidden');
  }
}

// ==================== 数据加载 ====================

async function loadData() {
  try {
    const responses = await apiRequest('GET', '/api/responses');
    renderStats(responses);
    renderTable(responses);
  } catch (e) {
    if (e.message === '未授权，请先登录') {
      logout();
    } else {
      showToast('加载数据失败: ' + e.message);
    }
  }
}

function renderStats(responses) {
  const total = responses.length;
  DOM.totalCount.textContent = total;

  // 今日新增
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = responses.filter(r => (r.submitTime || '').startsWith(today)).length;
  DOM.todayCount.textContent = todayCount;

  // 平均完成度
  if (total > 0) {
    const avgComplete = responses.reduce((sum, r) => {
      const answered = Object.keys(r.answers || {}).length;
      return sum + (answered / 100 * 100);
    }, 0) / total;
    DOM.completeRate.textContent = Math.round(avgComplete) + '%';
  } else {
    DOM.completeRate.textContent = '0%';
  }
}

function renderTable(responses) {
  if (responses.length === 0) {
    DOM.tableBody.innerHTML = '<tr><td colspan="7" class="empty-msg">暂无数据</td></tr>';
    return;
  }

  const genderMap = { male: '男', female: '女', other: '其他' };
  const gradeMap = { freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四', postgrad: '研究生' };
  const majorMap = {
    arts: '文科', science: '理科', engineering: '工科', medicine: '医学',
    arts_design: '艺术/设计/体育', business: '经管', law: '法学',
    education: '教育学', agriculture: '农学', other: '其他'
  };
  const usageMap = { less1h: '<1h', '1-3h': '1-3h', '3-5h': '3-5h', '5-8h': '5-8h', over8h: '>8h' };

  DOM.tableBody.innerHTML = responses.map(r => {
    const d = r.demographics || {};
    const answerCount = Object.keys(r.answers || {}).length;
    const time = r.submitTime ? new Date(r.submitTime).toLocaleString('zh-CN') : '-';
    return `
      <tr>
        <td>${r.id}</td>
        <td>${genderMap[d.gender] || d.gender || '-'}</td>
        <td>${gradeMap[d.grade] || d.grade || '-'}</td>
        <td>${majorMap[d.major] || d.major || '-'}</td>
        <td>${usageMap[d.usageTime] || d.usageTime || '-'}</td>
        <td>${answerCount}/100</td>
        <td>${time}</td>
      </tr>
    `;
  }).join('');
}

// ==================== 导出 ====================

async function exportExcel() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) { logout(); return; }

  DOM.btnExport.disabled = true;
  DOM.btnExport.textContent = '正在生成...';

  try {
    const res = await fetch(API_BASE + '/api/export', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '导出失败');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `问卷数据汇总_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Excel 导出成功');
  } catch (e) {
    showToast('导出失败: ' + e.message);
  } finally {
    DOM.btnExport.disabled = false;
    DOM.btnExport.textContent = '导出 Excel';
  }
}

// ==================== 初始化 ====================

function init() {
  DOM.btnLogin.addEventListener('click', login);
  DOM.passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  DOM.btnRefresh.addEventListener('click', loadData);
  DOM.btnExport.addEventListener('click', exportExcel);
  DOM.btnLogout.addEventListener('click', logout);

  // 检查是否已登录
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    showPanel('data');
    loadData();
  } else {
    showPanel('login');
  }
}

document.addEventListener('DOMContentLoaded', init);
