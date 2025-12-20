// Copyright (C) 2025 Langning Chen
// 
// This file is part of miniapp.
// 
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

import { defineComponent } from 'vue';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { Shell } from 'langningchen';

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system' | 'success' | 'warning' | 'info';
  content: string;
  timestamp: number;
}

interface QuickCommand {
  id: string;
  label: string;
  command: string;
  description: string;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      // 输入和状态
      inputText: '',
      isExecuting: false,
      currentDir: '/',
      shellInitialized: false,
      
      // 终端内容
      terminalLines: [] as TerminalLine[],
      
      // 命令历史
      commandHistory: [] as string[],
      historyIndex: -1,
      
      // 快速命令配置
      quickCommands: [
        { id: 'ls', label: 'ls', command: 'ls -la', description: '列出文件' },
        { id: 'pwd', label: 'pwd', command: 'pwd', description: '当前路径' },
        { id: 'ps', label: 'ps', command: 'ps aux | head -20', description: '进程列表' },
        { id: 'df', label: 'df', command: 'df -h', description: '磁盘空间' },
        { id: 'date', label: 'date', command: 'date "+%Y-%m-%d %H:%M:%S"', description: '系统时间' },
        { id: 'free', label: 'free', command: 'free -m', description: '内存使用' },
        { id: 'system', label: '系统', command: 'uname -a', description: '系统信息' },
        { id: 'network', label: '网络', command: 'ping -c 2 8.8.8.8', description: '网络测试' },
        { id: 'clear', label: '清屏', command: 'clear', description: '清屏' },
        { id: 'help', label: '帮助', command: 'help', description: '查看帮助' }
      ] as QuickCommand[],
    };
  },

  mounted() {
    console.log('Shell页面开始加载...');
    this.initializeShell();
    this.addWelcomeMessage();
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  computed: {
    canExecute(): boolean {
      return this.inputText.trim().length > 0 && !this.isExecuting && this.shellInitialized;
    }
  },

  methods: {
    // 初始化Shell模块
    async initializeShell() {
      try {
        this.addTerminalLine('system', '正在初始化Shell模块...');
        
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        await Shell.initialize();
        
        this.shellInitialized = true;
        this.addTerminalLine('success', '✓ Shell模块初始化成功');
        
        // 获取初始目录
        try {
          const pwdResult = await Shell.exec('pwd');
          this.currentDir = pwdResult.trim() || '/';
          this.addTerminalLine('info', `当前工作目录: ${this.currentDir}`);
        } catch (pwdError) {
          this.addTerminalLine('warning', '无法获取当前目录，使用默认目录 /');
          this.currentDir = '/';
        }
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        this.addTerminalLine('error', `✗ Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },
    
    // 添加终端行
    addTerminalLine(type: TerminalLine['type'], content: string) {
      const timestamp = Date.now();
      
      this.terminalLines.push({
        id: `line_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp
      });
      
      this.scrollToBottom();
    },
    
    // 添加欢迎消息
    addWelcomeMessage() {
      this.addTerminalLine('system', '═══════════════════════════════════════');
      this.addTerminalLine('system', '        Shell终端 v1.0.0');
      this.addTerminalLine('system', '═══════════════════════════════════════');
      this.addTerminalLine('info', '输入 "help" 查看帮助信息');
      this.addTerminalLine('info', '按↑↓键浏览历史命令');
    },
    
    // 执行命令
    async executeCommand() {
      const command = this.inputText.trim();
      if (!command || this.isExecuting) return;
      
      // 显示命令
      this.addTerminalLine('command', `${this.currentDir} $ ${command}`);
      
      // 保存到历史记录
      if (this.commandHistory[this.commandHistory.length - 1] !== command) {
        this.commandHistory.push(command);
      }
      this.historyIndex = this.commandHistory.length;
      this.inputText = '';
      
      // 处理内置命令
      if (await this.handleBuiltinCommand(command)) {
        return;
      }
      
      // 检查Shell状态
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', '错误: Shell模块未初始化');
        return;
      }
      
      // 执行真实命令
      await this.executeRealCommand(command);
    },
    
    // 处理内置命令
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      const lowerCmd = cmd.toLowerCase();
      
      switch (lowerCmd) {
        case 'help':
          this.showHelp();
          return true;
          
        case 'clear':
          this.clearTerminal();
          return true;
          
        case 'history':
          this.showHistory();
          return true;
          
        case 'reset':
          this.resetTerminal();
          return true;
          
        case 'test':
          await this.testShell();
          return true;
          
        case 'cd':
          // cd命令特殊处理 - 通过pwd获取新目录
          await this.handleCdCommand(args.join(' '));
          return true;
          
        default:
          return false;
      }
    },
    
    // 处理cd命令
    async handleCdCommand(path: string) {
      if (!path || path === '~') {
        path = '/';
      }
      
      try {
        // 使用绝对路径或者相对路径切换目录
        let cdCommand = '';
        if (path.startsWith('/')) {
          cdCommand = `cd "${path}" && pwd`;
        } else {
          cdCommand = `cd "${this.currentDir}/${path}" && pwd`;
        }
        
        const result = await Shell.exec(cdCommand);
        const newDir = result.trim();
        
        if (newDir) {
          this.currentDir = newDir;
          this.addTerminalLine('success', `目录已切换到: ${this.currentDir}`);
        } else {
          this.addTerminalLine('error', `切换目录失败: ${path}`);
        }
      } catch (error: any) {
        this.addTerminalLine('error', `无法切换到目录 ${path}: ${error.message}`);
      }
    },
    
    // 执行真实命令
    async executeRealCommand(command: string) {
      this.isExecuting = true;
      
      try {
        // 首先切换到当前目录，然后执行命令
        let fullCommand = command;
        if (this.currentDir !== '/' && this.currentDir !== '') {
          // 在指定目录下执行命令
          fullCommand = `cd "${this.currentDir}" && ${command} 2>&1`;
        }
        
        const startTime = Date.now();
        const result = await Shell.exec(fullCommand);
        const duration = Date.now() - startTime;
        
        // 处理输出结果，增强可读性
        if (result && result.trim()) {
          // 对输出进行格式化处理
          const formattedResult = this.formatOutput(result, command);
          this.addTerminalLine('output', formattedResult);
          this.addTerminalLine('success', `✓ 命令执行成功 (${duration}ms)`);
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
          this.addTerminalLine('success', `✓ 命令执行成功 (${duration}ms)`);
        }
        
      } catch (error: any) {
        console.error('命令执行失败:', error);
        
        // 提取有用的错误信息
        const errorMsg = error.message || '未知错误';
        this.addTerminalLine('error', `执行失败: ${errorMsg}`);
        
        // 提供有用的提示
        if (errorMsg.includes('permission denied')) {
          this.addTerminalLine('warning', '提示: 权限不足，可能需要root权限');
        } else if (errorMsg.includes('not found')) {
          this.addTerminalLine('warning', '提示: 命令不存在或路径错误');
        } else if (errorMsg.includes('No such file or directory')) {
          this.addTerminalLine('warning', '提示: 文件或目录不存在');
        } else if (errorMsg.includes('command not found')) {
          this.addTerminalLine('warning', '提示: 命令未找到，请检查命令拼写或安装相应工具');
        }
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 格式化输出
    formatOutput(output: string, command: string): string {
      // 如果是ls命令的输出，尝试添加颜色提示
      if (command.startsWith('ls') || command.includes('| grep')) {
        return this.colorizeLsOutput(output);
      }
      
      // 如果是df命令的输出，添加分隔线
      if (command.startsWith('df')) {
        return this.formatDfOutput(output);
      }
      
      // 如果是ps命令的输出，添加表头
      if (command.startsWith('ps')) {
        return this.formatPsOutput(output);
      }
      
      // 默认返回原始输出
      return output;
    },
    
    // 为ls输出添加颜色提示
    colorizeLsOutput(output: string): string {
      const lines = output.split('\n');
      const coloredLines = lines.map(line => {
        // 识别目录（以/结尾或以drwx开头）
        if (line.endsWith('/') || line.startsWith('drwx')) {
          return line;
        }
        // 识别可执行文件（包含*或x权限）
        if (line.includes('*') || /^[-rwx]+.*x/.test(line)) {
          return line;
        }
        // 识别符号链接（包含->）
        if (line.includes('->')) {
          return line;
        }
        // 普通文件
        return line;
      });
      
      return coloredLines.join('\n');
    },
    
    // 格式化df输出
    formatDfOutput(output: string): string {
      const lines = output.split('\n');
      if (lines.length > 0) {
        // 添加表头分隔线
        const headerLine = lines[0];
        const separator = '─'.repeat(headerLine.length);
        lines.splice(1, 0, separator);
        return lines.join('\n');
      }
      return output;
    },
    
    // 格式化ps输出
    formatPsOutput(output: string): string {
      const lines = output.split('\n');
      if (lines.length > 0) {
        // 为表头添加下划线
        const headerLine = lines[0];
        const separator = '─'.repeat(headerLine.length);
        lines.splice(1, 0, separator);
        return lines.join('\n');
      }
      return output;
    },
    
    // 测试Shell功能
    async testShell() {
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return;
      }
      
      this.addTerminalLine('system', '开始Shell功能测试...');
      
      const tests = [
        { cmd: 'echo "Shell终端测试"', desc: '基本命令测试', type: 'output' },
        { cmd: 'pwd', desc: '当前目录', type: 'output' },
        { cmd: 'ls /', desc: '根目录列表', type: 'output' },
        { cmd: 'date', desc: '系统时间', type: 'output' },
        { cmd: 'whoami', desc: '当前用户', type: 'output' }
      ];
      
      for (const test of tests) {
        try {
          const result = await Shell.exec(test.cmd);
          this.addTerminalLine(test.type as any, `${test.desc}: ${result.trim()}`);
        } catch (error: any) {
          this.addTerminalLine('error', `${test.desc}失败: ${error.message}`);
        }
        await this.delay(300);
      }
      
      this.addTerminalLine('success', '✓ Shell功能测试完成');
    },
    
    // 延迟函数
    delay(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // 显示帮助
    showHelp() {
      const helpText = `
╔═══════════════════════════════════════╗
║            Shell终端帮助              ║
╚═══════════════════════════════════════╝

【内置命令】
  help      - 显示此帮助信息
  clear     - 清空终端显示
  history   - 显示命令历史
  reset     - 重置终端
  test      - 测试Shell功能
  cd [目录] - 切换工作目录

【文件操作】
  ls -la              列出详细文件信息
  mkdir [目录]        创建目录
  rm [文件]           删除文件
  cp [源] [目标]      复制文件
  mv [源] [目标]      移动文件
  cat [文件]          查看文件内容

【系统信息】
  ps aux              查看进程列表
  df -h               磁盘使用情况
  free -m             内存使用情况
  uname -a            系统信息
  date                日期时间
  whoami              当前用户

【网络工具】
  ping [主机]         网络连通性测试
  curl [URL]          下载文件
  wget [URL]          下载文件

【应用安装】
  miniapp_cli install [amr文件]  安装应用

【使用技巧】
• 点击下方快速命令可快速执行
• 按↑↓键浏览历史命令
• 点击输入框可调出软键盘
• cd命令切换目录后会影响后续命令

状态: ${this.shellInitialized ? '✓ Shell已就绪' : '✗ Shell未初始化'}
`;
      this.addTerminalLine('info', helpText);
    },
    
    // 显示历史
    showHistory() {
      if (this.commandHistory.length === 0) {
        this.addTerminalLine('info', '命令历史为空');
        return;
      }
      
      let history = '命令历史记录:\n';
      this.commandHistory.forEach((cmd, index) => {
        const num = index + 1;
        history += `${num < 10 ? ' ' : ''}${num}. ${cmd}\n`;
      });
      
      this.addTerminalLine('output', history);
    },
    
    // 重置终端
    resetTerminal() {
      this.terminalLines = [];
      this.commandHistory = [];
      this.historyIndex = -1;
      this.inputText = '';
      this.currentDir = '/';
      this.addTerminalLine('system', '终端已重置');
      this.initializeShell();
    },
    
    // 清空终端
    clearTerminal() {
      this.terminalLines = [];
      this.addTerminalLine('system', '终端已清空');
    },
    
    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const scroller = this.$refs.terminalScroller as any;
        if (scroller && scroller.scrollTo) {
          setTimeout(() => {
            scroller.scrollTo({
              x: 0,
              y: 999999,
              animated: false
            });
          }, 50);
        }
      });
    },
    
    // 导航历史记录
    navigateHistory(direction: -1 | 1) {
      if (this.commandHistory.length === 0) return;
      
      if (direction === -1) {
        if (this.historyIndex > 0) this.historyIndex--;
        if (this.historyIndex >= 0) {
          this.inputText = this.commandHistory[this.historyIndex];
        }
      } else {
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = this.commandHistory[this.historyIndex];
        } else if (this.historyIndex === this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = '';
        }
      }
    },
    
    // 执行快速命令
    executeQuickCommand(command: string) {
      this.inputText = command;
      this.executeCommand();
    },
    
    // 打开软键盘
    openKeyboard() {
      openSoftKeyboard(
        () => this.inputText,
        (value) => {
          this.inputText = value;
          this.$forceUpdate();
        }
      );
    },
    
    // 处理返回键
    handleBackPress() {
      if (this.inputText.trim()) {
        this.inputText = '';
        this.$forceUpdate();
        return;
      }
      
      if (this.terminalLines.length > 5) {
        this.clearTerminal();
        this.addTerminalLine('info', '再次按返回键退出终端');
        return;
      }
      
      this.$page.finish();
    }
  }
});
