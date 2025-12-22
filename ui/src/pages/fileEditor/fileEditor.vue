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
  <div class="editor-container">
    <!-- 标题栏 -->
    <div class="editor-header">
      <text class="header-title">{{ fileName }}</text>
      <div class="header-actions">
        <text v-if="isModified" style="color: #ffc107; font-size: 12px;">已修改</text>
        <text @click="exitEditor" class="toolbar-btn toolbar-btn-danger">关闭</text>
      </div>
    </div>
    
    <!-- 编辑区域 -->
    <div class="editor-content">
      <!-- 行号 -->
      <scroller class="line-numbers-scroller" scroll-direction="vertical">
        <div class="line-numbers-container">
          <text v-for="lineNum in lineNumbers" :key="lineNum" class="line-number">
            {{ lineNum }}
          </text>
        </div>
      </scroller>
      
      <!-- 文本编辑区域 -->
      <scroller class="editor-scroller" ref="scroller" scroll-direction="vertical" 
                :show-scrollbar="true">
        <textarea class="editor-textarea" ref="textarea"
                  v-model="fileContent"
                  @input="onContentChange"
                  placeholder="在此输入文本..."
                  wrap="off"
                  spellcheck="false"
                  autocorrect="off"
                  autocapitalize="off">
        </textarea>
      </scroller>
    </div>
    
    <!-- 状态栏 -->
    <div class="editor-status">
      <text class="status-item status-cursor">{{ fileStats }}</text>
      <text class="status-item status-size">{{ getFileInfo() }}</text>
      <text v-if="isModified" class="status-item" style="color: #ffc107;">已修改</text>
    </div>
    
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <text @click="openKeyboard" class="toolbar-btn">键盘</text>
      <text @click="saveFile" :class="'toolbar-btn' + (canSave ? ' toolbar-btn-success' : '')" 
            :style="{ opacity: canSave ? 1 : 0.5 }">保存</text>
      <text @click="showSaveAsDialog" class="toolbar-btn toolbar-btn-warning">另存为</text>
      <text @click="clearContent" class="toolbar-btn toolbar-btn-danger">清空</text>
      <text @click="showFindDialog" class="toolbar-btn">查找</text>
      <text @click="findPrev" class="toolbar-btn">上一条</text>
      <text @click="findNext" class="toolbar-btn">下一条</text>
      <text @click="showGoToDialog" class="toolbar-btn">跳转行</text>
    </div>
    
    <!-- 查找对话框 -->
    <div v-if="showFindModal" class="editor-modal">
      <text class="modal-title">查找文本</text>
      <div class="modal-content">
        <input type="text" class="modal-input" v-model="findText" placeholder="输入要查找的文本" />
        <text v-if="findResults.length > 0" style="color: #28a745; font-size: 14px;">
          找到 {{ findResults.length }} 个匹配项
        </text>
      </div>
      <div class="modal-buttons">
        <text @click="performFind" class="toolbar-btn toolbar-btn-success">查找</text>
        <text @click="showFindModal = false" class="toolbar-btn toolbar-btn-danger">取消</text>
      </div>
    </div>
    
    <!-- 跳转行对话框 -->
    <div v-if="showGoToModal" class="editor-modal" style="width: 250px;">
      <text class="modal-title">跳转到行</text>
      <div class="modal-content">
        <input type="number" class="modal-input" :value="1" 
               @input="(e) => goToLine(parseInt(e.value) || 1)"
               placeholder="输入行号 (1 - {{ totalLines }})" />
      </div>
      <div class="modal-buttons">
        <text @click="showGoToModal = false" class="toolbar-btn toolbar-btn-danger">取消</text>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmModal" class="save-confirm">
      <text class="confirm-title">{{ confirmTitle }}</text>
      <div class="confirm-buttons">
        <text @click="executeConfirmAction(confirmAction)" class="toolbar-btn toolbar-btn-danger">确定</text>
        <text @click="showConfirmModal = false" class="toolbar-btn">取消</text>
      </div>
    </div>
    
    <Loading />
    <ToastMessage />
  </div>
</template>

<style lang="less" scoped>
@import url('fileEditor.less');
</style>

<script>
import fileEditor from './fileEditor';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';
export default {
  ...fileEditor,
  components: {
    Loading,
    ToastMessage
  }
};
</script>