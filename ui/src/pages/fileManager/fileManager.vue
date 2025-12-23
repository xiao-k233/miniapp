<template>
  <div>
    <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
      <!-- 路径栏 -->
      <div class="section">
        <text class="section-title">文件管理器</text>
        <div class="item">
          <text class="item-text">当前路径:</text>
          <text class="file-path">{{ currentPath }}</text>
          <text @click="goBack" :class="'btn' + (canGoBack ? ' btn-primary' : ' btn-disabled')">返回上级</text>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="section">
        <text class="section-title">文件操作</text>
        <div class="operations-grid">
          <text @click="createNewFile" class="operation-btn operation-btn-success">新建文件</text>
          <text @click="createNewDirectory" class="operation-btn operation-btn-success">新建目录</text>
          <text @click="refreshDirectory" class="operation-btn operation-btn-primary">刷新目录</text>
        </div>
      </div>

      <!-- 文件列表 -->
      <div class="section">
        <text class="section-title">文件列表</text>
        <div v-if="filteredFiles.length === 0" class="file-empty">
          <text class="empty-title">目录为空</text>
        </div>

        <div v-for="file in filteredFiles" :key="file.fullPath" class="file-item">
          <text :class="getFileIconClass(file)">{{ file.icon }}</text>
          <text class="file-name">{{ file.name }}</text>
          <text class="file-size">{{ file.sizeFormatted }}</text>
          <text class="file-date">{{ file.modifiedTimeFormatted }}</text>
          <div class="file-actions">
            <text @click.stop="renameItem(file)" class="btn btn-warning">重命名</text>
            <text @click.stop="deleteItem(file)" class="btn btn-danger">删除</text>
            <text @click.stop="openItem(file)" class="btn btn-primary">打开/进入</text>
          </div>
        </div>
      </div>
    </scroller>

    <modal v-if="showConfirmModal" :title="confirmTitle" @ok="executeConfirmAction" @cancel="cancelConfirmAction">
      <text>{{ confirmMessage }}</text>
    </modal>

    <Loading />
    <ToastMessage />
  </div>
</template>

<script lang="ts" src="./fileManager.ts"></script>
<style lang="less" src="./fileManager.less"></style>
