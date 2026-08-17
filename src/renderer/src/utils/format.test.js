// 金额显示工具测试（format.js）
// 考题：数据库里存"分"（整数），界面显示"元"——验证转换和格式化正确
import { describe, it, expect } from 'vitest'
import { fmtMoney, todayStr, currentMonth, monthLabel } from './format'

describe('fmtMoney 金额格式化（分 → 元）', () => {
  it('把 1234 分显示成 ¥12.34', () => {
    expect(fmtMoney(1234)).toBe('¥12.34')
  })
  it('0 分显示成 ¥0.00', () => {
    expect(fmtMoney(0)).toBe('¥0.00')
  })
  it('不带符号时只返回数字', () => {
    expect(fmtMoney(1234, false)).toBe('12.34')
  })
  it('负数（退款）也能正确显示', () => {
    expect(fmtMoney(-50)).toBe('¥-0.50')
  })
})

describe('todayStr 今天日期', () => {
  it('格式必须是 年4位-月2位-日2位', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('与当前真实日期一致', () => {
    const d = new Date()
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
    expect(todayStr()).toBe(expected)
  })
})

describe('currentMonth 当前月份', () => {
  it('返回 年4位-月2位，等于今天日期的前 7 位', () => {
    expect(currentMonth()).toBe(todayStr().slice(0, 7))
  })
})

describe('monthLabel 月份标签', () => {
  it('把 2026-08 显示成 8月', () => {
    expect(monthLabel('2026-08')).toBe('8月')
  })
  it('10 月不带零', () => {
    expect(monthLabel('2026-10')).toBe('10月')
  })
})
