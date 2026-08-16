<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const appInfo = ref(null)

async function exportExcel() {
  const result = await window.api.exportExcel()
  if (result.ok) {
    ElMessage.success('导出成功！文件已保存到：' + result.path)
  } else {
    ElMessage.info(result.message || '导出已取消')
  }
}

onMounted(async () => {
  appInfo.value = await window.api.getAppInfo()
})
</script>

<template>
  <div class="settings-page">
    <div class="title-row">
      <h2>设置</h2>
    </div>

    <el-card shadow="never" class="set-card">
      <template #header>数据导出（备份）</template>
      <div class="export-row">
        <div class="export-desc">
          <p>把所有账目导出成一个 Excel 文件，方便备份或自己分析。</p>
          <p class="small">导出的内容包含：日期、类型、一级分类、二级分类、金额、备注。</p>
        </div>
        <el-button type="primary" size="large" @click="exportExcel">导出 Excel</el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="set-card">
      <template #header>数据与隐私</template>
      <ul class="info-list">
        <li>你的账目数据只保存在这台电脑上，不会上传到任何网络服务。</li>
        <li v-if="appInfo">数据文件位置：<code>{{ appInfo.dataDir }}</code></li>
        <li>想换电脑时，先用"导出 Excel"备份，再在新电脑上导入即可继续记账。</li>
      </ul>
    </el-card>

    <el-card shadow="never" class="set-card">
      <template #header>关于</template>
      <div class="about">
        <div class="about-logo">账</div>
        <div>
          <div class="about-name">黑马记账</div>
          <div class="small">版本 v{{ appInfo ? appInfo.version : '1.0.0' }} · 支持 Windows / Mac</div>
          <div class="small">认真记好每一笔，钱花在哪一目了然。</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.settings-page {
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

.set-card {
  border-radius: 12px;
  margin-bottom: 16px;
}

.export-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.export-desc p {
  font-size: 14px;
  color: #606266;
  margin-bottom: 6px;
}

.small {
  font-size: 12px;
  color: #a8abb2;
  margin-top: 4px;
}

.info-list {
  list-style: none;
  padding: 0;
}

.info-list li {
  font-size: 14px;
  color: #606266;
  padding: 6px 0;
}

.info-list code {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  color: #2b4bd8;
}

.about {
  display: flex;
  align-items: center;
  gap: 16px;
}

.about-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f7cff, #2b4bd8);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.about-name {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
}
</style>
