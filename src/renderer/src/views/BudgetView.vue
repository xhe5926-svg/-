<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fmtMoney, currentMonth } from '../utils/format'

// 预算金额（元，界面输入用）；保存后转成"分"存进数据库
const budgetYuan = ref(null)
// 已保存的预算（分）和本月已支出（分）
const savedBudgetCents = ref(0)
const spentCents = ref(0)

// 已支出占预算的百分比（比如花了 80 元、预算 100 元，就是 80%）
const pct = computed(() =>
  savedBudgetCents.value > 0 ? Math.round((spentCents.value / savedBudgetCents.value) * 100) : 0
)
// 预算还剩多少（分）；负数表示已经超支
const remainingCents = computed(() => savedBudgetCents.value - spentCents.value)

// 页面上的状态提示：未设预算 / 已超支 / 即将超支（花到 80%）/ 还剩多少
const statusText = computed(() => {
  if (savedBudgetCents.value <= 0) return { text: '还未设置预算', type: 'info' }
  if (remainingCents.value < 0) return { text: `已超支 ${fmtMoney(-remainingCents.value)}`, type: 'danger' }
  if (pct.value >= 80) return { text: '即将超支，注意控制！', type: 'warning' }
  return { text: `还剩 ${fmtMoney(remainingCents.value)} 可用`, type: 'success' }
})

// "接下来每天平均可花多少"：把剩余预算平均分给本月剩下的每一天（含今天）
const dailyRemaining = computed(() => {
  if (savedBudgetCents.value <= 0 || remainingCents.value <= 0) return null
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate() + 1
  // 先算出每天能花的"分"，再转成"元"（除法后保留到分，避免显示一堆小数）
  return Math.round(remainingCents.value / Math.max(daysLeft, 1)) / 100
})

async function load() {
  // 进入页面时读已保存的预算和本月支出，回填界面
  savedBudgetCents.value = await window.api.getBudget()
  const summary = await window.api.getMonthSummary(currentMonth())
  spentCents.value = summary.expense
  budgetYuan.value = savedBudgetCents.value > 0 ? savedBudgetCents.value / 100 : null
}

async function saveBudget() {
  if (budgetYuan.value === null || budgetYuan.value <= 0) {
    ElMessage.warning('请输入有效的预算金额')
    return
  }
  // 界面输入的是"元"，转成"分"（整数）再存，避免小数计算误差
  await window.api.setBudget(Math.round(budgetYuan.value * 100))
  ElMessage.success('预算已保存')
  load()
}
</script>

<template>
  <div class="budget-page">
    <div class="title-row">
      <h2>预算管理</h2>
    </div>

    <div class="budget-grid">
      <el-card shadow="never" class="budget-card">
        <template #header>设置本月预算</template>
        <div class="set-row">
          <el-input-number
            v-model="budgetYuan"
            :min="0"
            :precision="2"
            :step="100"
            :controls="false"
            placeholder="每月预算（元）"
            style="width: 220px"
          />
          <el-button type="primary" @click="saveBudget">保存</el-button>
        </div>
        <div class="hint">设置后，记一笔和流水页都会显示预算使用进度提醒</div>
      </el-card>

      <el-card shadow="never" class="budget-card">
        <template #header>本月进度</template>
        <template v-if="savedBudgetCents > 0">
          <div class="progress-row">
            <div class="progress-info">
              <span>已支出 <b class="red">{{ fmtMoney(spentCents) }}</b></span>
              <span>预算 {{ fmtMoney(savedBudgetCents) }}</span>
            </div>
            <el-progress
              :percentage="Math.min(pct, 100)"
              :color="remainingCents < 0 ? '#f56c6c' : pct >= 80 ? '#e6a23c' : '#2b4bd8'"
              :stroke-width="16"
            />
            <div class="status-line">
              <el-tag :type="statusText.type" size="large">{{ statusText.text }}</el-tag>
              <span v-if="dailyRemaining !== null" class="daily-hint">
                接下来每天平均可花 <b>{{ fmtMoney(dailyRemaining * 100, false) }}</b> 元
              </span>
            </div>
          </div>
        </template>
        <el-empty v-else description="还没有设置预算，先在上方设置吧" :image-size="80" />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.budget-page {
  max-width: 1080px;
  margin: 0 auto;
}

.title-row {
  margin-bottom: 16px;
}

.title-row h2 {
  font-size: 20px;
  color: #303133;
}

.budget-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
}

.budget-card {
  border-radius: 12px;
}

.set-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  margin-top: 14px;
  font-size: 12px;
  color: #a8abb2;
}

.progress-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #606266;
}

.progress-info .red {
  color: #f56c6c;
  font-size: 16px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 14px;
}

.daily-hint {
  font-size: 13px;
  color: #909399;
}
</style>
