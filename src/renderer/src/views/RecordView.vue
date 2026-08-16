<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { todayStr, fmtMoney, currentMonth } from '../utils/format'

// —— 状态 ——
const type = ref('expense') // expense=支出 income=收入
const amountStr = ref('')
const date = ref(todayStr())
const note = ref('')
const categories = ref([])
const parentId = ref(null)
const childId = ref(null)
const budgetStatus = ref({ budgetCents: 0, spentCents: 0 })

const budgetAlertText = computed(() => {
  const { budgetCents, spentCents } = budgetStatus.value
  const pct = Math.round((spentCents / budgetCents) * 100)
  if (spentCents >= budgetCents)
    return `本月已支出 ${fmtMoney(spentCents)}，已超支 ${fmtMoney(spentCents - budgetCents)}，注意节制哦！`
  if (pct >= 80) return `本月已支出 ${fmtMoney(spentCents)}，已达预算的 ${pct}%，即将超支！`
  return `本月已支出 ${fmtMoney(spentCents)}，预算还剩 ${fmtMoney(budgetCents - spentCents)}`
})

const budgetAlertType = computed(() => {
  const { budgetCents, spentCents } = budgetStatus.value
  if (spentCents >= budgetCents) return 'error'
  if (spentCents >= budgetCents * 0.8) return 'warning'
  return 'success'
})

const parents = computed(() =>
  categories.value.filter((c) => !c.parentId && c.type === type.value)
)
const children = computed(() =>
  categories.value.filter((c) => c.parentId === parentId.value && c.type === type.value)
)

const amountCents = computed(() => {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amountStr.value)
  if (!m) return 0
  return Math.round(Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0')))
})

const canSave = computed(() => amountCents.value > 0 && childId.value !== null)

// —— 数据加载 ——
async function loadCategories() {
  categories.value = await window.api.getCategories()
  switchType()
}

function switchType() {
  parentId.value = parents.value[0] ? parents.value[0].id : null
  childId.value = null
}

async function loadBudgetStatus() {
  const budget = await window.api.getBudget()
  if (budget > 0) {
    const summary = await window.api.getMonthSummary(currentMonth())
    budgetStatus.value = { budgetCents: budget, spentCents: summary.expense }
  } else {
    budgetStatus.value = { budgetCents: 0, spentCents: 0 }
  }
}

// —— 金额键盘 ——
function pressDigit(d) {
  if (amountStr.value.includes('.')) {
    const [, dec] = amountStr.value.split('.')
    if (dec.length >= 2) return
  }
  const digits = amountStr.value.replace('.', '')
  if (digits.length >= 9) return
  if (amountStr.value === '0' && d !== '.') amountStr.value = d
  else amountStr.value += d
}

function pressDot() {
  if (!amountStr.value.includes('.')) {
    amountStr.value = amountStr.value ? amountStr.value + '.' : '0.'
  }
}

function pressBackspace() {
  amountStr.value = amountStr.value.slice(0, -1)
}

function pressClear() {
  amountStr.value = ''
}

function onGlobalKeydown(e) {
  if (e.key >= '0' && e.key <= '9') {
    pressDigit(e.key)
  } else if (e.key === '.') {
    pressDot()
  } else if (e.key === 'Backspace') {
    pressBackspace()
  } else if (e.key.toLowerCase() === 'c' && e.ctrlKey === false) {
    pressClear()
  }
}

// —— 保存 ——
async function save() {
  if (!canSave.value) {
    if (amountCents.value <= 0) ElMessage.warning('请先输入金额')
    else ElMessage.warning('请选择具体分类（二级小类）')
    return
  }
  await window.api.addTransaction({
    type: type.value,
    amountCents: amountCents.value,
    categoryId: childId.value,
    note: note.value.trim(),
    date: date.value
  })
  ElMessage.success('记账成功 🎉')
  amountStr.value = ''
  note.value = ''
  loadBudgetStatus()
}

