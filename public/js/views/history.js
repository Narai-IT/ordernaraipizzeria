// ใบเบิกของร้าน 60 วันล่าสุด — สถานะมาจาก POS (Ord_Rcv): รอรับของ / รับของแล้ว

import { h, modal, thDate, fmtQty, pill, shopCode } from '../ui.js';
import { api } from '../api.js';

export async function renderHistory(root, session) {
  const page = h('div', { class: 'page' }, h('div', { class: 'empty' }, 'กำลังโหลดใบเบิก…'));
  root.replaceChildren(page);

  let orders;
  try {
    ({ orders } = await api.orders());
  } catch (e) {
    page.replaceChildren(h('div', { class: 'empty' }, h('p', {}, e.message),
      h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => renderHistory(root, session) }, 'ลองใหม่')));
    return;
  }
  const waiting = orders.filter((o) => !o.received);

  const open = async (o) => {
    const m = modal(`ใบเบิกเลขที่ ${o.no}`, () => [[h('div', { class: 'empty', id: 'doc-detail' }, 'กำลังโหลด…')], null],
      { subtitle: `สั่ง ${thDate(o.orderDate)} · รับ ${thDate(o.deldate, { dow: true })}` });
    try {
      const { items } = await api.order(o.no);
      document.getElementById('doc-detail')?.replaceWith(h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'สินค้า'), h('th', { class: 'r' }, 'จำนวน'))),
        h('tbody', {}, items.map((it) => h('tr', {},
          h('td', { class: 'mono muted' }, it.seq),
          h('td', { class: 'wrap' }, h('span', { class: 'mono muted' }, it.itemCode), ' ', it.itemName),
          h('td', { class: 'r mono' }, `${fmtQty(it.qty)} ${it.unit || ''}`)))))));
    } catch (e) {
      m.close();
      throw e;
    }
  };

  page.replaceChildren(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'ใบเบิกของร้าน'), h('p', {}, 'ย้อนหลัง 60 วัน ข้อมูลจากระบบ POS')),
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, waiting.length), h('span', {}, 'รอรับของ')),
        h('div', { class: 'stat' }, h('b', {}, orders.length), h('span', {}, 'ใบเบิกทั้งหมด')),
        h('div', { class: 'stat' }, shopCode(session.shopNo, session.code)))),
    orders.length
      ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'เลขที่'), h('th', {}, 'วันที่สั่ง'), h('th', {}, 'วันที่รับ'),
          h('th', { class: 'r' }, 'รายการ'), h('th', { class: 'r' }, 'จำนวนรวม'), h('th', {}, 'สถานะ'))),
        h('tbody', {}, orders.map((o) => h('tr', {
          class: 'click', tabindex: '0',
          onclick: () => open(o),
          onkeydown: (e) => { if (e.key === 'Enter') open(o); },
        },
        h('td', { class: 'mono' }, h('b', {}, o.no)),
        h('td', {}, thDate(o.orderDate)),
        h('td', {}, thDate(o.deldate, { dow: true })),
        h('td', { class: 'r mono' }, o.itemCount),
        h('td', { class: 'r mono' }, fmtQty(o.totalQty)),
        h('td', {}, o.received ? pill('ok', 'รับของแล้ว') : pill('wait', 'รอรับของ')))))))
      : h('div', { class: 'empty' }, 'ยังไม่มีใบเบิกในช่วง 60 วันที่ผ่านมา'));
}
