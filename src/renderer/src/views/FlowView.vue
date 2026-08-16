<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fmtMoney, currentMonth, todayStr } from '../utils/format'

const month = ref(currentMonth())
const transactions = ref([])
const summary = ref({ expense: 0, income: 0 })
const categories = ref([])
const budgetStatus = ref({ budgetCents: 0, spentCents: 0 })

// 编辑弹窗状态
const editVisible = ref(false)
const editing = ref(null)
const editType = ref('expense')
const editAmount = ref(0)
const editParentId = ref(null)
const editChildId = ref(null)
const editDate = ref(todayStr())
const editNote = ref('')

const parents = computed(() => categories.value.filter((c) => !c.parentId && c.type === editType.value))
const editChildren = computed(() => categories.value.filter((c) => c.parentId === editParentId.value && c.type === editType.value))

// 按日期分组
const groups = computed(() => {
  const map = new Map()
  for (const t of transactions.value) {
    if (!map.has(t.date)) map.set(t.date, [])
    map.get(t.date).push(t)
  }
  return [...map.entries()].map(([date, list]) => {
    const dayExpense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0)
    const dayIncome = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountCents, 0)
    return { date, list, dayExpense, dayIncome }
  })
})

const budgetAlertText = computed(() => {
  const { budgetCents, spentCents } = budgetStatus.value
  const pct = Math.round((spentCents / budgetCents) * 100)
  if (spentCents >= budgetCents) return `本月已支出 ${fmtMoney(spentCents)}，已超支 ${fmtMoney(spentCents - budgetCents)}`
  if (pct >= 80) return `本月已支出 ${fmtMoney(spentCents)}，已达预算 ${pct}%，即将超支`
  return ''
})

function weekday(dateStr) {
  return '星期' + '日一二三四五六'[new Date(dateStr).getDay()]
}

async function load() {
  ;[transactions.value, summary.value] = await Promise.all([
    window.api.getMonthTransactions(month.value),
    window.api.getMonthSummary(month.value)
  ])
  const budget = await window.api.getBudget()
  if (budget > 0) {
    budgetStatus.value = { budgetCents: budget, spentCents: summary.value.expense }
  } else {
    budgetStatus.value = { budgetCents: 0, spentCents: 0 }
  }
}

async function loadCategories() {
  categories.value = await window.api.getCategories()
}

// —— 编辑 ——
function openEdit(t) {
  editing.value = t
  editType.value = t.type
  editAmount.value = t.amountCents / 100
  editDate.value = t.date
  editNote.value = t.note
  const c = categories.value.find((c) => c.id === t.categoryId)
  editParentId.value = c && c.parentId ? c.parentId : t.categoryId
  editChildId.value = t.categoryId
  editVisible.value = true
}

async function saveEdit() {
  if (!editAmount.value || editAmount.value <= 0) return ElMessage.warning('金额不能为空')
  if (!editChildId.value) return ElMessage.warning('请选择分类')
  await window.api.updateTransaction(editing.value.id, {
    type: editType.value,
    amountCents: Math.round(editAmount.value * 100),
    categoryId: editChildId.value,
    note: editNote.value.trim(),
    date: editDate.value
  })
  editVisible.value = false
  ElMessage.success('已保存修改')
  load()
}

