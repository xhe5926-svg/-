<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { fmtMoney, currentMonth, monthLabel } from '../utils/format'

const month = ref(currentMonth())
const summary = ref({ expense: 0, income: 0 })

const trendEl = ref(null)
const pieEl = ref(null)
const barEl = ref(null)
let trendChart = null
let pieChart = null
let barChart = null

// 三个图表的主题色：支出红、收入绿、柱状图蓝
const MONTH_COLOR = '#f56c6c'
const INCOME_COLOR = '#67c23a'
const PRIMARY_COLOR = '#2b4bd8'

async function load() {
  // 月份切换时：重新算本月收支合计，并重画三个图表
  summary.value = await window.api.getMonthSummary(month.value)
  renderCharts()
}

async function renderCharts() {
  // 三个图表的数据可以同时从后台取（互不依赖），取完一次性画出来
  const [trend, breakdown, daily] = await Promise.all([
  const [trend, breakdown, daily] = await Promise.all([
    window.api.getTrend(6),
    window.api.getCategoryBreakdown(month.value),
    window.api.getDailyExpense(month.value)
  ])

  // 1. 近6个月收支趋势
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['支出', '收入'], top: 0 },
    grid: { left: 50, right: 20, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: trend.map((t) => monthLabel(t.month)) },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => (v >= 10000 ? v / 10000 + '万' : v) } },
    series: [
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: trend.map((t) => t.expense / 100),
        itemStyle: { color: MONTH_COLOR },
        areaStyle: { color: 'rgba(245,108,108,0.12)' }
      },
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: trend.map((t) => t.income / 100),
        itemStyle: { color: INCOME_COLOR }
      }
    ]
  })

  // 2. 本月支出分类占比
  const pieData = breakdown.map((b) => ({ name: b.name, value: b.total / 100 }))
  pieChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}：¥{c}（{d}%）' },
    series: [
      {
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['50%', '52%'],
        roseType: 'radius',
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%' },
        data: pieData
      }
    ]
  })

  // 3. 本月每日支出
  const daysInMonth = new Date(Number(month.value.slice(0, 4)), Number(month.value.slice(5)), 0).getDate()
  const dayMap = new Map(daily.map((d) => [Number(d.day), d.total / 100]))
  const barData = Array.from({ length: daysInMonth }, (_, i) => dayMap.get(i + 1) || 0)
  barChart.setOption({
    tooltip: { trigger: 'axis', formatter: (params) => `${params[0].name}日支出：¥${params[0].value}` },
    grid: { left: 50, right: 20, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      data: barData.map((_, i) => i + 1),
      axisLabel: { interval: 4 }
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: barData,
        itemStyle: { color: PRIMARY_COLOR, borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 14
      }
    ]
  })
}

// 窗口大小变化时，三个图表跟着缩放，防止图表变形
function resizeAll() {
  trendChart && trendChart.resize()
  pieChart && pieChart.resize()
  barChart && barChart.resize()
}

onMounted(() => {
  trendChart = echarts.init(trendEl.value)
  pieChart = echarts.init(pieEl.value)
  barChart = echarts.init(barEl.value)
  load()
  window.addEventListener('resize', resizeAll)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeAll)
  trendChart && trendChart.dispose()
  pieChart && pieChart.dispose()
  barChart && barChart.dispose()
})
</script>

<template>
  <div class="stats-page">
    <div class="title-row">
      <h2>统计</h2>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" :clearable="false" @change="load" />
    </div>

    <div class="cards">
      <div class="stat-card expense">
        <div class="stat-label">本月支出</div>
        <div class="stat-value">{{ fmtMoney(summary.expense) }}</div>
      </div>
      <div class="stat-card income">
        <div class="stat-label">本月收入</div>
        <div class="stat-value">{{ fmtMoney(summary.income) }}</div>
      </div>
      <div class="stat-card balance">
        <div class="stat-label">本月结余</div>
        <div class="stat-value">{{ fmtMoney(summary.income - summary.expense) }}</div>
      </div>
    </div>

    <div class="chart-grid">
      <el-card shadow="never" class="chart-card">
        <template #header>近6个月收支趋势</template>
        <div ref="trendEl" class="chart-box"></div>
      </el-card>
      <el-card shadow="never" class="chart-card">
        <template #header>本月支出分类占比</template>
        <div ref="pieEl" class="chart-box"></div>
      </el-card>
      <el-card shadow="never" class="chart-card full">
        <template #header>本月每日支出</template>
        <div ref="barEl" class="chart-box"></div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.stats-page {
  max-width: 1080px;
  margin: 0 auto;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title-row h2 {
  font-size: 20px;
  color: #303133;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  border: 1px solid #ebeef5;
  border-left: 4px solid #f56c6c;
}

.stat-card.income {
  border-left-color: #67c23a;
}

.stat-card.balance {
  border-left-color: #2b4bd8;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #f56c6c;
}

.stat-card.income .stat-value {
  color: #67c23a;
}

.stat-card.balance .stat-value {
  color: #2b4bd8;
}

.chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-card {
  border-radius: 12px;
}

.chart-card.full {
  grid-column: 1 / -1;
}

.chart-box {
  height: 300px;
}
</style>
