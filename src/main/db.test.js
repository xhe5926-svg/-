// 数据库模块测试（db.js）
// 用内存假账本（:memory:）测试，不碰用户真实的账本文件，每道题开头都是全新空账本
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  initDatabase,
  close,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  addTransaction,
  getMonthTransactions,
  getMonthSummary,
  getTrend,
  getCategoryBreakdown,
  getDailyExpense,
  getBudget,
  setBudget
} from './db'

beforeEach(() => {
  initDatabase(':memory:')
})

afterEach(() => {
  close()
})

// —— 预置分类 ——
describe('预置分类（产品文档 2.2 节的 74 个分类）', () => {
  it('共 74 个：支出 10 大类 + 52 小类，收入 3 大类 + 9 小类', () => {
    const cats = getCategories()
    const isParent = (c) => c.parentId === null
    const expense = cats.filter((c) => c.type === 'expense')
    const income = cats.filter((c) => c.type === 'income')
    expect(cats).toHaveLength(74)
    expect(expense.filter(isParent)).toHaveLength(10)
    expect(expense.filter((c) => !isParent(c))).toHaveLength(52)
    expect(income.filter(isParent)).toHaveLength(3)
    expect(income.filter((c) => !isParent(c))).toHaveLength(9)
  })
})

// —— 新增分类 ——
describe('addCategory 新增分类', () => {
  it('空名字被拒绝', () => {
    expect(addCategory({ type: 'expense', name: '   ' }).ok).toBe(false)
  })
  it('超过 20 个字被拒绝', () => {
    expect(addCategory({ type: 'expense', name: '这'.repeat(21) }).ok).toBe(false)
  })
  it('刚好 20 个字可以', () => {
    expect(addCategory({ type: 'expense', name: '这'.repeat(20) }).ok).toBe(true)
  })
  it('在大类下加小类成功，且能查到', () => {
    const parent = getCategories().find((c) => c.type === 'expense' && c.parentId === null)
    const r = addCategory({ type: 'expense', name: '新小类', parentId: parent.id })
    expect(r.ok).toBe(true)
    expect(getCategories().some((c) => c.name === '新小类' && c.parentId === parent.id)).toBe(true)
  })
  it('小类下不能再挂小类', () => {
    const child = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    expect(addCategory({ type: 'expense', name: '乱挂', parentId: child.id }).ok).toBe(false)
  })
  it('大类与收支类型不匹配时被拒绝', () => {
    const incomeParent = getCategories().find((c) => c.type === 'income' && c.parentId === null)
    expect(addCategory({ type: 'expense', name: '错配', parentId: incomeParent.id }).ok).toBe(false)
  })
})

// —— 改分类名 ——
describe('updateCategory 改分类名', () => {
  it('预置分类不能改名', () => {
    const preset = getCategories().find((c) => c.isCustom === 0)
    expect(updateCategory(preset.id, { name: '新名字' }).ok).toBe(false)
  })
  it('自己创建的分类可以改名，改名后能查到', () => {
    const r = addCategory({ type: 'expense', name: '我的分类' })
    expect(r.ok).toBe(true)
    expect(updateCategory(r.id, { name: '改过的名字' }).ok).toBe(true)
    expect(getCategories().find((c) => c.id === r.id).name).toBe('改过的名字')
  })
})

// —— 删除分类（产品文档 2.2 的删除保护规则）——
describe('deleteCategory 删除分类', () => {
  it('预置分类不能删除', () => {
    const preset = getCategories().find((c) => c.isCustom === 0)
    expect(deleteCategory(preset.id).ok).toBe(false)
  })
  it('大类下还有小类时不能删除', () => {
    const parent = addCategory({ type: 'expense', name: '新大类' })
    addCategory({ type: 'expense', name: '新小类', parentId: parent.id })
    expect(deleteCategory(parent.id).ok).toBe(false)
  })
  it('已有账单记录的分类不能删除', () => {
    const cat = addCategory({ type: 'expense', name: '临时分类' })
    addTransaction({ type: 'expense', amountCents: 100, categoryId: cat.id, note: '', date: '2026-08-01' })
    expect(deleteCategory(cat.id).ok).toBe(false)
  })
  it('空的自建分类可以删除', () => {
    const cat = addCategory({ type: 'expense', name: '要删的分类' })
    expect(deleteCategory(cat.id).ok).toBe(true)
  })
})