async function remove(t) {
  try {
    await ElMessageBox.confirm(`确定删除这笔${t.type === 'expense' ? '支出' : '收入'}吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  await window.api.deleteTransaction(t.id)
  ElMessage.success('已删除')
  load()
}

onMounted(() => {
  load()
  loadCategories()
})
</script>

<template>
  <div class="flow-page">
    <div class="flow-header">
      <div class="title-row">
        <h2>流水明细</h2>
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="load" />
      </div>
      <div class="summary-bar">
        <div class="sum-item expense">本月支出 <b>{{ fmtMoney(summary.expense) }}</b></div>
        <div class="sum-item income">本月收入 <b>{{ fmtMoney(summary.income) }}</b></div>
        <div class="sum-item">本月结余 <b>{{ fmtMoney(summary.income - summary.expense) }}</b></div>
      </div>
      <el-alert
        v-if="budgetAlertText"
        :title="budgetAlertText"
        :type="budgetStatus.spentCents >= budgetStatus.budgetCents ? 'error' : 'warning'"
        :closable="false"
        show-icon
        class="budget-alert"
      />
    </div>

    <el-empty v-if="transactions.length === 0" description="这个月还没有账单，去「记一笔」开始吧" />

    <div v-for="g in groups" :key="g.date" class="day-group">
      <div class="day-header">
        <span class="day-date">{{ g.date }} {{ weekday(g.date) }}</span>
        <span class="day-total">
          <span v-if="g.dayExpense > 0" class="red">{{ fmtMoney(g.dayExpense) }}</span>
          <span v-if="g.dayExpense > 0 && g.dayIncome > 0" class="sep"> / </span>
          <span v-if="g.dayIncome > 0" class="green">{{ fmtMoney(g.dayIncome) }}</span>
        </span>
      </div>
      <div class="tx-list">
        <div v-for="t in g.list" :key="t.id" class="tx-row">
          <div class="tx-cat">
            <span class="cat-tag" :class="t.type">{{ t.parentName }}</span>
            <span class="cat-child">{{ t.categoryName }}</span>
            <span v-if="t.note" class="tx-note">{{ t.note }}</span>
          </div>
          <div class="tx-amount" :class="t.type">{{ fmtMoney(t.amountCents) }}</div>
          <div class="tx-actions">
            <el-button link type="primary" size="small" @click="openEdit(t)">编辑</el-button>
            <el-button link type="danger" size="small" @click="remove(t)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑账单" width="460px">
      <div class="edit-form">
        <div class="edit-row">
          <span class="edit-label">类型</span>
          <el-radio-group v-model="editType" @change="editParentId = null; editChildId = null">
            <el-radio-button value="expense">支出</el-radio-button>
            <el-radio-button value="income">收入</el-radio-button>
          </el-radio-group>
        </div>
        <div class="edit-row">
          <span class="edit-label">金额</span>
          <el-input-number v-model="editAmount" :min="0.01" :precision="2" :step="1" style="width: 180px" />
        </div>
        <div class="edit-row">
          <span class="edit-label">分类</span>
          <el-select v-model="editParentId" placeholder="一级大类" style="width: 140px" @change="editChildId = null">
            <el-option v-for="p in parents" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-select v-model="editChildId" placeholder="二级小类" style="width: 140px; margin-left: 10px">
            <el-option v-for="c in editChildren" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </div>
        <div class="edit-row">
          <span class="edit-label">日期</span>
          <el-date-picker v-model="editDate" type="date" value-format="YYYY-MM-DD" :clearable="false" />
        </div>
        <div class="edit-row">
          <span class="edit-label">备注</span>
          <el-input v-model="editNote" maxlength="50" placeholder="（可选）" />
        </div>
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.flow-page {
  max-width: 1080px;
  margin: 0 auto;
}

.flow-header {
  margin-bottom: 18px;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title-row h2 {
  font-size: 20px;
  color: #303133;
}

.summary-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.sum-item {
  background: #fff;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  color: #606266;
  border: 1px solid #ebeef5;
}

.sum-item b {
  font-size: 16px;
  margin-left: 6px;
  color: #303133;
}

.sum-item.expense b {
  color: #f56c6c;
}

.sum-item.income b {
  color: #67c23a;
}

.budget-alert {
  margin-bottom: 4px;
}

.day-group {
  margin-bottom: 18px;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
  color: #909399;
  font-size: 13px;
}

.day-total .red {
  color: #f56c6c;
  font-weight: 600;
}

.day-total .green {
  color: #67c23a;
  font-weight: 600;
}

.day-total .sep {
  color: #dcdfe6;
}

.tx-list {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  overflow: hidden;
}

.tx-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f5f7fa;
}

.tx-row:last-child {
  border-bottom: none;
}

.tx-row:hover .tx-actions {
  visibility: visible;
}

.tx-cat {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cat-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef0f0;
  color: #f56c6c;
  white-space: nowrap;
}

.cat-tag.income {
  background: #f0f9eb;
  color: #67c23a;
}

.cat-child {
  font-size: 14px;
  color: #303133;
  white-space: nowrap;
}

.tx-note {
  font-size: 12px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tx-amount {
  font-size: 15px;
  font-weight: 600;
  color: #f56c6c;
  margin: 0 16px;
  white-space: nowrap;
}

.tx-amount.income {
  color: #67c23a;
}

.tx-actions {
  visibility: hidden;
  white-space: nowrap;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.edit-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-label {
  width: 40px;
  color: #606266;
  font-size: 14px;
}
</style>
