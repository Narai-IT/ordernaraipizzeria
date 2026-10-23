// หน้าเบิกของ — เลือกสินค้า + จำนวน + วันที่รับ แล้วส่งเป็นใบเบิก (แยกใบห้องผักให้เองตามกติกาเดิม)
//
// รายการสินค้าสร้างครั้งเดียวแล้วซ่อน/แสดงตามตัวกรอง ไม่วาดใหม่ทุกครั้งที่พิมพ์
// (วาดใหม่ = ช่องจำนวนที่กำลังพิมพ์อยู่หลุดโฟกัส)

import { h, toast, modal, busy, store, thDate, bangkokDay, fmtQty, fmtBaht, shopCode } from '../ui.js';
import { api } from '../api.js';
import { partitionOrderGroups, SPLIT_ORDER_CATEGORIES } from '../orderGroups.js';
import { navigate } from '../app.js';

const ALL = '__all__';

export async function renderOrder(root, session) {
  const draftKey = `order_draft_${session.shopNo}`;
  const draft = store.get(draftKey, { qty: {}, deldate: '' });
  const qty = new Map(Object.entries(draft.qty || {}).filter(([, q]) => Number(q) > 0).map(([c, q]) => [c, Number(q)]));
  let deldate = draft.deldate && draft.deldate >= bangkokDay(0) ? draft.deldate : bangkokDay(1);
  let cat = ALL;
  let term = '';

  const page = h('div', { class: 'page' });
  root.replaceChildren(page);
  page.append(h('div', { class: 'empty' }, 'กำลังโหลดรายการสินค้า…'));

  let items;
  try {
    ({ items } = await api.items());
  } catch (e) {
    page.replaceChildren(h('div', { class: 'empty' }, h('p', {}, e.message),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => renderOrder(root, session) }, 'ลองใหม่')));
    return;
  }
  if (!items.length) {
    page.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, 'เบิกของเข้าร้าน')),
      h('div', { class: 'items' }, h('div', { class: 'empty' },
        h('h3', {}, 'ร้านนี้ยังไม่มีรายการสินค้าที่เบิกได้'),
        h('p', { style: 'margin-top:6px' }, 'ติดต่อผู้ดูแลระบบให้ตั้งรายการสินค้าของร้าน '),
        h('p', { style: 'margin-top:10px' }, shopCode(session.shopNo, session.code), ' ', session.name))));
    store.del(draftKey);
    return;
  }
  const byCode = new Map(items.map((it) => [it.code, it]));
  for (const c of [...qty.keys()]) if (!byCode.has(c)) qty.delete(c);

  const saveDraft = () => store.set(draftKey, { qty: Object.fromEntries(qty), deldate });

  // ---------- รายการสินค้า ----------
  const cats = [...new Set(items.map((it) => it.storeCat || 'ไม่มีหมวด'))];
  const rows = new Map();
  const list = h('div', { class: 'items' });
  const emptyRow = h('div', { class: 'empty', hidden: true }, 'ไม่พบสินค้าที่ค้นหา');

  const step = (it) => (it.requestUnit > 0 ? it.requestUnit : 1);
  const setQty = (it, value, { round = false } = {}) => {
    let q = Math.max(0, Number(value) || 0);
    const s = step(it);
    if (round && q > 0 && s > 1 && q % s !== 0) {
      const up = Math.ceil(q / s) * s;
      toast(`${it.name} เบิกทีละ ${s} ${it.unit} — ปรับเป็น ${up}`);
      q = up;
    }
    q = Number(q.toFixed(3));
    if (q > 0) qty.set(it.code, q); else qty.delete(it.code);
    const r = rows.get(it.code);
    if (r) {
      if (document.activeElement !== r.input || round) r.input.value = q || '';
      r.row.classList.toggle('has-qty', q > 0);
    }
    saveDraft();
    renderCart();
  };

  for (const c of cats) {
    const inCat = items.filter((it) => (it.storeCat || 'ไม่มีหมวด') === c);
    const head = h('div', { class: 'cat-head' }, h('span', { class: 'label' }, c),
      SPLIT_ORDER_CATEGORIES.includes(c) ? h('span', { class: 'split' }, 'แยกเป็นใบเบิกของตัวเอง') : null);
    list.append(head);
    for (const it of inCat) {
      const input = h('input', {
        id: `q-${it.code}`, inputmode: 'decimal', 'aria-label': `จำนวนเบิก ${it.name}`, value: qty.get(it.code) || '',
        oninput: () => setQty(it, input.value),
        onchange: () => setQty(it, input.value, { round: true }),
        onkeydown: (e) => {
          if (e.key === 'Enter') { e.preventDefault(); setQty(it, input.value, { round: true }); }
        },
      });
      const row = h('div', { class: `row${qty.get(it.code) ? ' has-qty' : ''}` },
        h('span', { class: 'code' }, it.code),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'nm' }, it.name, it.planOnly ? h('span', { class: 'tag', style: 'margin-left:8px' }, 'แพลน') : null),
          h('div', { class: 'meta' },
            h('span', {}, `หน่วย ${it.unit}`),
            step(it) > 1 ? h('span', {}, `เบิกทีละ ${step(it)}`) : null,
            it.price ? h('span', {}, `฿${fmtBaht(it.price)}`) : null)),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': 'ลด', onclick: () => setQty(it, (qty.get(it.code) || 0) - step(it)) }, '−'),
          input,
          h('button', { type: 'button', 'aria-label': 'เพิ่ม', onclick: () => setQty(it, (qty.get(it.code) || 0) + step(it)) }, '+'),
          h('span', { class: 'u' }, it.unit)));
      rows.set(it.code, { row, input, it, head, cat: c });
      list.append(row);
    }
  }
  list.append(emptyRow);

  const applyFilter = () => {
    const t = term.trim().toLowerCase();
    const shownCats = new Set();
    let shown = 0;
    for (const { row, it, cat: c } of rows.values()) {
      const hit = (cat === ALL || c === cat || (cat === '__picked__' && qty.has(it.code)))
        && (!t || it.code.toLowerCase().includes(t) || it.name.toLowerCase().includes(t));
      row.hidden = !hit;
      if (hit) { shown += 1; shownCats.add(c); }
    }
    for (const { head, cat: c } of rows.values()) head.hidden = !shownCats.has(c);
    emptyRow.hidden = shown > 0;
  };

  const chip = (key, label, n) => h('button', {
    class: 'chip', 'aria-pressed': String(cat === key),
    onclick: (e) => {
      cat = key;
      chips.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      applyFilter();
    },
  }, label, n !== undefined ? h('span', { class: 'n' }, n) : null);
  const chips = h('div', { class: 'chips' }, chip(ALL, 'ทั้งหมด', items.length),
    chip('__picked__', 'ที่เลือกแล้ว'),
    cats.map((c) => chip(c, c, items.filter((it) => (it.storeCat || 'ไม่มีหมวด') === c).length)));
  const search = h('input', {
    id: 'order-search', class: 'input', type: 'search', placeholder: 'ค้นหารหัสหรือชื่อสินค้า',
    oninput: () => { term = search.value; applyFilter(); },
  });

  // ---------- ตะกร้าใบเบิก ----------
  const cartBody = h('div', { class: 'cart-body' });
  const cartSum = h('div', { class: 'cart-sum' });
  const sendBtn = h('button', { class: 'btn btn-cta btn-block', onclick: () => confirmSend() }, 'ตรวจทานและส่งใบเบิก');
  const dateInput = h('input', {
    id: 'order-deldate', class: 'input', type: 'date', value: deldate, min: bangkokDay(0), max: bangkokDay(30),
    onchange: () => { deldate = dateInput.value; saveDraft(); renderCart(); },
  });
  const dateHint = h('small', {});
  const cart = h('aside', { class: 'cart', 'aria-label': 'ใบเบิกที่กำลังทำ' },
    h('div', { class: 'cart-head' },
      h('div', { class: 'docline' }, h('h3', {}, 'ใบเบิก'), shopCode(session.shopNo, session.code)),
      h('label', { class: 'field' }, h('span', {}, 'วันที่รับสินค้า'), dateInput, dateHint)),
    cartBody,
    h('div', { class: 'cart-foot' }, cartSum, sendBtn,
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
        if (!qty.size) return;
        modal('ล้างรายการทั้งหมด?', (close) => [
          h('p', {}, `รายการที่เลือกไว้ ${qty.size} รายการจะถูกล้าง`),
          [h('button', { class: 'btn', onclick: close }, 'ยกเลิก'),
            h('button', { class: 'btn btn-cta', onclick: () => {
              for (const c of [...qty.keys()]) setQty(byCode.get(c), 0);
              close();
            } }, 'ล้างรายการ')],
        ]);
      } }, 'ล้างรายการ')));
  const mobileCount = h('span', { class: 'count-badge' }, '0');
  const mobileBar = h('div', { class: 'mobile-bar' },
    h('div', {}, h('div', { style: 'font-weight:500' }, 'ใบเบิก ', mobileCount), h('small', { class: 'muted' }, '')),
    h('button', { class: 'btn btn-cta', onclick: () => cart.classList.toggle('open') }, 'ดูใบเบิก'));

  function selectedLines() {
    return [...qty].map(([code, q]) => ({ ...byCode.get(code), qty: q }));
  }

  function renderCart() {
    const lines = selectedLines();
    const groups = partitionOrderGroups(lines);
    cartBody.replaceChildren(...(lines.length ? groups.flatMap((g) => [
      groups.length > 1 ? h('div', { class: 'cart-group' }, `${g.label} · ${g.items.length} รายการ`) : null,
      ...g.items.map((it) => h('div', { class: 'cart-line' },
        h('span', { style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, it.name),
        h('span', { class: 'q' }, `${fmtQty(it.qty)} ${it.unit}`),
        h('button', { 'aria-label': `เอา ${it.name} ออก`, onclick: () => setQty(it, 0) }, '✕'))),
    ]) : [h('p', { class: 'empty', style: 'padding:24px 18px' }, 'ยังไม่ได้เลือกสินค้า ใส่จำนวนที่ช่องด้านซ้าย')]));
    const value = lines.reduce((t, it) => t + it.qty * (it.price || 0), 0);
    cartSum.replaceChildren(
      h('span', { class: 'muted' }, `${lines.length} รายการ${groups.length > 1 ? ` · ${groups.length} ใบ` : ''}`),
      h('b', { class: 'num' }, value ? `≈ ฿${fmtBaht(value)}` : ''));
    sendBtn.disabled = !lines.length || !deldate;
    dateHint.textContent = deldate ? `รับของ ${thDate(deldate, { dow: true })}` : 'เลือกวันที่รับสินค้า';
    mobileCount.textContent = String(lines.length);
    mobileBar.querySelector('small').textContent = deldate ? `รับ ${thDate(deldate, { dow: true })}` : '';
  }

  function confirmSend() {
    const lines = selectedLines();
    const groups = partitionOrderGroups(lines);
    modal('ยืนยันส่งใบเบิก', (close) => {
      const sendNow = h('button', { class: 'btn btn-cta', onclick: () => busy(sendNow, async () => {
        try {
          const res = await api.submit({ deldate, items: lines.map((it) => ({ code: it.code, qty: it.qty })) });
          close();
          showResult(res);
        } catch (e) {
          toast(e.message, { bad: true, ms: 6000 });
        }
      }) }, `ส่ง ${groups.length} ใบเบิก`);
      return [[
        h('div', { class: 'preview-code' }, shopCode(session.shopNo, session.code), h('span', {}, session.name)),
        h('p', {}, 'รับสินค้า ', h('b', {}, thDate(deldate, { dow: true }))),
        ...groups.map((g) => h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, g.label), h('th', { class: 'r' }, 'จำนวน'))),
          h('tbody', {}, g.items.map((it) => h('tr', {},
            h('td', { class: 'wrap' }, h('span', { class: 'mono muted' }, it.code), ' ', it.name),
            h('td', { class: 'r mono' }, `${fmtQty(it.qty)} ${it.unit}`))))))),
      ], [h('button', { class: 'btn', onclick: close }, 'กลับไปแก้'), sendNow]];
    }, { subtitle: `${lines.length} รายการ` });
  }

  function showResult(res) {
    const okDocs = res.results.filter((r) => r.ok);
    for (const r of okDocs) {
      for (const it of partitionOrderGroups(selectedLines()).find((g) => g.label === r.label)?.items || []) qty.delete(it.code);
    }
    for (const { input, row, it } of rows.values()) {
      input.value = qty.get(it.code) || '';
      row.classList.toggle('has-qty', qty.has(it.code));
    }
    saveDraft();
    renderCart();
    cart.classList.remove('open');
    modal(okDocs.length === res.results.length ? 'ส่งใบเบิกแล้ว' : 'ส่งได้บางใบ', (close) => [
      res.results.map((r) => h('div', { class: `result-doc${r.ok ? '' : ' bad'}` },
        h('div', {}, h('div', { style: 'font-weight:500' }, r.label),
          h('small', { class: r.ok ? 'muted' : 'err' }, r.ok ? `${r.count} รายการ · รับ ${thDate(r.deldate, { dow: true })}` : r.message)),
        r.ok ? h('div', { style: 'text-align:right' }, h('div', { class: 'label' }, 'เลขที่'), h('div', { class: 'docno' }, r.no)) : null)),
      [h('button', { class: 'btn', onclick: close }, 'เบิกต่อ'),
        h('button', { class: 'btn btn-primary', onclick: () => { close(); navigate('history'); } }, 'ดูใบเบิกของร้าน')],
    ]);
  }

  page.replaceChildren(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'เบิกของเข้าร้าน'),
        h('p', {}, `สินค้าที่ร้านนี้เบิกได้ ${items.length} รายการ`))),
    h('div', { class: 'order-layout' },
      h('section', { style: 'display:grid;gap:12px;min-width:0' },
        h('div', { class: 'toolbar' }, search), chips, list),
      cart),
    mobileBar);
  renderCart();
}
