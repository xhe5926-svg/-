// 分类管理功能的回归测试（改数据库代码后随时可重跑）
// 运行：node scripts/test-categories.js
import Database from 'better-sqlite3'
import * as db from '../src/main/db.js'
import { rmSync } from 'node:fs'

const TMP = 'scripts/tmp-test.db'
let pass = 0
let fail = 0

function ok(name, cond) {
  if (cond) { pass++; console.log('  ✅', name) }
  else { fail++; console.log('  ❌', name) }
}

rmSync(TMP, { force: true })

// —— 场景 1：全新数据库 ——
console.log('【场景1】全新数据库初始化')
db.initDatabase(TMP)
const all = db.getCategories()
ok('分类总数 = 74', all.length === 74)
ok('预置分类 isCustom 全部为 0', all.every((c) => c.isCustom === 0))
const food = all.find((c) => c.name === '餐饮')
const breakfast = all.find((c) => c.name === '早餐')

// —— 场景 2：新增分类 ——
console.log('【场景2】新增分类')
const r1 = db.addCategory({ type: 'expense', name: '宠物', parentId: null })
ok('新增大类成功', r1.ok)
const r2 = db.addCategory({ type: 'expense', name: '猫粮', parentId: food.id })
ok('在预置大类下新增小类成功', r2.ok)
const r3 = db.addCategory({ type: 'expense', name: '狗粮', parentId: r1.id })
ok('在自己创建的大类下新增小类成功', r3.ok)
const catDog = db.getCategories().find((c) => c.name === '宠物')
ok('新分类带 isCustom = 1', catDog && catDog.isCustom === 1)

// —— 场景 3：非法新增被拦截 ——
console.log('【场景3】非法新增被拦截')
ok('空名称被拒绝', !db.addCategory({ type: 'expense', name: '  ', parentId: null }).ok)
ok('超过20字被拒绝', !db.addCategory({ type: 'expense', name: '一二三四五六七八九十一二三四五六七八九十十一', parentId: null }).ok)
ok('大类不存在被拒绝', !db.addCategory({ type: 'expense', name: '测试', parentId: 99999 }).ok)
ok('把支出小类挂到收入大类被拒绝', !db.addCategory({ type: 'income', name: '测试', parentId: food.id }).ok)
ok('把新小类挂到已有小类被拒绝（小类不能当大类）', !db.addCategory({ type: 'expense', name: '测试', parentId: breakfast.id }).ok)

// —— 场景 4：改名 ——
console.log('【场景4】改名')
ok('用户分类改名成功', db.updateCategory(r2.id, { name: '猫咪口粮' }).ok)
ok('改名后名字正确', db.getCategories().find((c) => c.id === r2.id).name === '猫咪口粮')
ok('预置分类改名被拒绝', !db.updateCategory(food.id, { name: '吃货' }).ok)
ok('改名后预置分类没变', db.getCategories().find((c) => c.id === food.id).name === '餐饮')

// —— 场景 5：删除保护 ——
console.log('【场景5】删除保护')
db.addTransaction({ type: 'expense', amountCents: 500, categoryId: r3.id, note: '测试', date: '2026-08-16' })
ok('有账单记录的分类不能删除', !db.deleteCategory(r3.id).ok)
ok('有账单的记录还在（数据没丢）', db.getMonthTransactions('2026-08').length === 1)
ok('有大类的分类不能删除（先删小类）', !db.deleteCategory(r1.id).ok)
const tx = db.getMonthTransactions('2026-08')[0]
db.deleteTransaction(tx.id)
ok('删掉账单后可以删除分类了', db.deleteCategory(r3.id).ok)
ok('预置分类不能删除', !db.deleteCategory(food.id).ok)
ok('空分类（自己的大类）可以删除', db.deleteCategory(r1.id).ok)
ok('预置大类下的用户小类可以删除', db.deleteCategory(r2.id).ok)
ok('删除后总数回到 74', db.getCategories().length === 74)
db.close()

// —— 场景 6：老版本数据库自动升级 ——
console.log('【场景6】老版本数据库自动升级')
rmSync(TMP, { force: true })
{
  const old = new Database(TMP)
  old.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
      sort_order INTEGER DEFAULT 0
    );
  `)
  old.prepare('INSERT INTO categories (name, type) VALUES (?, ?)').run('老数据', 'expense')
  old.close()
}
db.initDatabase(TMP)
ok('老库升级后带 isCustom 列且老数据保留', db.getCategories().some((c) => c.name === '老数据' && c.isCustom === 0))
ok('老库升级后预置分类正常补种（老数据存在时不补）', db.getCategories().length === 1)
db.close()

rmSync(TMP, { force: true })
console.log(`\n结果：${pass} 项通过，${fail} 项失败`)
process.exit(fail > 0 ? 1 : 0)
