// 黑马记账 - 安全桥
// 界面（网页层）不能直接碰数据库，只能通过这里提供的"电话线"向后台传话
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addTransaction: (data) => ipcRenderer.invoke('db:addTransaction', data),
  updateTransaction: (id, data) => ipcRenderer.invoke('db:updateTransaction', { id, ...data }),
  deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
  getMonthTransactions: (month) => ipcRenderer.invoke('db:getMonthTransactions', month),
  getMonthSummary: (month) => ipcRenderer.invoke('db:getMonthSummary', month),
  getTrend: (n) => ipcRenderer.invoke('db:getTrend', n),
  getCategoryBreakdown: (month) => ipcRenderer.invoke('db:getCategoryBreakdown', month),
  getDailyExpense: (month) => ipcRenderer.invoke('db:getDailyExpense', month),
  getBudget: () => ipcRenderer.invoke('db:getBudget'),
  setBudget: (cents) => ipcRenderer.invoke('db:setBudget', cents),
  exportExcel: () => ipcRenderer.invoke('export:excel'),
  getAppInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('api', api)
