// 金额显示工具（数据库存"分"，界面显示"元"）

export function fmtMoney(cents, withSymbol = true) {
  const yuan = (cents / 100).toFixed(2)
  return withSymbol ? `¥${yuan}` : yuan
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export function currentMonth() {
  return todayStr().slice(0, 7)
}

export function monthLabel(month) {
  return `${Number(month.slice(5))}月`
}
