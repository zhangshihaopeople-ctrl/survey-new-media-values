/**
 * 基于新媒体对大学生价值观的影响 — 调查问卷
 * 核心应用逻辑
 */

// ==================== 常量 ====================
const QUESTIONS_PER_PAGE = 10;
const TOTAL_QUESTIONS = 100;
const TOTAL_PAGES = TOTAL_QUESTIONS / QUESTIONS_PER_PAGE; // 10
const TOTAL_ITEMS = TOTAL_QUESTIONS + 4; // 100题 + 4道基本信息
const STORAGE_KEY = 'survey_new_media_values';

// ==================== 全局状态 ====================
const STATE = {
  demographics: { gender: '', grade: '', major: '', usageTime: '' },
  answers: {},          // { "1": 2, "2": 4, ... "100": 5 }
  currentQuestionPage: 0, // 0-based (0-9)
  currentView: 'welcome'  // 'welcome' | 'demographics' | 'questions' | 'complete'
};

// ==================== DOM 引用缓存 ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  progressFill: $('#progress-fill'),
  pages: {
    welcome: $('#page-welcome'),
    demographics: $('#page-demographics'),
    questions: $('#page-questions'),
    complete: $('#page-complete')
  },
  resumeBanner: $('#resume-banner'),
  dimensionBadge: $('#dimension-badge'),
  pageIndicator: $('#page-indicator'),
  questionContainer: $('#question-container'),
  pageInfo: $('#page-info'),
  statsSummary: $('#stats-summary'),
  toast: $('#toast')
};

// ==================== 工具函数 ====================
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(msg, duration = 2000) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  clearTimeout(DOM.toast._timer);
  DOM.toast._timer = setTimeout(() => DOM.toast.classList.remove('show'), duration);
}

// ==================== 持久化 ====================
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      demographics: STATE.demographics,
      answers: STATE.answers,
      currentQuestionPage: STATE.currentQuestionPage,
      currentView: STATE.currentView
    }));
  } catch (e) {
    // localStorage 满或不可用，静默失败
  }
}

function restoreFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    STATE.demographics = data.demographics || STATE.demographics;
    STATE.answers = data.answers || {};
    STATE.currentQuestionPage = data.currentQuestionPage || 0;
    STATE.currentView = data.currentView || 'welcome';
    return !!(data.currentView && data.currentView !== 'welcome');
  } catch (e) {
    return false;
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ==================== 进度条 ====================
function updateProgressBar() {
  const demoAnswered = Object.values(STATE.demographics).filter(v => v !== '').length;
  const qAnswered = Object.keys(STATE.answers).length;
  const pct = Math.round(((demoAnswered + qAnswered) / TOTAL_ITEMS) * 100);
  DOM.progressFill.style.width = pct + '%';
}

// ==================== 页面切换 ====================
function showPage(pageId) {
  Object.values(DOM.pages).forEach(el => el.classList.add('hidden'));
  DOM.pages[pageId].classList.remove('hidden');
  STATE.currentView = pageId;
  updateProgressBar();

  // 进度条在欢迎页隐藏
  const bar = document.getElementById('progress-bar');
  if (pageId === 'welcome') {
    bar.style.display = 'none';
  } else {
    bar.style.display = 'block';
  }

  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
  saveToStorage();
}

// ==================== 欢迎页 ====================
function initWelcome() {
  const hasPrevious = restoreFromStorage();

  if (hasPrevious) {
    DOM.resumeBanner.classList.remove('hidden');
    $('#btn-start').classList.add('hidden');
  } else {
    DOM.resumeBanner.classList.add('hidden');
    $('#btn-start').classList.remove('hidden');
  }

  $('#btn-start').addEventListener('click', () => {
    STATE.currentView = 'welcome';
    showPage('demographics');
  });

  $('#btn-resume').addEventListener('click', () => {
    if (STATE.currentView === 'demographics') showPage('demographics');
    else if (STATE.currentView === 'questions') {
      renderQuestionPage(STATE.currentQuestionPage);
      showPage('questions');
    } else if (STATE.currentView === 'complete') {
      renderCompletion();
      showPage('complete');
    } else {
      showPage('demographics');
    }
  });

  $('#btn-restart').addEventListener('click', () => {
    clearStorage();
    resetState();
    DOM.resumeBanner.classList.add('hidden');
    $('#btn-start').classList.remove('hidden');
  });
}

function resetState() {
  STATE.demographics = { gender: '', grade: '', major: '', usageTime: '' };
  STATE.answers = {};
  STATE.currentQuestionPage = 0;
  STATE.currentView = 'welcome';
  DOM.progressFill.style.width = '0%';
}

// ==================== 基本信息页 ====================
function initDemographics() {
  // 恢复已填数据
  restoreDemographicsForm();

  $('#btn-demo-prev').addEventListener('click', () => {
    showPage('welcome');
  });

  $('#btn-demo-next').addEventListener('click', () => {
    const result = validateDemographics();
    if (!result.valid) {
      showDemographicsErrors(result.errors);
      return;
    }
    collectDemographics();
    clearDemographicsErrors();
    showPage('questions');
    renderQuestionPage(STATE.currentQuestionPage);
  });

  // 实时清除错误状态
  document.querySelectorAll('#page-demographics input, #page-demographics select').forEach(el => {
    el.addEventListener('change', () => {
      clearDemographicsErrors();
      saveToStorage();
      updateProgressBar();
    });
  });
}

function restoreDemographicsForm() {
  const d = STATE.demographics;
  if (d.gender) {
    const rb = document.querySelector(`input[name="gender"][value="${d.gender}"]`);
    if (rb) rb.checked = true;
  }
  if (d.grade) {
    const rb = document.querySelector(`input[name="grade"][value="${d.grade}"]`);
    if (rb) rb.checked = true;
  }
  if (d.major) {
    $('#select-major').value = d.major;
  }
  if (d.usageTime) {
    const rb = document.querySelector(`input[name="usageTime"][value="${d.usageTime}"]`);
    if (rb) rb.checked = true;
  }
}

function validateDemographics() {
  const errors = [];
  if (!document.querySelector('input[name="gender"]:checked')) errors.push('gender');
  if (!document.querySelector('input[name="grade"]:checked')) errors.push('grade');
  if (!$('#select-major').value) errors.push('major');
  if (!document.querySelector('input[name="usageTime"]:checked')) errors.push('usageTime');
  return { valid: errors.length === 0, errors };
}

function showDemographicsErrors(errors) {
  errors.forEach(field => {
    const errEl = document.querySelector(`[data-error="${field}"]`);
    if (errEl) {
      errEl.textContent = '请选择或填写此项';
      errEl.classList.add('show');
    }
  });
}

function clearDemographicsErrors() {
  $$('#page-demographics .error-msg').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

function collectDemographics() {
  STATE.demographics.gender = document.querySelector('input[name="gender"]:checked')?.value || '';
  STATE.demographics.grade = document.querySelector('input[name="grade"]:checked')?.value || '';
  STATE.demographics.major = $('#select-major').value;
  STATE.demographics.usageTime = document.querySelector('input[name="usageTime"]:checked')?.value || '';
  saveToStorage();
  updateProgressBar();
}

// ==================== 问卷页 ====================
function getQuestionsForPage(pageIndex) {
  const start = pageIndex * QUESTIONS_PER_PAGE;
  const end = start + QUESTIONS_PER_PAGE;
  const flatQuestions = [];
  QUESTION_DIMENSIONS.forEach(dim => {
    dim.questions.forEach(q => flatQuestions.push({ ...q, dimension: dim }));
  });
  return flatQuestions.slice(start, end);
}

function getDimensionForQuestionIndex(qIndex) {
  for (const dim of QUESTION_DIMENSIONS) {
    const found = dim.questions.find(q => q.index === qIndex);
    if (found) return dim;
  }
  return null;
}

function getCurrentPageDimension(pageIndex) {
  const questions = getQuestionsForPage(pageIndex);
  if (questions.length === 0) return null;
  return questions[0].dimension;
}

function renderQuestionPage(pageIndex) {
  const questions = getQuestionsForPage(pageIndex);
  const dimension = questions[0]?.dimension;

  // 更新维度标签
  if (dimension) {
    DOM.dimensionBadge.textContent = dimension.name + ' — ' + dimension.description;
    DOM.dimensionBadge.style.display = 'inline-block';
  }

  // 更新页码
  DOM.pageIndicator.textContent = `第 ${pageIndex + 1}/${TOTAL_PAGES} 页（第 ${pageIndex * QUESTIONS_PER_PAGE + 1}-${Math.min((pageIndex + 1) * QUESTIONS_PER_PAGE, TOTAL_QUESTIONS)} 题）`;

  // 渲染题目
  DOM.questionContainer.innerHTML = '';
  questions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.setAttribute('data-question-index', q.index);

    const savedValue = STATE.answers[q.index] || '';

    card.innerHTML = `
      <div class="question-number">第 ${q.index} 题</div>
      <div class="question-text">${q.text}</div>
      <div class="likert-group">
        <span class="likert-label-left">非常不同意</span>
        <div class="likert-options">
          ${[1,2,3,4,5].map(val => `
            <label class="likert-option">
              <input type="radio" name="q${q.index}" value="${val}" ${savedValue == val ? 'checked' : ''}>
              <span>${val}</span>
            </label>
          `).join('')}
        </div>
        <span class="likert-label-right">非常同意</span>
      </div>
    `;

    DOM.questionContainer.appendChild(card);
  });

  // 绑定事件
  bindQuestionEvents();

  // 更新导航按钮
  updateQuestionNav(pageIndex);

  STATE.currentQuestionPage = pageIndex;
  saveToStorage();
  updateProgressBar();
}

