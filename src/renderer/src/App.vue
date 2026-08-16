<script setup>
import { ref, computed } from 'vue'
import { EditPen, Tickets, DataAnalysis, Aim, Setting } from '@element-plus/icons-vue'
import RecordView from './views/RecordView.vue'
import FlowView from './views/FlowView.vue'
import StatsView from './views/StatsView.vue'
import BudgetView from './views/BudgetView.vue'
import SettingsView from './views/SettingsView.vue'

const active = ref('record')
const views = {
  record: RecordView,
  flow: FlowView,
  stats: StatsView,
  budget: BudgetView,
  settings: SettingsView
}
const currentView = computed(() => views[active.value])
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <div class="logo-mark">账</div>
        <div class="logo-text">
          <div class="logo-name">黑马记账</div>
          <div class="logo-sub">认真记好每一笔</div>
        </div>
      </div>
      <el-menu :default-active="active" @select="(k) => (active = k)" class="side-menu">
        <el-menu-item index="record">
          <el-icon><EditPen /></el-icon>
          <span>记一笔</span>
        </el-menu-item>
        <el-menu-item index="flow">
          <el-icon><Tickets /></el-icon>
          <span>流水</span>
        </el-menu-item>
        <el-menu-item index="stats">
          <el-icon><DataAnalysis /></el-icon>
          <span>统计</span>
        </el-menu-item>
        <el-menu-item index="budget">
          <el-icon><Aim /></el-icon>
          <span>预算</span>
        </el-menu-item>
        <el-menu-item index="settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-main class="content">
      <component :is="currentView" />
    </el-main>
  </el-container>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
}

body {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  color: #303133;
  -webkit-font-smoothing: antialiased;
}

.app-shell {
  height: 100%;
}

.sidebar {
  background: linear-gradient(180deg, #1e3a8a 0%, #172554 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  padding-top: 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px 24px;
}

.logo-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f7cff, #2b4bd8);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(31, 58, 138, 0.5);
}

.logo-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
}

.logo-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}

.side-menu {
  border-right: none;
  background: transparent;
}

.side-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.75);
  height: 48px;
  margin: 2px 10px;
  border-radius: 8px;
}

.side-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.side-menu .el-menu-item.is-active {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-weight: 600;
}

.content {
  padding: 24px 28px;
  background: #f5f7fa;
  overflow-y: auto;
}
</style>
