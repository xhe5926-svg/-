// 黑马记账 - 主进程（应用"后台"）
// 负责：创建窗口、管理本机数据库、Excel 导出
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import XLSX from 'xlsx'
import * as db from './db'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 660,
    title: '黑马记账',
    autoHideMenuBar: true,
    icon: path.join(import.meta.dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // 开发模式加载本地服务，生产模式加载打包后的页面
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(import.meta.dirname, '../renderer/index.html'))
  }

  // 点击外部链接用系统浏览器打开（安全性）
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// —— 注册界面与后台之间的通信通道 ——
function registerIpcHandlers() {
  ipcMain.handle('db:getCategories', () => db.getCategories())
  ipcMain.handle('db:addTransaction', (_e, data) => db.addTransaction(data))
  ipcMain.handle('db:updateTransaction', (_e, { id, ...data }) => db.updateTransaction(id, data))
  ipcMain.handle('db:deleteTransaction', (_e, id) => db.deleteTransaction(id))
  ipcMain.handle('db:getMonthTransactions', (_e, month) => db.getMonthTransactions(month))
  ipcMain.handle('db:getMonthSummary', (_e, month) => db.getMonthSummary(month))
  ipcMain.handle('db:getTrend', (_e, n) => db.getTrend(n))
  ipcMain.handle('db:getCategoryBreakdown', (_e, month) => db.getCategoryBreakdown(month))
  ipcMain.handle('db:getDailyExpense', (_e, month) => db.getDailyExpense(month))
  ipcMain.handle('db:getBudget', () => db.getBudget())
  ipcMain.handle('db:setBudget', (_e, cents) => db.setBudget(cents))

  ipcMain.handle('export:excel', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const today = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(win, {
      title: '导出账目',
      defaultPath: `黑马记账账目导出_${today}.xlsx`,
      filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false, message: '已取消导出' }
    try {
      const rows = db.getAllTransactions().map((r) => ({
        日期: r.date,
        类型: r.type === 'expense' ? '支出' : '收入',
        一级分类: r.parentName || r.categoryName,
        二级分类: r.parentId ? r.categoryName : '—',
        金额: Number((r.amountCents / 100).toFixed(2)),
        备注: r.note || ''
      }))
      const sheet = XLSX.utils.json_to_sheet(rows)
      sheet['!cols'] = [
        { wch: 12 },
        { wch: 8 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 30 }
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, sheet, '账目明细')
      XLSX.writeFile(wb, result.filePath)
      return { ok: true, path: result.filePath }
    } catch (err) {
      return { ok: false, message: '导出失败：' + err.message }
    }
  })

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    platform: process.platform
  }))
}

app.whenReady().then(() => {
  // 打开数据库（数据文件存在系统的"用户数据"目录里）
  db.initDatabase(path.join(app.getPath('userData'), 'heima.db'))
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => db.close())
