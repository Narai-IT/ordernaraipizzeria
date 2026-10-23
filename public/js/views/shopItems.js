// ตั้งรายการสินค้าที่ร้านเบิกได้ (ผู้ดูแล) — ติ๊กเลือกเอง / เลือกตามสต๊อกสาขา / นำเข้าจาก Excel
//
// ไฟล์ Excel ที่รับ:
//   - มีคอลัมน์หัวว่า "รหัส..." (หรือ code) — ไม่มีหัวแบบนี้ใช้คอลัมน์ A
//   - ถ้ามีคอลัมน์ "เบิกได้" ด้วย เอาเฉพาะแถวที่ใส่ Y / 1 / ✓ / ใช่ (ไฟล์ที่กด "ดาวน์โหลด Excel" จากหน้านี้เป็นแบบนี้)
//     ไม่มีคอลัมน์นี้ = ทุกรหัสในไฟล์คือรายการที่เบิกได้
// นำเข้าแล้วยังไม่บันทึก — ผู้ดูแลตรวจในรายการก่อนแล้วค่อยกดบันทึก

import { h, modal, toast, busy, shopCode } from '../ui.js';
import { api } from '../api.js';
import { normCode, codesFromRows } from '../excelCodes.js';

const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxLoading;
/** SheetJS โหลดตอนต้องใช้ครั้งแรก — หน้าอื่นไม่ต้องแบกไฟล์ ~900KB */
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxLoading = null; reject(new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
    document.head.append(s);
  });
  return xlsxLoading;
}