onMounted(() => {
  loadCategories()
  loadBudgetStatus()
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <div class="record-page">
    <el-alert
      v-if="budgetStatus.budgetCents > 0"
      :title="budgetAlertText"
      :type="budgetAlertType"
      :closable="false"
      show-icon
      class="budget-alert"
    />

    <el-card shadow="never" class="record-card">
      <div class="record-grid">
        <!-- 左：金额与基本信息 -->
        <div class="left">
          <div class="type-toggle">
            <button
              class="type-btn"
              :class="{ active: type === 'expense' }"
              @click="type = 'expense'; switchType()"
            >
              支出
            </button>
            <button
              class="type-btn income"
              :class="{ active: type === 'income' }"
              @click="type = 'income'; switchType()"
            >
              收入
            </button>
          </div>

          <div class="amount-box" :class="type === 'income' ? 'income' : ''">
            <div class="amount-value">
              <span class="yuan-symbol">¥</span>
              <span class="yuan-number">{{ amountStr || '0' }}</span>
            </div>
          </div>

          <div class="keypad">
            <button v-for="k in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="k" class="key" @click="pressDigit(k)">{{ k }}</button>
            <button class="key fn" @click="pressBackspace">⌫</button>
            <button class="key fn" @click="pressClear">清空</button>
            <button class="key" @click="pressDot">.</button>
            <button class="key" @click="pressDigit('0')">0</button>
            <button class="key" @click="pressDigit('00')">00</button>
          </div>

          <div class="form-row">
            <span class="label">日期</span>
            <el-date-picker v-model="date" type="date" value-format="YYYY-MM-DD" :clearable="false" style="width: 160px" />
          </div>
          <div class="form-row">
            <span class="label">备注</span>
            <el-input v-model="note" placeholder="写点什么…（可选）" maxlength="50" clearable style="flex: 1" />
          </div>

          <button class="save-btn" :class="{ income: type === 'income' }" :disabled="!canSave" @click="save">
            保存这笔{{ type === 'expense' ? '支出' : '收入' }}
          </button>
        </div>

        <!-- 右：2 级分类选择 -->
        <div class="right">
          <div class="section-title">选择分类（大类 → 小类）</div>
          <div class="category-panel">
            <div class="parent-list">
              <button
                v-for="p in parents"
                :key="p.id"
                class="parent-btn"
                :class="{ active: parentId === p.id }"
                @click="parentId = p.id; childId = null"
              >
                {{ p.name }}
              </button>
            </div>
            <div class="child-grid">
              <button
                v-for="c in children"
                :key="c.id"
                class="child-btn"
                :class="{ active: childId === c.id }"
                @click="childId = c.id"
              >
                {{ c.name }}
              </button>
              <div v-if="children.length === 0" class="empty-hint">请先选择左侧大类</div>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.record-page {
  max-width: 1080px;
  margin: 0 auto;
}

.budget-alert {
  margin-bottom: 16px;
}

.record-card {
  border-radius: 12px;
}

.record-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 28px;
}

/* —— 左栏 —— */
.type-toggle {
  display: flex;
  gap: 12px;
}

.type-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  background: #fff;
  font-size: 15px;
  font-weight: 600;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s;
}

.type-btn.active {
  background: #fef0f0;
  border-color: #f56c6c;
  color: #f56c6c;
}

.type-btn.income.active {
  background: #f0f9eb;
  border-color: #67c23a;
  color: #67c23a;
}

.amount-box {
  margin: 16px 0 14px;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
}

.amount-box.income {
  background: #f0f9eb;
  border-color: #e1f3d8;
}

.amount-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.yuan-symbol {
  font-size: 22px;
  font-weight: 700;
  color: #f56c6c;
}

.amount-box.income .yuan-symbol {
  color: #67c23a;
}

.yuan-number {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #303133;
  font-family: 'Consolas', 'Courier New', monospace;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 18px;
}

.key {
  height: 44px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #fff;
  font-size: 17px;
  cursor: pointer;
  transition: background 0.12s;
}

.key:hover {
  background: #f0f4ff;
}

.key:active {
  background: #e1e9ff;
}

.key.fn {
  font-size: 14px;
  color: #909399;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.label {
  width: 36px;
  color: #606266;
  font-size: 14px;
}

.save-btn {
  width: 100%;
  margin-top: 6px;
  padding: 12px 0;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #f56c6c, #e6483e);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 4px;
  cursor: pointer;
  transition: opacity 0.15s;
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.35);
}

.save-btn.income {
  background: linear-gradient(135deg, #67c23a, #4fa82c);
  box-shadow: 0 4px 12px rgba(103, 194, 58, 0.35);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* —— 右栏：分类 —— */
.section-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 12px;
}

.category-panel {
  display: grid;
  grid-template-columns: 104px 1fr;
  gap: 14px;
  min-height: 330px;
}

.parent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.parent-btn {
  padding: 9px 0;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #fafbfc;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
}

.parent-btn.active {
  background: #2b4bd8;
  border-color: #2b4bd8;
  color: #fff;
  font-weight: 600;
}

.child-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 8px;
  align-content: start;
  max-height: 330px;
  overflow-y: auto;
}

.child-btn {
  padding: 10px 0;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #fff;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  transition: all 0.12s;
}

.child-btn:hover {
  border-color: #2b4bd8;
}

.child-btn.active {
  background: #eef2ff;
  border-color: #2b4bd8;
  color: #2b4bd8;
  font-weight: 600;
}

.empty-hint {
  grid-column: 1 / -1;
  color: #c0c4cc;
  font-size: 13px;
  padding-top: 40px;
  text-align: center;
}
</style>
