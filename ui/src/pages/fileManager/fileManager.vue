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
  <div class="mt-file-manager">
    <!-- 顶部操作栏 -->
    <div class="top-bar">
      <div class="path-bar">
        <text class="path-text" @click="goBack" :class="{'disabled': !canGoBack}">
          返回
        </text>
        <text class="path-text">{{ currentPath }}</text>
        <text class="path-btn" @click="refreshDirectory">刷新</text>
      </div>
      
      <div class="action-bar">
        <text class="action-btn" @click="searchFiles">搜索</text>
        <text class="action-btn" @click="toggleHiddenFiles">{{ showHiddenFiles ? '隐藏' : '显示' }}隐藏文件</text>
        <text class="action-btn" @click="createNewFile" :class="{'disabled': !isInUserDisk}">新建文件</text>
        <text class="action-btn" @click="createNewDirectory" :class="{'disabled': !isInUserDisk}">新建目录</text>
        <text class="action-btn" @click="$falcon.navTo('index', {})">主页</text>
      </div>
    </div>
    
    <!-- 权限提示 -->
    <div v-if="!isInUserDisk" class="permission-warning">
      <text class="warning-text">当前目录为只读，只能在/userdisk目录下创建、删除、重命名</text>
    </div>
    
    <!-- 双栏布局 -->
    <div class="main-layout" :class="{'wide': isWideScreen, 'narrow': !isWideScreen}">
      <!-- 左侧目录树 -->
      <div class="left-panel" v-if="isWideScreen">
        <scroller class="directory-tree" scroll-direction="vertical" :show-scrollbar="true">
          <text class="tree-title">目录树</text>
          <div v-for="item in directoryTree" :key="item.fullPath" 
               class="tree-item" 
               :class="{'selected': selectedTreePath === item.fullPath}"
               @click="selectTreeItem(item)">
            <text class="tree-icon">📁</text>
            <text class="tree-name">{{ item.name }}</text>
          </div>
          
          <div v-if="directoryTree.length === 0" class="empty-tree">
            <text class="empty-text">目录树加载中...</text>
          </div>
        </scroller>
      </div>
      
      <!-- 右侧文件列表 -->
      <div class="right-panel">
        <scroller class="file-list" scroll-direction="vertical" :show-scrollbar="true">
          <!-- 搜索状态 -->
          <div v-if="searchKeyword" class="search-status">
            <text class="search-text">搜索: {{ searchKeyword }}</text>
            <text class="clear-search" @click="clearSearch">✕</text>
          </div>
          
          <!-- 统计信息 -->
          <div class="stats-bar">
            <text class="stats-text">{{ totalFiles }} 个项目</text>
            <text class="stats-text">{{ formatSize(totalSize) }}</text>
            <text class="layout-toggle" @click="toggleLayout">
              {{ isWideScreen ? '窄' : '宽' }}
            </text>
          </div>
          
          <!-- 文件列表 -->
          <div v-if="filteredFiles.length === 0" class="empty-list">
            <text class="empty-title">目录为空</text>
            <text v-if="searchKeyword" class="empty-description">没有找到匹配的文件</text>
            <text v-else class="empty-description">点击上方按钮创建文件或目录</text>
          </div>
          
          <div v-for="file in filteredFiles" :key="file.fullPath" 
               class="file-item" 
               @click="openItem(file)"
               @longpress="showFileProperties(file)">
            
            <div class="file-icon-container">
              <text class="file-icon">{{ getFileIcon(file) }}</text>
            </div>
            
            <div class="file-info">
              <text class="file-name">{{ file.name }}</text>
              <text class="file-details">{{ file.sizeFormatted }} • {{ file.modifiedTimeFormatted }}</text>
            </div>
            
            <div class="file-actions">
              <text v-if="file.type === 'directory'" class="file-action" @click.stop="openItem(file)">打开</text>
              <text v-else class="file-action" @click.stop="openFile(file)">打开</text>
              <text class="file-action" @click.stop="renameItem(file)" :class="{'disabled': !isFileInUserDisk(file.fullPath)}">重命名</text>
              <text class="file-action delete" @click.stop="deleteItem(file)" :class="{'disabled': !isFileInUserDisk(file.fullPath)}">删除</text>
            </div>
          </div>
        </scroller>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmModal" class="confirm-modal">
      <div class="modal-content">
        <text class="modal-title">{{ confirmTitle }}</text>
        <text class="modal-message">{{ confirmMessage }}</text>
        <div class="modal-buttons">
          <text @click="executeConfirmAction" class="modal-btn modal-btn-danger">确定</text>
          <text @click="cancelConfirmAction" class="modal-btn">取消</text>
        </div>
      </div>
    </div>
    
    <!-- 初始化错误提示 -->
    <div v-if="showInitError" class="init-error">
      <div class="error-content">
        <text class="error-title">Shell初始化失败</text>
        <text class="error-message">{{ initErrorMessage }}</text>
        <div class="error-buttons">
          <text @click="initializeShell" class="error-btn">重试</text>
          <text @click="hideInitError" class="error-btn">关闭</text>
        </div>
      </div>
    </div>
    
    <Loading />
    <ToastMessage />
  </div>
</template>

<style lang="less" scoped>
@import url('fileManager.less');
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
