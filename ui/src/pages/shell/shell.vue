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

    <!-- 输入区域（输入框保持原样） -->
    <div class="input-section">
      <div class="input-container" @click="openKeyboard">
        <text class="input-text">{{ inputText || '点击输入命令...' }}</text>
      </div>

      <!-- ========== 横向滑动工具栏（替换原来的 action-buttons） ========== -->
      <scroll-view
        class="tool-scroll"
        scroll-x="true"
        show-scrollbar="false"
      >
        <div class="tool-inner">
          <!-- 原始功能：执行（保持行为） -->
          <div
            class="btn tool-btn btn-execute"
            :class="{ 'btn-disabled': !canExecute }"
            @click="executeCommand"
          >执行</div>

          <!-- 原始功能：清空 -->
          <div
            class="btn tool-btn btn-clear"
            @click="clearTerminal"
          >清空</div>

          <!-- 跳转到 shellSettings -->
          <div class="btn tool-btn btn-settings" @click="openShellSettings">⚙</div>

          <!-- 动态显示启用的工具脚本 -->
          <div
            v-for="script in enabledScripts"
            :key="script.name"
            class="btn tool-btn btn-script"
            @click="runToolScript(script)"
          >
            {{ script.name }}
          </div>

          <!-- 如果没有任何脚本（toolshell 为空），显示新建入口 -->
          <div
            v-if="!hasAnyScript"
            class="btn tool-btn btn-create"
            @click="openShellSettingsAndCreate"
          >+ 新建脚本</div>
        </div>
      </scroll-view>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('shell.less');

/* 新增横向工具栏样式，尽量与原样式配色一致 */
.tool-scroll {
  height: 50px;
  display: flex;
  align-items: center;
  background-color: #1a1a1a; /* 与 input-section 背景一致 */
  margin-left: 8px;
}

.tool-inner {
  display: flex;
  flex-direction: row;
  gap: 6px;
  padding: 6px;
  align-items: center;
}

.tool-btn {
  min-width: 56px;
  height: 36px;
  padding: 0 10px;
  line-height: 36px;
  text-align: center;
  border-radius: 4px;
  background-color: #333333;
  color: #ffffff;
  font-size: 14px;
}

/* 保留原来的 btn-execute / btn-clear 样式语义（若你在 less 中有对应 class，会继续生效） */
.btn-execute.btn-disabled {
  opacity: 0.5;
}

.btn-clear {
  background-color: #444444;
}

.btn-settings {
  background-color: #333333;
}

.btn-script {
  background-color: #444;
}

.btn-create {
  background-color: #007acc;
}
</style>

<script>
import shell from './shell';
export default shell;
</script>