function bindQuestionEvents() {
  $$('#question-container input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const card = radio.closest('.question-card');
      card.classList.remove('error');

      const qIndex = parseInt(card.getAttribute('data-question-index'));
      STATE.answers[qIndex] = parseInt(radio.value);

      // 清除当前页错误提示
      clearCurrentPageErrors();

      debouncedSave();
      updateProgressBar();
    });
  });
}

const debouncedSave = debounce(() => {
  saveToStorage();
}, 500);

function updateQuestionNav(pageIndex) {
  $('#btn-q-prev').disabled = (pageIndex === 0);

  if (pageIndex === TOTAL_PAGES - 1) {
    $('#btn-q-next').textContent = '提交问卷';
    $('#btn-q-next').setAttribute('data-action', 'submit');
  } else {
    $('#btn-q-next').textContent = '下一页';
    $('#btn-q-next').setAttribute('data-action', 'next');
  }

  DOM.pageInfo.textContent = `${pageIndex + 1} / ${TOTAL_PAGES}`;
}

function validateCurrentPage() {
  const questions = getQuestionsForPage(STATE.currentQuestionPage);
  const unanswered = questions.filter(q => !STATE.answers[q.index]);
  return { valid: unanswered.length === 0, unanswered: unanswered.map(q => q.index) };
}