// —— 记账：新增与按月查询 ——
describe('addTransaction / getMonthTransactions 记账与查询', () => {
  it('新增账单后按月份能查到，字段齐全', () => {
    const cat = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    const id = addTransaction({
      type: 'expense',
      amountCents: 500,
      categoryId: cat.id,
      note: '早餐',
      date: '2026-08-17'
    })
    const list = getMonthTransactions('2026-08')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(id)
    expect(list[0].amountCents).toBe(500)
    expect(list[0].note).toBe('早餐')
    expect(list[0].categoryName).toBe(cat.name)
  })
  it('其他月份查不到这笔', () => {
    const cat = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    addTransaction({ type: 'expense', amountCents: 500, categoryId: cat.id, note: '', date: '2026-08-17' })
    expect(getMonthTransactions('2026-07')).toHaveLength(0)
  })
})

// —— 月度收支合计 ——
describe('getMonthSummary 月度收支合计', () => {
  it('只合计该月的支出和收入，不串月', () => {
    const expCat = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    const incCat = getCategories().find((c) => c.type === 'income' && c.parentId !== null)
    addTransaction({ type: 'expense', amountCents: 1000, categoryId: expCat.id, note: '', date: '2026-08-01' })
    addTransaction({ type: 'expense', amountCents: 500, categoryId: expCat.id, note: '', date: '2026-08-15' })
    addTransaction({ type: 'income', amountCents: 8000, categoryId: incCat.id, note: '', date: '2026-08-10' })
    addTransaction({ type: 'expense', amountCents: 9999, categoryId: expCat.id, note: '', date: '2026-07-30' })
    const s = getMonthSummary('2026-08')
    expect(s.expense).toBe(1500)
    expect(s.income).toBe(8000)
  })
})

// —— 趋势 ——
describe('getTrend 近 N 个月趋势', () => {
  it('默认返回最近 6 个月，每月含收支字段', () => {
    const trend = getTrend()
    expect(trend).toHaveLength(6)
    for (const m of trend) {
      expect(m).toHaveProperty('month')
      expect(m).toHaveProperty('expense')
      expect(m).toHaveProperty('income')
    }
  })
  it('当月有支出时趋势里能体现', () => {
    const cat = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    addTransaction({ type: 'expense', amountCents: 777, categoryId: cat.id, note: '', date: `${ym}-01` })
    const thisMonth = getTrend().find((m) => m.month === ym)
    expect(thisMonth.expense).toBe(777)
  })
})

// —— 分类占比饼图 ——
describe('getCategoryBreakdown 分类占比', () => {
  it('按一级大类汇总该月支出', () => {
    const food = getCategories().find((c) => c.type === 'expense' && c.parentId === null && c.name === '餐饮')
    const child = getCategories().find((c) => c.parentId === food.id)
    addTransaction({ type: 'expense', amountCents: 1200, categoryId: child.id, note: '', date: '2026-08-03' })
    expect(getCategoryBreakdown('2026-08')).toEqual([{ name: '餐饮', total: 1200 }])
  })
})

// —— 每日支出柱状图 ——
describe('getDailyExpense 每日支出', () => {
  it('同一天的多笔支出合并成一笔', () => {
    const cat = getCategories().find((c) => c.type === 'expense' && c.parentId !== null)
    addTransaction({ type: 'expense', amountCents: 100, categoryId: cat.id, note: '', date: '2026-08-05' })
    addTransaction({ type: 'expense', amountCents: 200, categoryId: cat.id, note: '', date: '2026-08-05' })
    const rows = getDailyExpense('2026-08')
    expect(rows).toHaveLength(1)
    expect(rows[0].day).toBe('05')
    expect(rows[0].total).toBe(300)
  })
  it('收入不计入每日支出', () => {
    const incCat = getCategories().find((c) => c.type === 'income' && c.parentId !== null)
    addTransaction({ type: 'income', amountCents: 9999, categoryId: incCat.id, note: '', date: '2026-08-06' })
    expect(getDailyExpense('2026-08')).toHaveLength(0)
  })
})

// —— 预算 ——
describe('预算设置与读取', () => {
  it('默认预算为 0', () => {
    expect(getBudget()).toBe(0)
  })
  it('设置后能读回来，改回 0 也正常', () => {
    setBudget(200000) // 2000 元
    expect(getBudget()).toBe(200000)
    setBudget(0)
    expect(getBudget()).toBe(0)
  })
})
