// ตัวช่วยสร้างหน้าเว็บแบบไม่ใช้ framework — h() สร้าง element, toast(), modal()

/**
 * h('div', { class: 'x', onclick }, 'ข้อความ', child)
 * props ที่ขึ้นต้นด้วย on = event · ค่า false/null = ไม่ใส่ attribute · children ซ้อน array ได้
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** ป้ายรหัสร้าน [51|SUM] */
export const shopCode = (no, code) => h('span', { class: 'shopcode', title: `รหัสร้าน ${no} · ${code}` },
  h('b', {}, no), h('i', {}, code));

export const pill = (kind, text) => h('span', { class: `pill pill-${kind}` }, text);

let toastBox;
export function toast(message, { bad = false, ms = 3500 } = {}) {
  if (!toastBox) toastBox = document.body.appendChild(h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }));
  const t = toastBox.appendChild(h('div', { class: `toast${bad ? ' bad' : ''}` }, message));
  setTimeout(() => t.remove(), ms);
}

/**
 * หน้าต่าง — คืน { close } · content เป็น function(close) ที่คืน [body, footer]
 * ปิดได้จากปุ่มในหน้าต่างหรือกด Esc — คลิกพื้นหลังจะสั่นเตือนแทน กันข้อมูลที่กรอกหาย
 */
export function modal(title, content, { subtitle, wide = false } = {}) {
  const prevFocus = document.activeElement;
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
  };
  const shake = () => {
    const box = overlay.firstChild;
    box.classList.remove('shake');
    void box.offsetWidth; // ให้แอนิเมชันเริ่มใหม่เวลากดซ้ำติดกัน
    box.classList.add('shake');
    setTimeout(() => box.classList.remove('shake'), 400);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const [body, foot] = content(close);
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) shake(); } },
    h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' },
        h('div', {}, h('h2', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: close, 'aria-label': 'ปิด' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      foot ? h('div', { class: 'modal-foot' }, foot) : null));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('input, select, button.btn-primary, button.btn-cta')?.focus();
  return { close };
}

export const spinner = () => h('span', { class: 'spinner', 'aria-hidden': 'true' });

/** ปุ่มที่กดแล้วหมุนรอจนงานเสร็จ — กันกดซ้ำตอนส่งใบเบิก */
export async function busy(btn, work) {
  const label = [...btn.childNodes];
  btn.disabled = true;
  btn.replaceChildren(spinner(), ' กำลังทำงาน…');
  try {
    return await work();
  } finally {
    btn.disabled = false;
    btn.replaceChildren(...label);
  }
}

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/** '2026-10-24' -> 'ส. 24 ต.ค. 69' */
export function thDate(ymd, { dow = false } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(ymd || ''))) return '-';
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${dow ? `${TH_DOW[wd]} ` : ''}${d} ${TH_MONTH[m - 1]} ${String(y + 543).slice(2)}`;
}

/** วันนี้ตามเวลาไทย + n วัน */
export function bangkokDay(n = 0) {
  const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 10);
  return new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

export const fmtQty = (n) => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 3 });
export const fmtBaht = (n) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** localStorage ที่ไม่พังเวลาเบราว์เซอร์บล็อก */
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ไม่เป็นไร */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* ไม่เป็นไร */ }
  },
};
