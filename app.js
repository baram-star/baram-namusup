/* ══════════════════════════════════════════════
   바람나무숲 홈페이지 — 공통 스크립트
   데이터 원칙(기획서 §1): 콘텐츠는 한 곳에서 관리하고 홈페이지·앱이 함께 읽는다
   - 공지·바람생각 글: Supabase (앱과 동일 프로젝트, 공개 읽기 키)
   - 세미나일정·읽기자료: 구글시트 → Apps Script (앱과 동일 엔드포인트)
   ══════════════════════════════════════════════ */

/* 설정값(SITE)은 config.js에 있습니다 — 모든 페이지에서 app.js보다 먼저 불러옵니다. */

/* ── 모바일 메뉴 ── */
function toggleMenu() {
  document.querySelector('.gnb').classList.toggle('open');
}

/* ── Supabase REST 읽기 (라이브러리 없이 fetch만 사용) ── */
async function sbSelect(path) {
  const res = await fetch(`${SITE.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: SITE.supabaseKey, Authorization: `Bearer ${SITE.supabaseKey}` },
  });
  if (!res.ok) throw new Error('supabase ' + res.status);
  return res.json();
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── 홈: 공지 최근 3건 ── */
async function loadNotices(limit = 3) {
  const el = document.getElementById('notice-list');
  if (!el) return;
  try {
    const data = await sbSelect(
      `notices?select=title,display_date,created_at,is_pinned&order=is_pinned.desc,created_at.desc&limit=${limit}`);
    if (!data.length) { el.innerHTML = '<div class="empty-msg">등록된 공지가 없습니다.</div>'; return; }
    el.innerHTML = data.map(n => `
      <div class="notice-item">
        <span>${n.is_pinned ? '📌 ' : ''}${esc(n.title)}</span>
        <span class="date">${esc(n.display_date) || fmtDate(n.created_at)}</span>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<div class="empty-msg">공지를 불러오지 못했습니다.</div>'; }
}

/* ── 홈·교육저널: 최근 글 ── */
async function loadPosts(elId, limit = 4, category = null) {
  const el = document.getElementById(elId);
  if (!el) return;
  try {
    let path = `blog_posts?select=id,title,category,created_at,content&published=eq.true&order=created_at.desc&limit=${limit}`;
    if (category) path += `&category=eq.${encodeURIComponent(category)}`;
    const data = await sbSelect(path);
    if (!data.length) { el.innerHTML = '<div class="empty-msg">아직 작성된 글이 없습니다.</div>'; return; }
    el.innerHTML = data.map(p => `
      <div class="post-card">
        <div class="post-cat">${esc(p.category)}</div>
        <div class="post-title">${esc(p.title)}</div>
        ${p.content ? `<div class="post-date">${esc(p.content.substring(0, 90))}${p.content.length > 90 ? '…' : ''}</div>` : ''}
        <div class="post-date">${fmtDate(p.created_at)}</div>
      </div>`).join('');
  } catch (e) { el.innerHTML = '<div class="empty-msg">글을 불러오지 못했습니다.</div>'; }
}

/* ── 인문학교실: 세미나일정·읽기자료 (시트) ── */
async function loadAcademyData() {
  const scheduleEl = document.getElementById('academy-schedule-list');
  const materialsEl = document.getElementById('academy-materials-list');
  if (!scheduleEl && !materialsEl) return;
  try {
    const res = await fetch(SITE.scriptUrl + '?type=schedule');
    const data = await res.json();
    if (scheduleEl && data.schedule?.length) {
      scheduleEl.innerHTML = data.schedule.map(item => `
        <div class="link-item">
          <div class="link-icon">🗓️</div>
          <div>
            <div class="link-name">${esc(item.title)}</div>
            <div class="link-sub">${esc(item.date)}${item.note ? ' · ' + esc(item.note) : ''}</div>
          </div>
        </div>`).join('');
    }
    if (materialsEl && data.materials?.length) {
      materialsEl.innerHTML = data.materials.map(item => `
        <a class="link-item" ${item.url ? `href="${esc(item.url)}" target="_blank" rel="noopener"` : ''}>
          <div class="link-icon">📄</div>
          <div>
            <div class="link-name">${esc(item.title)}</div>
            <div class="link-sub">${esc(item.desc)}</div>
          </div>
          ${item.url ? '<span class="link-arrow">›</span>' : ''}
        </a>`).join('');
    }
  } catch (e) { /* 실패 시 기본 문구 유지 */ }
}

/* ── 구글 시트 읽기 (시트 ID를 인자로 받는 일반 함수) ──
   시트는 '링크가 있는 모든 사용자 보기'로 공유되어 있어야 합니다.
   첫 줄을 머리글로 보고 [{머리글: 값}, ...] 배열을 돌려줍니다. */
async function loadSheet(sheetId, tabName) {
  if (!sheetId) return [];
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('sheet ' + res.status);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const cols = json.table.cols.map(c => c.label);
  return json.table.rows.map(r => {
    const o = {};
    cols.forEach((c, i) => { const cell = r.c[i]; o[c] = cell ? (cell.f ?? cell.v ?? '') : ''; });
    return o;
  });
}

/* ── 자주국어: 개강 일정 (시트 「자주국어 운영」 › 개강일정 탭) ──
   시트 ID가 없거나 읽기 실패 시 HTML에 적힌 기본 표를 그대로 둡니다. */
async function loadJajuSchedule() {
  const el = document.getElementById('jaju-schedule-body');
  if (!el || !SITE.jajuSheetId) return;
  try {
    const rows = await loadSheet(SITE.jajuSheetId, '개강일정');
    if (!rows.length) return;
    el.innerHTML = rows.map(r => `
      <tr><th>${esc(r['과정'])}</th><td>${esc(r['대상'])}</td><td>${esc(r['개강'])}</td></tr>`).join('');
  } catch (e) { /* 기본 표 유지 */ }
}

/* ── 자주국어: 상담 신청 폼 ──
   전송처는 SITE.jajuScriptUrl 하나뿐입니다. 값이 비어 있으면 폼을 숨기고 전화·카카오 안내를 보여 줍니다. */
function initJajuApply() {
  const form = document.getElementById('jaju-apply-form');
  const fallback = document.getElementById('jaju-apply-fallback');
  if (!form && !fallback) return;

  // 전화·카카오 버튼 채우기
  document.querySelectorAll('[data-jaju-tel]').forEach(a => {
    a.href = 'tel:' + SITE.jajuPhone.replace(/[^0-9]/g, '');
    a.textContent = a.dataset.jajuTel.replace('{phone}', SITE.jajuPhone);
  });
  document.querySelectorAll('[data-jaju-kakao]').forEach(a => {
    if (SITE.jajuKakaoUrl) { a.href = SITE.jajuKakaoUrl; a.target = '_blank'; a.rel = 'noopener'; }
    else { a.removeAttribute('href'); a.classList.add('is-disabled'); a.textContent = '카카오톡 채널 준비 중'; }
  });

  if (!SITE.jajuScriptUrl) {
    if (form) form.hidden = true;
    if (fallback) fallback.hidden = false;
    return;
  }
  if (fallback) fallback.hidden = true;
  if (!form) return;
  form.hidden = false;

  const msg = document.getElementById('jaju-apply-msg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const courses = fd.getAll('course');
    if (!fd.get('parent_name')?.trim() || !fd.get('phone')?.trim() || !fd.get('grade')) {
      msg.textContent = '학부모 이름, 연락처, 자녀 학년을 입력해 주십시오.'; return;
    }
    if (!courses.length) { msg.textContent = '관심 과정을 하나 이상 골라 주십시오.'; return; }
    if (!fd.get('agree')) { msg.textContent = '개인정보 수집·이용에 동의해 주십시오.'; return; }

    const body = new URLSearchParams({
      type: 'jaju_consult',
      parent_name: fd.get('parent_name').trim(),
      phone: fd.get('phone').trim(),
      grade: fd.get('grade'),
      courses: courses.join(', '),
      preferred_time: fd.get('preferred_time') || '',
      memo: (fd.get('memo') || '').trim(),
      agree: 'Y',
      submitted_at: new Date().toISOString(),
    });
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; msg.textContent = '보내는 중…';
    try {
      // Apps Script 웹 앱은 다른 도메인이라 응답을 읽지 않는 방식(no-cors)으로 보냅니다.
      await fetch(SITE.jajuScriptUrl, { method: 'POST', mode: 'no-cors', body });
      form.reset();
      msg.textContent = '신청이 접수되었습니다. 확인 후 연락드리겠습니다.';
    } catch (err) {
      msg.textContent = '전송하지 못했습니다. 전화로 문의해 주십시오.';
    } finally {
      btn.disabled = false;
    }
  });
}

/* ── 초기화: 페이지에 존재하는 요소만 채운다 ── */
document.addEventListener('DOMContentLoaded', () => {
  loadNotices();
  loadPosts('post-list', 4);
  loadPosts('journal-list', 30);
  loadAcademyData();
  loadJajuSchedule();
  initJajuApply();
});