export async function openShopItems(shop, onSaved) {
  const loading = modal(`สินค้าที่ร้าน ${shop.code} เบิกได้`, () => [[h('div', { class: 'empty' }, 'กำลังโหลดทะเบียนสินค้า…')], null], { wide: true });
  let data;
  try {
    data = await api.shopItems(shop.shopNo);
  } catch (e) {
    loading.close();
    toast(e.message, { bad: true });
    return;
  }
  loading.close();

  const items = data.items;
  const byNorm = new Map(items.map((it) => [normCode(it.code), it]));
  const picked = new Set(items.filter((it) => it.selected).map((it) => it.code));
  const original = new Set(picked);
  let term = '';
  let view = 'all';
  let cat = '';

  const cats = [...new Set(items.map((it) => it.storeCat || 'ไม่มีหมวด'))];
  const list = h('div', { class: 'pick-list' });
  const rows = new Map();
  const heads = new Map();
  const counter = h('b', { class: 'num' });
  const notice = h('div', { hidden: true });

  for (const c of cats) {
    const box = h('input', { type: 'checkbox', 'aria-label': `เลือกทั้งหมวด ${c}` });
    box.addEventListener('change', () => {
      for (const r of rows.values()) if (r.cat === c && !r.row.hidden) setPick(r.it.code, box.checked);
      refresh();
    });
    const head = h('label', { class: 'pick-head' }, box, h('span', { class: 'label' }, c), h('span', { class: 'muted n' }));
    heads.set(c, { head, box });
    list.append(head);
    for (const it of items.filter((x) => (x.storeCat || 'ไม่มีหมวด') === c)) {
      const cb = h('input', { type: 'checkbox', id: `pick-${it.code}`, checked: picked.has(it.code) });
      cb.addEventListener('change', () => { setPick(it.code, cb.checked); refresh(); });
      const row = h('label', { class: 'pick-row', for: `pick-${it.code}` }, cb,
        h('span', { class: 'mono muted' }, it.code),
        h('span', { class: 'nm' }, it.name, it.inBranch ? h('span', { class: 'tag tag-branch', title: 'ผูกกับสาขานี้ในสต๊อกสาขา' }, 'สต๊อกสาขา') : null),
        h('span', { class: 'muted' }, it.unit));
      rows.set(it.code, { row, cb, it, cat: c });
      list.append(row);
    }
  }

  function setPick(code, on) {
    if (on) picked.add(code); else picked.delete(code);
    const r = rows.get(code);
    if (r) r.cb.checked = on;
  }

  function refresh() {
    const t = term.trim().toLowerCase();
    const shownIn = new Map();
    for (const r of rows.values()) {
      const on = picked.has(r.it.code);
      const hit = (!t || r.it.code.toLowerCase().includes(t) || r.it.name.toLowerCase().includes(t))
        && (view === 'all' || (view === 'on' ? on : !on))
        && (!cat || r.cat === cat);
      r.row.hidden = !hit;
      r.row.classList.toggle('on', on);
      if (hit) {
        const s = shownIn.get(r.cat) || { n: 0, on: 0 };
        s.n += 1;
        if (on) s.on += 1;
        shownIn.set(r.cat, s);
      }
    }
    for (const [c, { head, box }] of heads) {
      const s = shownIn.get(c);
      head.hidden = !s;
      if (!s) continue;
      box.checked = s.on === s.n;
      box.indeterminate = s.on > 0 && s.on < s.n;
      head.querySelector('.n').textContent = `${s.on}/${s.n}`;
    }
    const added = [...picked].filter((c) => !original.has(c)).length;
    const removed = [...original].filter((c) => !picked.has(c)).length;
    counter.textContent = `เลือก ${picked.size} จาก ${items.length} รายการ`
      + (added || removed ? ` · เพิ่ม ${added} ลบ ${removed} (ยังไม่บันทึก)` : '');
  }

  // ---------- Excel ----------
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const XLSX = await loadXlsx();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const { codes, mode } = codesFromRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }));
      if (!codes.length) throw new Error('ไม่พบรหัสสินค้าในไฟล์ (ต้องมีคอลัมน์ "รหัสสินค้า" หรือรหัสอยู่ในคอลัมน์ A)');
      const found = codes.map((c) => byNorm.get(normCode(c))).filter(Boolean);
      const missing = codes.filter((c) => !byNorm.has(normCode(c)));
      showImport(file.name, mode, found, missing);
    } catch (e) {
      toast(e.message, { bad: true, ms: 6000 });
    }
  });

  function showImport(name, mode, found, missing) {
    const apply = (replace) => {
      if (replace) for (const c of [...picked]) setPick(c, false);
      for (const it of found) setPick(it.code, true);
      notice.hidden = true;
      view = 'on';
      viewSel.value = 'on';
      refresh();
      toast(`นำเข้า ${found.length} รายการแล้ว ตรวจแล้วกดบันทึก`);
    };
    notice.className = 'import-box';
    notice.hidden = false;
    notice.replaceChildren(
      h('div', {}, h('b', {}, name), ' · ',
        mode === 'flag' ? 'ใช้แถวที่คอลัมน์ "เบิกได้" ใส่ Y' : 'ใช้ทุกรหัสในไฟล์'),
      h('div', {}, `ตรงกับทะเบียน ${found.length} รายการ`,
        missing.length ? h('span', { class: 'err' }, ` · ไม่พบในทะเบียน ${missing.length} รหัส: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}`) : ''),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn btn-primary btn-sm', disabled: !found.length, onclick: () => apply(true) }, 'แทนที่รายการเดิมทั้งหมด'),
        h('button', { class: 'btn btn-sm', disabled: !found.length, onclick: () => apply(false) }, 'เพิ่มจากที่เลือกอยู่'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { notice.hidden = true; } }, 'ยกเลิก')));
  }

  async function exportExcel(btn) {
    await busy(btn, async () => {
      try {
        const XLSX = await loadXlsx();
        const aoa = [['รหัสสินค้า', 'ชื่อสินค้า', 'หน่วย', 'หมวดสโตร์', 'เบิกได้']]
          .concat(items.map((it) => [it.code, it.name, it.unit, it.storeCat, picked.has(it.code) ? 'Y' : '']));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 8 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, shop.code);
        XLSX.writeFile(wb, `รายการเบิก-${shop.code}.xlsx`);
      } catch (e) {
        toast(e.message, { bad: true });
      }
    });
  }

  // ---------- เครื่องมือ ----------
  const search = h('input', {
    id: 'pick-search', class: 'input', type: 'search', placeholder: 'ค้นหารหัสหรือชื่อสินค้า',
    oninput: () => { term = search.value; refresh(); },
  });
  const viewSel = h('select', { id: 'pick-view', class: 'input', onchange: () => { view = viewSel.value; refresh(); } },
    h('option', { value: 'all' }, 'ทั้งหมด'), h('option', { value: 'on' }, 'ที่เลือกแล้ว'), h('option', { value: 'off' }, 'ที่ยังไม่เลือก'));
  const catSel = h('select', { id: 'pick-cat', class: 'input', onchange: () => { cat = catSel.value; refresh(); } },
    h('option', { value: '' }, 'ทุกหมวด'), cats.map((c) => h('option', { value: c }, c)));
  const branchCount = items.filter((it) => it.inBranch).length;

  modal(`สินค้าที่ร้าน ${shop.code} เบิกได้`, (close) => {
    const save = h('button', { class: 'btn btn-primary', onclick: () => busy(save, async () => {
      try {
        const res = await api.setShopItems(shop.shopNo, [...picked]);
        toast(res.message || `บันทึก ${res.count} รายการแล้ว`);
        if (res.unknown?.length) toast(`ไม่พบในทะเบียน ${res.unknown.length} รหัส ไม่ได้บันทึก`, { bad: true, ms: 6000 });
        onSaved?.(res.count);
        close();
      } catch (e) {
        toast(e.message, { bad: true, ms: 6000 });
      }
    }) }, 'บันทึกรายการ');
    return [[
      h('div', { class: 'preview-code' }, shopCode(shop.shopNo, shop.code), h('span', {}, shop.name)),
      h('div', { class: 'toolbar' },
        h('button', { class: 'btn btn-sm', onclick: () => fileInput.click() }, 'นำเข้าจาก Excel'),
        h('button', { class: 'btn btn-sm', onclick: (e) => exportExcel(e.currentTarget) }, 'ดาวน์โหลด Excel'),
        branchCount ? h('button', {
          class: 'btn btn-sm', title: 'เลือกเฉพาะสินค้าที่ผูกกับสาขานี้ในสต๊อกสาขา (คอลัมน์ J ของชีท item)',
          onclick: () => {
            for (const c of [...picked]) setPick(c, false);
            for (const it of items) if (it.inBranch) setPick(it.code, true);
            refresh();
          },
        }, `เลือกตามสต๊อกสาขา (${branchCount})`) : null,
        fileInput),
      h('p', { class: 'muted', style: 'font-size:.85rem' },
        'ไฟล์ Excel: ใส่รหัสสินค้าในคอลัมน์ที่หัวว่า "รหัสสินค้า" หรือคอลัมน์ A · หรือกด "ดาวน์โหลด Excel" แล้วใส่ Y ในคอลัมน์ "เบิกได้" แล้วนำเข้ากลับมา'),
      notice,
      h('div', { class: 'toolbar pick-filters' }, search, viewSel, catSel),
      list,
    ], [h('span', { class: 'muted', style: 'margin-right:auto' }, counter),
      h('button', { class: 'btn', onclick: close }, 'ยกเลิก'), save]];
  }, { wide: true, subtitle: 'ร้านจะเห็นและเบิกได้เฉพาะสินค้าที่เลือกไว้ที่นี่' });
  refresh();
}
