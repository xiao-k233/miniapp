<!--
 Copyright (C) 2025 Langning Chen
 
 This file is part of miniapp.
 
 miniapp is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 miniapp is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with miniapp.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div>
    <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
      <!-- 初始化错误提示 -->
      <div v-if="showInitError" class="section section-error">
        <text class="section-title section-title-error">Shell初始化失败</text>
        <div class="item">
          <text class="item-text" style="color: #ff4444; white-space: normal;">{{ initErrorMessage }}</text>
        </div>
        <div class="operations-grid">
          <text @click="initializeShell" class="operation-btn operation-btn-primary">重试初始化</text>
          <text @click="hideInitError" class="operation-btn">关闭提示</text>
        </div>
      </div>
      
      <!-- 路径和操作栏 -->
      <div class="section">
        <text class="section-title">文件管理器</text>
        
        <div class="item">
          <text class="item-text">当前路径:</text>
          <text class="file-path">{{ currentPath }}</text>
          <text @click="goBack" :class="'btn' + (canGoBack ? ' btn-primary' : ' btn-disabled')">返回上级</text>
        </div>
        
        <div class="item">
          <text class="item-text">搜索文件:</text>
          <text class="item-input" @click="searchFiles">{{ searchKeyword || '点击搜索文件...' }}</text>
          <text v-if="searchKeyword" @click="clearSearch" class="btn btn-danger">清除</text>
        </div>
        
        <div class="item">
          <text class="item-text">统计信息:</text>
          <text class="file-stats">{{ totalFiles }} 个项目, {{ formatSize(totalSize) }}</text>
          <text @click="toggleHiddenFiles" :class="'btn' + (showHiddenFiles ? ' btn-warning' : '')">
            {{ showHiddenFiles ? '隐藏' : '显示' }}隐藏文件
          </text>
        </div>
        
        <div class="item" v-if="!isInUserDisk">
          <text class="item-text" style="color: #ffc107;">权限提示:</text>
          <text class="item-text" style="color: #ffc107; flex: 2;">当前目录为只读，只能在/userdisk目录下创建、删除、重命名</text>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="section">
        <text class="section-title">文件操作</text>
        <div class="operations-grid">
          <text @click="createNewFile" :class="'operation-btn' + (isInUserDisk ? ' operation-btn-success' : ' btn-disabled')">新建文件</text>
          <text @click="createNewDirectory" :class="'operation-btn' + (isInUserDisk ? ' operation-btn-success' : ' btn-disabled')">新建目录</text>
          <text @click="refreshDirectory" class="operation-btn operation-btn-primary">刷新目录</text>
          <text @click="goBack" :class="'operation-btn' + (canGoBack ? ' operation-btn-primary' : ' btn-disabled')">返回上级</text>
        </div>
      </div>
      
      <!-- 文件列表 -->
      <div class="section">
        <text class="section-title">文件列表</text>
        
        <div v-if="filteredFiles.length === 0" class="file-empty">
          <text class="empty-title">目录为空</text>
          <text v-if="searchKeyword" class="empty-description">没有找到匹配的文件</text>
          <text v-else class="empty-description">点击上方按钮创建文件或目录</text>
        </div>
        
        <div v-for="file in filteredFiles" :key="file.fullPath" 
             class="file-item" 
             @click="openItem(file)"
             @longpress="showFileProperties(file)">
          
          <text :class="getFileIconClass(file)">{{ file.icon }}</text>
          <text class="file-name">{{ file.name }}</text>
          <text class="file-size">{{ file.sizeFormatted }}</text>
          <text class="file-date">{{ file.modifiedTimeFormatted }}</text>
          
          <div class="file-actions">
            <text @click.stop="renameItem(file)" :class="'btn' + (isFileInUserDisk(file.fullPath) ? ' btn-warning' : ' btn-disabled')">重命名</text>
            <text @click.stop="deleteItem(file)" :class="'btn' + (isFileInUserDisk(file.fullPath) ? ' btn-danger' : ' btn-disabled')">删除</text>
          </div>
        </div>
      </div>
    </scroller>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmModal" class="confirm-modal">
      <text class="confirm-title">{{ confirmTitle }}</text>
      <text class="confirm-message">{{ confirmMessage }}</text>
      <div class="confirm-buttons">
        <text @click="executeConfirmAction" class="toolbar-btn toolbar-btn-danger">确定</text>
        <text @click="cancelConfirmAction" class="toolbar-btn">取消</text>
      </div>
    </div>
    
    <Loading />
    <ToastMessage />
  </div>
</template>

<style lang="less" scoped>
@import url('fileManager.less');

/* 添加错误提示样式 */
.section-error {
  background-color: #331111;
  border: 1px solid #ff4444;
  border-radius: 5px;
  margin-bottom: 10px;
}

.section-title-error {
  color: #ff4444 !important;
}
</style>

<script>
import fileManager from './fileManager';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';
export default {
  ...fileManager,
  components: {
    Loading,
    ToastMessage
  }
};
</script>
