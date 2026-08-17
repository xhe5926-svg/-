// 黑马记账 - 数据库模块
// 技术说明（通俗版）：账目数据存在本机的 SQLite 数据库文件里，
// 金额统一用"分"（整数）存储，避免小数计算出现误差，显示时再转成"元"。
import Database from 'better-sqlite3'

let db = null

// —— 分类种子数据（产品文档 2.2 节设计）——
const EXPENSE_CATEGORIES = [
  ['餐饮', ['早餐', '午餐', '晚餐', '外卖', '零食饮料', '水果', '咖啡茶饮', '聚餐请客']],
  ['交通', ['公交地铁', '打车', '加油', '停车', '火车高铁', '飞机', '共享单车', '车辆维修保养']],
  ['购物', ['服装鞋帽', '日用品', '数码电器', '美妆护肤', '家居用品', '宠物用品', '烟酒', '书籍文具']],
  ['居住', ['房租', '房贷', '水电燃气', '物业费', '家具家电', '装修维修']],
  ['娱乐', ['电影演出', '游戏充值', '健身运动', '旅游度假', 'KTV聚会', '影音会员']],
  ['医疗健康', ['门诊挂号', '药品', '体检', '住院', '保健品']],
  ['教育学习', ['学费', '培训课程', '考试报名', '学习用品']],
  ['通讯网络', ['手机话费', '流量', '宽带']],
  ['人情往来', ['红包礼金', '份子钱', '请客送礼']],
  ['其他', ['其他支出']]
]

const INCOME_CATEGORIES = [
  ['工资收入', ['基本工资', '奖金', '补贴']],
  ['理财收入', ['利息', '基金股票收益']],
  ['其他收入', ['红包', '报销', '兼职', '其他']]
]

export function initDatabase(dbPath) {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  // 打开"外键约束"开关：表结构里写了"账单必须属于真实存在的分类"，
  // 这个开关打开后这条规则才真正生效，乱填的分类编号会被数据库拒绝
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      sort_order INTEGER DEFAULT 0,
      is_custom INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      amount_cents INTEGER NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      note TEXT DEFAULT '',
      date TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)
  // 老版本数据库没有"是否用户创建"标记列，这里自动补上（相当于给数据库做了一次小升级）
  const cols = db.prepare('PRAGMA table_info(categories)').all()
  if (!cols.some((c) => c.name === 'is_custom')) {
    db.exec('ALTER TABLE categories ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0')
  }
  seedCategoriesIfEmpty()
}

// 首次建库时把 74 个预置分类写进去；已有分类（哪怕是老库）就跳过，不重复写入
function seedCategoriesIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM categories').get()
  if (c > 0) return
  const insert = db.prepare(
    'INSERT INTO categories (parent_id, name, type, sort_order) VALUES (?, ?, ?, ?)'
  )
  const seed = db.transaction((list, type) => {
    list.forEach(([parent, children], pi) => {
      const info = insert.run(null, parent, type, pi)
      children.forEach((name, ci) => insert.run(info.lastInsertRowid, name, type, ci))
    })
  })
  seed(EXPENSE_CATEGORIES, 'expense')
  seed(INCOME_CATEGORIES, 'income')
}

// —— 分类 ——
// 返回全部分类（大类 + 小类混在一起），界面自己按 parentId 区分层级
export function getCategories() {
  return db
    .prepare(
      'SELECT id, parent_id AS parentId, name, type, is_custom AS isCustom FROM categories ORDER BY type, sort_order, id'
    )
    .all()
}

// —— 分类管理（用户新增/改名/删除自己创建的分类；预置分类不可动）——
// 分类名的检查：不能为空、不能超过 20 个字；通过时返回整理好的名字（去掉首尾空格）
function validateName(name) {
  name = (name || '').trim()
  if (!name) return { ok: false, message: '分类名称不能为空' }
  if (name.length > 20) return { ok: false, message: '分类名称不能超过 20 个字' }
  return { ok: true, name }
}

export function addCategory({ type, name, parentId }) {
  const v = validateName(name)
  if (!v.ok) return v
  if (parentId != null) {
    const parent = db
      .prepare('SELECT id, type, parent_id AS parentId FROM categories WHERE id = ?')
      .get(parentId)
    if (!parent || parent.parentId != null) return { ok: false, message: '所选的大类不存在' }
    if (parent.type !== type) return { ok: false, message: '大类与收支类型不匹配' }
  }
  const { so } = db
    .prepare(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS so FROM categories WHERE type = ? AND parent_id IS ?'
    )
    .get(type, parentId ?? null)
  const info = db
    .prepare(
      'INSERT INTO categories (parent_id, name, type, sort_order, is_custom) VALUES (?, ?, ?, ?, 1)'
    )
    .run(parentId ?? null, v.name, type, so)
  return { ok: true, id: info.lastInsertRowid }
}

export function updateCategory(id, { name }) {
  const v = validateName(name)
  if (!v.ok) return v
  const info = db.prepare('UPDATE categories SET name = ? WHERE id = ? AND is_custom = 1').run(v.name, id)
  if (info.changes === 0) return { ok: false, message: '预置分类不能修改' }
  return { ok: true }
}

