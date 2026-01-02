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
          <!-- 使用正确的类名语法 -->
          <text class="line-text" :class="`line-text-${line.type}`">{{ line.content }}</text>
        </div>
        
        <!-- 命令提示符 -->
        <div class="command-prompt">
          <text class="prompt">{{ currentDir }} $</text>
          <!-- 修改光标闪烁实现 -->
          <text v-if="!isExecuting" 
                class="cursor" 
                :style="{ opacity: cursorVisible ? 1 : 0 }">█</text>
          <text v-else class="loading">⌛ 执行中...</text>
        </div>
      </scroller>
    </div>

    <!-- 输入区域 -->
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

<style lang="less" scoped>
@import url('shell.less');
</style>

<script>
import shell from './shell';
export default {
  ...shell,
  data() {
    return {
      ...(shell.data ? shell.data() : {}),
      cursorVisible: true,
      cursorInterval: null
    };
  },
  mounted() {
    // 添加光标闪烁效果
    this.cursorInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 500);
  },
  beforeUnmount() {
    // 清理定时器
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
    }
  }
};
</script>
