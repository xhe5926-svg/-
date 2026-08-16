<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const appInfo = ref(null)

async function exportExcel() {
  const result = await window.api.exportExcel()
  if (result.ok) {
    ElMessage.success('导出成功！文件已保存到：' + result.path)
  } else {
    ElMessage.info(result.message || '导出已取消')
  }
}

// —— 分类管理 ——
const catType = ref('expense') // 当前查看的收支类型
const categories = ref([])
const dialogVisible = ref(false)
const dialogMode = ref('add') // add = 新增, rename = 改名
const dialogName = ref('')
const dialogTarget = ref(null) // 新增时: {parentId}，改名时: {id}

const catParents = computed(() =>
  categories.value.filter((c) => !c.parentId && c.type === catType.value)
)

function childrenOf(id) {
  return categories.value.filter((c) => c.parentId === id && c.type === catType.value)
}

async function loadCategories() {
  categories.value = await window.api.getCategories()
}

function openAddParent() {
  dialogMode.value = 'add'
  dialogTarget.value = { parentId: null }
  dialogName.value = ''
  dialogVisible.value = true
}

function openAddChild(parent) {
  dialogMode.value = 'add'
  dialogTarget.value = { parentId: parent.id }
  dialogName.value = ''
  dialogVisible.value = true
}

function openRename(cat) {
  dialogMode.value = 'rename'
  dialogTarget.value = { id: cat.id }
  dialogName.value = cat.name
  dialogVisible.value = true
}

async function saveCategory() {
  const r =
    dialogMode.value === 'add'
      ? await window.api.addCategory({
          type: catType.value,
          name: dialogName.value,
          parentId: dialogTarget.value.parentId
        })
      : await window.api.updateCategory(dialogTarget.value.id, { name: dialogName.value })
  if (r.ok) {
    dialogVisible.value = false
    ElMessage.success(dialogMode.value === 'add' ? '分类已添加' : '分类已改名')
    loadCategories()
  } else {
    ElMessage.error(r.message)
  }
}

async function removeCategory(cat) {
  try {
    await ElMessageBox.confirm(`确定删除分类「${cat.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  const r = await window.api.deleteCategory(cat.id)
  if (r.ok) {
    ElMessage.success('已删除')
    loadCategories()
  } else {
    ElMessage.error(r.message)
  }
}

onMounted(async () => {
  appInfo.value = await window.api.getAppInfo()
  loadCategories()
})
</script>

<template>
  <div class="settings-page">
    <div class="title-row">
      <h2>设置</h2>
    </div>

    <el-card shadow="never" class="set-card">
      <template #header>
        <div class="card-header-row">
          <span>分类管理</span>
          <span class="small">带「预置」标签的是系统自带的分类，不能修改；你自己创建的分类可以改名、删除</span>
        </div>
      </template>

      <div class="cat-toolbar">
        <el-radio-group v-model="catType">
          <el-radio-button value="expense">支出分类</el-radio-button>
          <el-radio-button value="income">收入分类</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openAddParent">+ 新增大类</el-button>
      </div>

      <div v-for="p in catParents" :key="p.id" class="cat-block">
        <div class="cat-head">
          <span class="cat-name">{{ p.name }}</span>
          <el-tag v-if="!p.isCustom" size="small" type="info" effect="plain">预置</el-tag>
          <div class="cat-actions">
            <el-button v-if="p.isCustom" link type="primary" size="small" @click="openRename(p)">改名</el-button>
            <el-button v-if="p.isCustom" link type="danger" size="small" @click="removeCategory(p)">删除</el-button>
            <el-button link type="primary" size="small" @click="openAddChild(p)">+ 新增小类</el-button>
          </div>
        </div>
        <div class="cat-children">
          <div v-for="c in childrenOf(p.id)" :key="c.id" class="child-item">
            <span class="child-name">{{ c.name }}</span>
            <el-tag v-if="!c.isCustom" size="small" type="info" effect="plain">预置</el-tag>
            <div class="child-actions">
              <el-button v-if="c.isCustom" link type="primary" size="small" @click="openRename(c)">改名</el-button>
              <el-button v-if="c.isCustom" link type="danger" size="small" @click="removeCategory(c)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-if="catParents.length === 0" description="暂无分类" :image-size="60" />
    </el-card>

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

    <!-- 新增 / 改名分类弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'add' ? '新增分类' : '分类改名'" width="360px">
      <el-input v-model="dialogName" maxlength="20" placeholder="请输入分类名称" @keyup.enter="saveCategory" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCategory">确定</el-button>
      </template>
    </el-dialog>
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

/* —— 分类管理 —— */
.card-header-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.cat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cat-block {
  border: 1px solid #ebeef5;
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
}

.cat-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f5f7fa;
}

.cat-name {
  font-size: 15px;
  font-weight: 700;
  color: #303133;
}

.cat-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.cat-children {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
}

.child-item {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 5px 10px;
  background: #fff;
}

.child-name {
  font-size: 13px;
  color: #303133;
}

.child-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
</style>