// 删除分类，按产品文档的删除保护规则逐项检查（预置/有子类/有账单都不能删）
export function deleteCategory(id) {
  const cat = db.prepare('SELECT is_custom AS isCustom FROM categories WHERE id = ?').get(id)
  if (!cat) return { ok: false, message: '分类不存在' }
  if (!cat.isCustom) return { ok: false, message: '预置分类不能删除' }
  const child = db.prepare('SELECT COUNT(*) AS c FROM categories WHERE parent_id = ?').get(id)
  if (child.c > 0) return { ok: false, message: '该分类下还有小类，请先删除这些小类' }
  const tx = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE category_id = ?').get(id)
  if (tx.c > 0) return { ok: false, message: '该分类下已有账单记录，不能直接删除。请先把这些账单改成其他分类' }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)
  return { ok: true }
}

// —— 记账 ——

// 记账前检查：收支类型、金额、分类是否都合理（相当于收银台的验钞机，防止坏数据进账本）
function validateTransaction(type, amountCents, categoryId) {
  if (type !== 'expense' && type !== 'income') return { ok: false, message: '收支类型不合法' }
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0)
    return { ok: false, message: '金额必须大于 0' }
  if (typeof categoryId !== 'number' || !Number.isInteger(categoryId))
    return { ok: false, message: '分类不存在' }
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)
  if (!cat) return { ok: false, message: '分类不存在' }
  return { ok: true }
}

export function addTransaction({ type, amountCents, categoryId, note, date }) {
  const v = validateTransaction(type, amountCents, categoryId)
  if (!v.ok) return v
  const info = db
    .prepare(
      'INSERT INTO transactions (type, amount_cents, category_id, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(type, amountCents, categoryId, note || '', date, Date.now())
  return info.lastInsertRowid
}

export function updateTransaction(id, { type, amountCents, categoryId, note, date }) {
  const v = validateTransaction(type, amountCents, categoryId)
  if (!v.ok) return v
  db.prepare(
    'UPDATE transactions SET type = ?, amount_cents = ?, category_id = ?, note = ?, date = ? WHERE id = ?'
  ).run(type, amountCents, categoryId, note || '', date, id)
}

export function deleteTransaction(id) {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
}

// 某月的全部账单（带分类名称）
export function getMonthTransactions(month) {
  return db
    .prepare(
      `SELECT t.id, t.type, t.amount_cents AS amountCents, t.note, t.date,
              c.id AS categoryId, c.name AS categoryName, c.parent_id AS parentId,
              p.name AS parentName
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE substr(t.date, 1, 7) = ?
       ORDER BY t.date DESC, t.id DESC`
    )
    .all(month)
}

// 某月的支出/收入合计
export function getMonthSummary(month) {
  const rows = db
    .prepare('SELECT type, SUM(amount_cents) AS total FROM transactions WHERE substr(date, 1, 7) = ? GROUP BY type')
    .all(month)
  const summary = { expense: 0, income: 0 }
  for (const row of rows) summary[row.type] = row.total
  return summary
}

// 近 N 个月的收支趋势（从当前月往前数）
export function getTrend(months = 6) {
  const now = new Date()
  const list = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      expense: 0,
      income: 0
    })
  }
  const startMonth = list[0].month
  const rows = db
    .prepare(
      `SELECT substr(date, 1, 7) AS m, type, SUM(amount_cents) AS total
       FROM transactions WHERE date >= ? GROUP BY m, type`
    )
    .all(startMonth + '-01')
  const map = new Map(list.map((m) => [m.month, m]))
  for (const row of rows) {
    const item = map.get(row.m)
    if (item) item[row.type] = row.total
  }
  return list
}

// 某月支出按一级大类的汇总（统计页饼图用）
export function getCategoryBreakdown(month) {
  return db
    .prepare(
      `SELECT COALESCE(p.name, c.name) AS name, SUM(t.amount_cents) AS total
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       WHERE t.type = 'expense' AND substr(t.date, 1, 7) = ?
       GROUP BY COALESCE(p.name, c.name)
       ORDER BY total DESC`
    )
    .all(month)
}

// 某月每日支出（统计页柱状图用）
export function getDailyExpense(month) {
  return db
    .prepare(
      `SELECT substr(t.date, 9, 2) AS day, SUM(t.amount_cents) AS total
       FROM transactions t
       WHERE t.type = 'expense' AND substr(t.date, 1, 7) = ?
       GROUP BY t.date ORDER BY t.date`
    )
    .all(month)
}

// —— 预算 ——
// 读本月预算（分）；还没设过就返回 0，界面按"没设预算"处理
export function getBudget() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'monthly_budget_cents'").get()
  return row ? Number(row.value) : 0
}

// 保存本月预算（分）；键已存在时用"冲突则更新"的写法覆盖旧值
export function setBudget(cents) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('monthly_budget_cents', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(cents))
}

// —— 导出（全部账单，带分类名）——
export function getAllTransactions() {
  return db
    .prepare(
      `SELECT t.date, t.type, t.amount_cents AS amountCents, t.note,
              c.name AS categoryName, c.parent_id AS parentId,
              p.name AS parentName
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories p ON p.id = c.parent_id
       ORDER BY t.date DESC, t.id DESC`
    )
    .all()
}

// 关闭数据库（应用退出时调用，保证数据完整落盘）
export function close() {
  if (db) {
    db.close()
    db = null
  }
}