function highlightUnanswered(questionIndices) {
  questionIndices.forEach(idx => {
    const card = document.querySelector(`.question-card[data-question-index="${idx}"]`);
    if (card) {
      card.classList.add('error');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function clearCurrentPageErrors() {
  $$('#question-container .question-card.error').forEach(card => {
    card.classList.remove('error');
  });
}

function goToNextQuestionPage() {
  const result = validateCurrentPage();
  if (!result.valid) {
    highlightUnanswered(result.unanswered);
    showToast(`还有 ${result.unanswered.length} 道题未作答，请完成后再进入下一页`);
    return;
  }

  saveToStorage();

  if (STATE.currentQuestionPage < TOTAL_PAGES - 1) {
    STATE.currentQuestionPage++;
    renderQuestionPage(STATE.currentQuestionPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // 最后一页 → 完成页
    showPage('complete');
    renderCompletion();
  }
}

function goToPrevQuestionPage() {
  saveToStorage();
  if (STATE.currentQuestionPage > 0) {
    STATE.currentQuestionPage--;
    renderQuestionPage(STATE.currentQuestionPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    showPage('demographics');
  }
}

function initQuestions() {
  $('#btn-q-next').addEventListener('click', goToNextQuestionPage);
  $('#btn-q-prev').addEventListener('click', goToPrevQuestionPage);
}

// ==================== 完成页 ====================
function renderCompletion() {
  const demoCount = Object.values(STATE.demographics).filter(v => v !== '').length;
  const qCount = Object.keys(STATE.answers).length;
  const total = demoCount + qCount;
  const totalItems = TOTAL_ITEMS;

  DOM.statsSummary.innerHTML = `
    <p>基本信息：${demoCount}/4 项已填写</p>
    <p>问卷题目：${qCount}/${TOTAL_QUESTIONS} 题已作答</p>
    <p>整体完成度：${Math.round((total / totalItems) * 100)}%</p>
    ${qCount < TOTAL_QUESTIONS ? `<p style="color: var(--color-error); margin-top: 8px; font-size: 0.85rem;">注意：还有 ${TOTAL_QUESTIONS - qCount} 道题未作答，建议返回完成后再导出</p>` : ''}
  `;
}

function initCompletion() {
  $('#btn-export').addEventListener('click', exportToExcel);

  $('#btn-reset').addEventListener('click', () => {
    if (confirm('确定要清除所有数据并重新填写吗？此操作不可恢复。')) {
      clearStorage();
      resetState();
      showPage('welcome');
      initWelcome();
      showToast('数据已清除，可以重新填写');
    }
  });
}

// ==================== Excel 导出 ====================
function exportToExcel() {
  const btn = $('#btn-export');
  btn.disabled = true;
  btn.textContent = '正在生成...';

  try {
    if (typeof XLSX !== 'undefined') {
      exportAsXlsx();
    } else {
      exportAsCsv();
    }
  } catch (e) {
    console.error('XLSX export failed, falling back to CSV:', e);
    try {
      exportAsCsv();
    } catch (e2) {
      console.error('CSV export also failed:', e2);
      showToast('导出失败，请重试');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '导出 Excel';
  }
}

function exportAsXlsx() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 基本信息
  const demoData = [
    ['项目', '内容'],
    ['性别', getDemoLabel('gender', STATE.demographics.gender)],
    ['年级', getDemoLabel('grade', STATE.demographics.grade)],
    ['专业类别', getDemoLabel('major', STATE.demographics.major)],
    ['每日新媒体使用时长', getDemoLabel('usageTime', STATE.demographics.usageTime)],
    ['提交时间', new Date().toLocaleString('zh-CN')]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(demoData);
  ws1['!cols'] = [{ wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws1, '基本信息');

  // Sheet 2: 问卷作答
  const headers = ['题号', '所属维度', '题目', '评分(1-5)', '评分含义'];
  const rows = [headers];
  const flatQuestions = [];
  QUESTION_DIMENSIONS.forEach(dim => {
    dim.questions.forEach(q => flatQuestions.push({ ...q, dimName: dim.name }));
  });
  flatQuestions.forEach(q => {
    const score = STATE.answers[q.index];
    const meaningMap = { 1: '非常不同意', 2: '不同意', 3: '一般', 4: '同意', 5: '非常同意' };
    rows.push([q.index, q.dimName, q.text, score || '', score ? meaningMap[score] : '未作答']);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(rows);
  ws2['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 60 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, '问卷作答');

  // Sheet 3: 数据汇总
  const summaryHeaders = ['性别', '年级', '专业类别', '每日使用时长', '提交时间'];
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) summaryHeaders.push('Q' + i);
  const summaryRow = [
    getDemoLabel('gender', STATE.demographics.gender),
    getDemoLabel('grade', STATE.demographics.grade),
    getDemoLabel('major', STATE.demographics.major),
    getDemoLabel('usageTime', STATE.demographics.usageTime),
    new Date().toLocaleString('zh-CN')
  ];
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) summaryRow.push(STATE.answers[i] || '');
  const ws3 = XLSX.utils.aoa_to_sheet([summaryHeaders, summaryRow]);
  ws3['!cols'] = summaryHeaders.map(h => ({ wch: h.length > 8 ? 14 : 10 }));
  XLSX.utils.book_append_sheet(wb, ws3, '数据汇总');

  const filename = `新媒体价值观调查_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Excel 文件已导出，感谢您的参与！');
}

function exportAsCsv() {
  let csv = '﻿性别,年级,专业类别,每日使用时长,提交时间';
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) csv += ',Q' + i;
  csv += '\n';
  csv += [
    getDemoLabel('gender', STATE.demographics.gender),
    getDemoLabel('grade', STATE.demographics.grade),
    getDemoLabel('major', STATE.demographics.major),
    getDemoLabel('usageTime', STATE.demographics.usageTime),
    new Date().toLocaleString('zh-CN')
  ].join(',');
  for (let i = 1; i <= TOTAL_QUESTIONS; i++) csv += ',' + (STATE.answers[i] || '');
  csv += '\n';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `新媒体价值观调查_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 CSV 文件（可用 Excel 打开）');
}

function getDemoLabel(field, value) {
  const labels = {
    gender: { male: '男', female: '女', other: '其他' },
    grade: { freshman: '大一', sophomore: '大二', junior: '大三', senior: '大四', postgrad: '研究生' },
    major: {
      arts: '文科', science: '理科', engineering: '工科', medicine: '医学',
      arts_design: '艺术/设计/体育', business: '经管', law: '法学',
      education: '教育学', agriculture: '农学', other: '其他'
    },
    usageTime: { less1h: '<1小时', '1-3h': '1-3小时', '3-5h': '3-5小时', '5-8h': '5-8小时', over8h: '>8小时' }
  };
  return (labels[field] && labels[field][value]) || value || '未填写';
}

// ==================== 初始化 ====================
function init() {
  const hasPrevious = restoreFromStorage();

  initWelcome();
  initDemographics();
  initQuestions();
  initCompletion();

  if (hasPrevious) {
    if (STATE.currentView === 'demographics') {
      showPage('demographics');
    } else if (STATE.currentView === 'questions') {
      renderQuestionPage(STATE.currentQuestionPage);
      showPage('questions');
    } else if (STATE.currentView === 'complete') {
      renderCompletion();
      showPage('complete');
    }
  } else {
    showPage('welcome');
  }
}

document.addEventListener('DOMContentLoaded', init);
