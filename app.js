/* ══════════════════════════════════════════════
   자주국어 홈페이지 — 공통 스크립트
   이 홈페이지는 자주국어 대문입니다. 바람나무숲 교육연구소의 공지·글·일정은 바람나무숲 앱에서 관리합니다.
   자주국어 데이터는 자주국어 계정의 시트·Apps Script만 씁니다(config.js).
   ══════════════════════════════════════════════ */

/* 설정값(SITE)은 config.js에 있습니다 — 모든 페이지에서 app.js보다 먼저 불러옵니다. */

/* ── 모바일 메뉴 ── */
function toggleMenu() {
  document.querySelector('.gnb').classList.toggle('open');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

/* ── 자주국어: 개강 일정 (시트 「자주국어 운영」 › 개강일정 탭, 열: 기간 · 시기 · 회차) ──
   시트 ID가 없거나 읽기 실패 시 HTML에 적힌 기본 표를 그대로 둡니다. */
async function loadJajuSchedule() {
  const el = document.getElementById('jaju-schedule-body');
  if (!el || !SITE.jajuSheetId) return;
  try {
    const rows = await loadSheet(SITE.jajuSheetId, '개강일정');
    if (!rows.length) return;
    el.innerHTML = rows.map(r => `
      <tr><th>${esc(r['기간'])}</th><td>${esc(r['시기'])}</td><td>${esc(r['회차'])}</td></tr>`).join('');
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
  loadJajuSchedule();
  initJajuApply();
});
