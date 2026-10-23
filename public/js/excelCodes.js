// อ่านรหัสสินค้าจากแถวของไฟล์ Excel — แยกไว้ไม่แตะ DOM เพื่อให้เทสด้วย node ได้ (test/excel.test.js)

/** รหัสสินค้าแบบเทียบกันได้ — ตัด .0 ท้าย (Excel ชอบเติม) และ 0 นำหน้า กติกาเดียวกับ item_key */
export const normCode = (c) => String(c ?? '').trim().replace(/\.0+$/, '').replace(/^0+/, '').toLowerCase();

const YES = /^(y|yes|1|true|✓|✔|x|ใช่|เบิก|เบิกได้)$/i;

/**
 * แถวของชีท (array ของ array) -> รหัสที่เบิกได้
 * @returns {{ codes: string[], mode: 'flag'|'list' }}
 */
export function codesFromRows(rows) {
  const headerAt = rows.findIndex((r) => r.some((c) => /รหัส|code/i.test(String(c))));
  const header = headerAt >= 0 ? rows[headerAt].map((c) => String(c).trim()) : [];
  const codeCol = Math.max(0, header.findIndex((c) => /รหัส|code/i.test(c)));
  const flagCol = header.findIndex((c) => /เบิกได้|allow/i.test(c));
  const body = rows.slice(headerAt + 1);
  const codes = body
    .filter((r) => flagCol < 0 || YES.test(String(r[flagCol] ?? '').trim()))
    .map((r) => String(r[codeCol] ?? '').trim())
    .filter((c) => c && /\d/.test(c));
  return { codes: [...new Set(codes)], mode: flagCol >= 0 ? 'flag' : 'list' };
}
