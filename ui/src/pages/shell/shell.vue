<template>
  <div class="container">
    <div class="terminal-content">
      <scroller 
        class="terminal-scroller"
        ref="scroller"
        scroll-direction="vertical"
        :show-scrollbar="true"
      >
        <div v-for="line in terminalLines" :key="line.id" class="terminal-line">
          <!-- 使用简单直接的类名 -->
          <text class="line-text" :class="'line-text-' + line.type">{{ line.content }}</text>
        </div>
        
        <div class="command-prompt">
          <text class="prompt">{{ currentDir }} $</text>
          <text v-if="!isExecuting" class="cursor" :style="{ opacity: cursorVisible ? 1 : 0 }">█</text>
          <text v-else class="loading">⌛ 执行中...</text>
        </div>
      </scroller>
    </div>

    <div class="input-section">
      <div class="input-container" @click="openKeyboard">
        <text class="input-text">{{ inputText || '点击输入命令...' }}</text>
      </div>
      <div class="action-buttons">
        <text class="btn btn-execute" @click="executeCommand">发送</text>
      </div>
      <div class="action-buttons">
        <text class="btn btn-clear" @click="clearTerminal">清空</text>
      </div>
    </div>
  </div>
</template>

<script>
import shell from './shell';

// 正确扩展组件
export default {
  mixins: [shell],  // 使用 mixins 而不是展开操作符
  
  data() {
    return {
      cursorVisible: true
    };
  },
  
  mounted() {
    // 光标闪烁
    this.cursorInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 500);
  },
  
  beforeUnmount() {
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
    }
  }
};
</script>
