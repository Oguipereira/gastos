/** '2026-12' (input month) <-> '2026-12-01' */
export const toMonthInput = (iso: string) => iso.slice(0, 7)
export const fromMonthInput = (v: string) => (v ? `${v}-01` : '')
export const parseMoney = (v: string) => {
  const s = String(v).trim()
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : 0
}
