<template>
  <div class="container">
    <!-- 终端输出区域 -->
    <div 
      class="output-area"
      ref="outputRef"
      @click="focusInput"
    >
      <div 
        v-for="(item, index) in history"
        :key="index"
        :class="['output-line', getHistoryClass(item)]"
      >
        <span class="line-content">
          {{ item.content }}
        </span>
      </div>
      
      <!-- 当前命令行提示 -->
      <div class="command-prompt" v-if="!isExecuting">
        <span class="prompt">{{ currentDir }} $</span>
        <span class="cursor">█</span>
      </div>
      
      <!-- 执行中提示 -->
      <div class="executing-prompt" v-else>
        <span class="loading">执行中...</span>
        <span class="blinking-cursor">█</span>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-bar">
      <!-- 命令输入 -->
      <input
        ref="cmdInput"
        v-model="inputCommand"
        class="cmd-input"
        type="text"
        :placeholder="isExecuting ? '命令执行中...' : '输入命令，按回车执行'"
        :disabled="isExecuting"
        @keydown="handleKeyDown"
        @focus="scrollToBottom"
      />
      
      <!-- 按钮组 -->
      <div class="btn-group">
        <button 
          class="btn run-btn" 
          @click="executeCommand"
          :disabled="isExecuting || !inputCommand.trim()"
        >
          {{ isExecuting ? '执行中' : '执行' }}
        </button>
        <button 
          class="btn clear-btn" 
          @click="clearTerminal"
          :disabled="isExecuting"
        >
          清屏
        </button>
      </div>
    </div>
    
    <!-- 快速命令按钮 -->
    <div class="quick-commands" v-if="!isExecuting">
      <span class="quick-title">快速命令:</span>
      <button 
        v-for="cmd in quickCommands"
        :key="cmd.label"
        class="quick-btn"
        @click="inputCommand = cmd.command; executeCommand()"
      >
        {{ cmd.label }}
      </button>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import terminalLogic from './index.ts';

export default defineComponent({
  ...terminalLogic,
  data() {
    return {
      quickCommands: [
        { label: 'ls', command: 'ls -la' },
        { label: 'pwd', command: 'pwd' },
        { label: 'date', command: 'date' },
        { label: 'ps', command: 'ps aux' },
        { label: '网络', command: 'ping -c 3 8.8.8.8' },
        { label: '磁盘', command: 'df -h' },
        { label: '内存', command: 'free -m' },
        { label: '系统', command: 'uname -a' },
        { label: '清屏', command: 'clear' }
      ]
    };
  }
});
</script>

<style scoped src="./index.less"></style>