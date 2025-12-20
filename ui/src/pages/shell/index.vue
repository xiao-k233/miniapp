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
  <div class="container">
    <!-- 终端输出区域 -->
    <div class="terminal-content">
      <scroller 
        class="terminal-scroller"
        ref="scroller"
        scroll-direction="vertical"
        :show-scrollbar="true"
      >
        <div v-for="line in terminalLines" :key="line.id" class="terminal-line">
          <text :class="['line-text', line.type]">{{ line.content }}</text>
        </div>
        
        <!-- 命令提示符 -->
        <div class="command-prompt">
          <text class="prompt">{{ currentDir }} $</text>
          <text v-if="!isExecuting" class="cursor">█</text>
          <text v-else class="loading">⌛ 执行中...</text>
        </div>
      </scroller>
    </div>

    <!-- 快速命令区域 -->
    <div class="quick-commands-section">
      <text class="section-title">快速命令</text>
      <scroller 
        class="quick-commands-container"
        scroll-direction="horizontal"
        :show-scrollbar="true"
      >
        <div 
          v-for="cmd in quickCommands"
          :key="cmd.label"
          class="quick-command"
          @click="executeQuickCommand(cmd.command)"
        >
          <text class="quick-label">{{ cmd.label }}</text>
          <text class="quick-desc">{{ cmd.description }}</text>
        </div>
      </scroller>
    </div>

    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-container" @click="openKeyboard">
        <text class="input-text">{{ inputText || '点击输入命令...' }}</text>
      </div>
      
      <div class="action-buttons">
        <text 
          class="btn btn-execute"
          :class="{ 'btn-disabled': !canExecute }"
          @click="executeCommand"
        >
          执行
        </text>
        <text 
          class="btn btn-clear"
          @click="clearTerminal"
        >
          清屏
        </text>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('./index.less');
</style>

<script>
import shell from './index';
export default shell;
</script>