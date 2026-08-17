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

// 预算提醒（记一笔页和流水页共用，避免两份逻辑改一处漏一处）
// 输入：budgetCents 本月预算（分）、spentCents 本月已支出（分）
// 输出：{ text 提醒文案, type 提示等级 }；没设预算（预算为 0）时返回空文案，不显示提醒
export function getBudgetAlert(budgetCents, spentCents) {
  if (budgetCents <= 0) return { text: '', type: 'success' }
  const pct = Math.round((spentCents / budgetCents) * 100)
  if (spentCents >= budgetCents)
    return {
      text: `本月已支出 ${fmtMoney(spentCents)}，已超支 ${fmtMoney(spentCents - budgetCents)}，注意节制哦！`,
      type: 'error'
    }
  if (pct >= 80)
    return { text: `本月已支出 ${fmtMoney(spentCents)}，已达预算的 ${pct}%，即将超支！`, type: 'warning' }
  return { text: `本月已支出 ${fmtMoney(spentCents)}，预算还剩 ${fmtMoney(budgetCents - spentCents)}`, type: 'success' }
}
