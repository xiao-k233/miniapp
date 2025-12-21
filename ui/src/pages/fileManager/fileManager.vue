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
  <div class="file-manager-container" @click="hideMenu" @touchstart="hideMenu">
    
    <!-- 标题栏 -->
    <div class="file-header">
      <text class="header-title">文件管理器</text>
      <text class="header-stats">{{ stats }}</text>
      <text @click="refreshDirectory" class="toolbar-btn-icon" style="background-color: #17a2b8;">↻</text>
    </div>
    
    <!-- 路径栏 -->
    <div class="path-bar">
      <scroller class="path-scroller" scroll-direction="horizontal" :show-scrollbar="false">
        <text class="path-text">{{ currentPath }}</text>
      </scroller>
      <text @click="goBack" :class="'path-btn' + (canGoBack ? ' btn-info-small' : ' btn-disabled-small')">返回</text>
      <text @click="goForward" :class="'path-btn' + (canGoForward ? ' btn-info-small' : ' btn-disabled-small')">前进</text>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar-compact">
      <div class="toolbar-row">
        <text @click="goUp" :class="'toolbar-btn-small' + (canGoBack ? ' btn-primary-small' : ' btn-disabled-small')">上级</text>
        <text @click="navigateTo('/')" class="toolbar-btn-small btn-primary-small">根目录</text>
        <text @click="createAndEditFile" class="toolbar-btn-small btn-success-small">新建文件</text>
        <text @click="createDirectory" class="toolbar-btn-small btn-success-small">新建目录</text>
      </div>
      <div class="toolbar-row">
        <text @click="toggleSelectAll" class="toolbar-btn-small btn-warning-small">{{ files.length > 0 && files.every(f => f.selected) ? '取消全选' : '全选' }}</text>
        <text @click="toggleSort('name')" class="toolbar-btn-small btn-info-small">名称{{ sortField === 'name' ? (sortAsc ? '↑' : '↓') : '' }}</text>
        <text @click="toggleSort('size')" class="toolbar-btn-small btn-info-small">大小{{ sortField === 'size' ? (sortAsc ? '↑' : '↓') : '' }}</text>
        <text @click="toggleSort('modified')" class="toolbar-btn-small btn-info-small">时间{{ sortField === 'modified' ? (sortAsc ? '↑' : '↓') : '' }}</text>
      </div>
    </div>
    
    <!-- 搜索栏 -->
    <div class="search-bar">
      <input type="text" class="search-input" v-model="searchKeyword" placeholder="搜索文件或目录..." />
      <text v-if="searchKeyword" @click="searchKeyword = ''" class="search-clear">✕</text>
    </div>
    
    <!-- 文件列表 -->
    <div class="file-list-container">
      <scroller class="file-scroller" scroll-direction="vertical" :show-scrollbar="true" ref="scroller">
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-container">
          <text class="loading-text">正在加载...</text>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="filteredFiles.length === 0" class="empty-state">
          <text class="empty-icon">{{ searchKeyword ? '🔍' : '📁' }}</text>
          <text class="empty-text">{{ searchKeyword ? '没有找到匹配的文件' : '目录为空' }}</text>
        </div>
        
        <!-- 文件列表 -->
        <div v-else v-for="file in filteredFiles" :key="file.id"
             @click="selectionMode ? toggleSelection(file) : openFile(file)"
             @touchstart="(e) => handleFileTouchStart(e, file)"
             @touchend="(e) => handleFileTouchEnd(e, file)"
             @contextmenu="(e) => showContextMenu(e, file)"
             :class="'file-item-compact' + (file.selected ? ' selected' : '')">
          
          <!-- 选择框 -->
          <text class="file-checkbox" @click.stop="toggleSelection(file)">
            {{ file.selected ? '✓' : '' }}
          </text>
          
          <!-- 文件图标 -->
          <text :class="'file-icon icon-' + file.type">
            {{ getFileIcon(file) }}
          </text>
          
          <!-- 文件信息 -->
          <div class="file-info">
            <text class="file-name">{{ file.name }}</text>
            <div class="file-details">
              <text class="file-size">{{ formatFileSize(file.size) }}</text>
              <text class="file-modified">{{ file.modified }}</text>
              <text class="file-type">{{ getFileTypeText(file) }}</text>
            </div>
          </div>
          
          <!-- 操作按钮（悬停显示） -->
          <div v-if="!selectionMode" class="file-actions">
            <text @click.stop="editFile(file)" class="action-btn-small btn-primary-small">编</text>
            <text @click.stop="renameFile(file)" class="action-btn-small btn-warning-small">重</text>
            <text @click.stop="deleteFile(file)" class="action-btn-small btn-danger-small">删</text>
          </div>
        </div>
      </scroller>
    </div>
    
    <!-- 底部操作栏 -->
    <div v-if="selectionMode" class="bottom-bar">
      <text class="selection-info">{{ selectionText }}</text>
      <div class="bottom-actions">
        <text @click="clearSelection" class="bottom-btn btn-warning-small">取消</text>
        <text @click="batchDelete" class="bottom-btn btn-danger-small">删除</text>
      </div>
    </div>
    
    <!-- 上下文菜单 -->
    <div v-if="showMenu" :style="{ left: menuPosition.x + 'px', top: menuPosition.y + 'px' }" class="context-menu">
      <div v-if="menuPosition.file" class="menu-item" @click="openFile(menuPosition.file!)">打开</div>
      <div v-if="menuPosition.file && menuPosition.file.type !== 'directory'" class="menu-item" @click="editFile(menuPosition.file!)">编辑</div>
      <div v-if="menuPosition.file" class="menu-item" @click="renameFile(menuPosition.file!)">重命名</div>
      <div v-if="menuPosition.file" class="menu-item" @click="deleteFile(menuPosition.file!)">删除</div>
      <div class="menu-item" @click="createAndEditFile">新建文件</div>
      <div class="menu-item" @click="createDirectory">新建目录</div>
      <div class="menu-item" @click="toggleSelectAll">{{ files.length > 0 && files.every(f => f.selected) ? '取消全选' : '全选' }}</div>
      <div class="menu-item" @click="hideMenu">关闭</div>
    </div>
    
    <!-- 操作模态框 -->
    <div v-if="showOperationModal" class="operation-modal">
      <text class="modal-title">
        {{
          operationType === 'newfile' ? '新建文件' :
          operationType === 'newfolder' ? '新建目录' :
          operationType === 'rename' ? '重命名' :
          operationType === 'delete' ? '确认删除' : ''
        }}
      </text>
      
      <div v-if="operationType === 'newfile' || operationType === 'newfolder' || operationType === 'rename'">
        <input type="text" class="modal-input" 
               v-model="operationData.newName" 
               :placeholder="operationType === 'rename' ? '输入新名称' : '输入名称'" 
               auto-focus />
      </div>
      
      <div v-else-if="operationType === 'delete'">
        <text style="color: #ffffff; text-align: center; margin: 10px 0;">
          确定要删除 "{{ operationData.file?.name }}" 吗？
        </text>
        <text style="color: #ffc107; font-size: 12px; text-align: center;">
          此操作无法撤销！
        </text>
      </div>
      
      <div class="modal-buttons">
        <text @click="handleOperationConfirm" 
              :class="'bottom-btn' + (operationType === 'delete' ? ' btn-danger-small' : ' btn-success-small')">
          {{ operationType === 'delete' ? '删除' : '确定' }}
        </text>
        <text @click="handleOperationCancel" class="bottom-btn btn-warning-small">取消</text>
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
  },
  methods: {
    handleFileTouchStart(e: TouchEvent, file: FileItem) {
      this.touchStartTime = Date.now();
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchedFile = file;
    },
    
    handleFileTouchEnd(e: TouchEvent, file: FileItem) {
      const touchTime = Date.now() - this.touchStartTime;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const distanceX = Math.abs(touchEndX - this.touchStartX);
      const distanceY = Math.abs(touchEndY - this.touchStartY);
      
      // 长按触发上下文菜单
      if (touchTime > 500 && distanceX < 10 && distanceY < 10) {
        this.showContextMenu(e, file);
      }
    },
    
    toggleSort(field: 'name' | 'size' | 'modified' | 'type') {
      if (this.sortField === field) {
        this.sortAsc = !this.sortAsc;
      } else {
        this.sortField = field;
        this.sortAsc = true;
      }
    },
    
    batchDelete() {
      if (this.selectedFiles.length === 0) return;
      
      this.operationType = 'delete';
      this.operationData = { 
        files: [...this.selectedFiles],
        batch: true 
      };
      this.showOperationModal = true;
    }
  },
  data() {
    return {
      ...fileManager.data(),
      touchStartTime: 0,
      touchStartX: 0,
      touchStartY: 0,
      touchedFile: null as any
    };
  }
};
</script>