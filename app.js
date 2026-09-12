/* ══════════════════════════════════════════════
   바람나무숲 홈페이지 — 공통 스크립트
   데이터 원칙(기획서 §1): 콘텐츠는 한 곳에서 관리하고 홈페이지·앱이 함께 읽는다
   - 공지·바람생각 글: Supabase (앱과 동일 프로젝트, 공개 읽기 키)
   - 세미나일정·읽기자료: 구글시트 → Apps Script (앱과 동일 엔드포인트)
   ══════════════════════════════════════════════ */

const SITE = {
  appUrl: 'https://baram-connect.vercel.app',
  supabaseUrl: 'https://rdkuqqrkxwqakllncyaq.supabase.co',
  supabaseKey: 'sb_publishable_xlzcfl2PWvEjGY_SIb2O2Q_GJhtkhHy',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxamYg-5tRQ435kAoWkStSpCOQ0l9Vch-s-1QoU-CoyhBr64p2dtGIX_-lKhZDLc_qF/exec',
};

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

/* ── 초기화: 페이지에 존재하는 요소만 채운다 ── */
document.addEventListener('DOMContentLoaded', () => {
  loadNotices();
  loadPosts('post-list', 4);
  loadPosts('journal-list', 30);
  loadAcademyData();
});
