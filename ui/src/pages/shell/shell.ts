// Copyright (C) 2025 wyxdlz54188
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

// Shell API 类型定义
interface ShellAPI {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error';
  content: string;
  timestamp: number;
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
      showWelcome: true, // 新增：控制是否显示欢迎信息
      
      // 终端内容
      terminalLines: [] as TerminalLine[],
      
      // 命令历史
      commandHistory: [] as string[],
      historyIndex: -1,
      
      // Shell模块引用
      shellModule: null as ShellAPI | null,
    };
  },

  mounted() {
    console.log('Shell页面开始加载...');
    this.initializeShell();
    
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
    },
    
    // 显示终端行，包含可能的欢迎信息
    displayTerminalLines(): TerminalLine[] {
      const lines = [...this.terminalLines];
      
      // 只有在showWelcome为true且没有其他内容时才显示欢迎信息
      if (this.showWelcome && lines.length === 0 && this.shellInitialized) {
        return [
          {
            id: 'welcome-1',
            type: 'output',
            content: '基于langningchen.Shell模块',
            timestamp: Date.now()
          },
          {
            id: 'welcome-2',
            type: 'output',
            content: '输入 "help" 查看帮助',
            timestamp: Date.now()
          }
        ];
      }
      
      return lines;
    }
  },

  methods: {
    // 初始化Shell模块 - 静默版本
    async initializeShell() {
      try {
        // 直接使用从langningchen导入的Shell
        console.log('Shell模块by wyxdlz54188');
        
        // 检查Shell对象是否存在
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        // 检查initialize方法是否存在
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        // 初始化Shell
        await Shell.initialize();
        
        this.shellModule = Shell;
        this.shellInitialized = true;
        this.showWelcome = true; // 初始化完成时设置显示欢迎信息
        
        // 获取初始目录
        try {
          const result = await Shell.exec('pwd');
          this.currentDir = result.trim();
        } catch (error: any) {
          this.currentDir = '/';
        }
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        this.shellInitialized = false;
        this.showWelcome = false;
      }
    },
    
    // 添加终端行
    addTerminalLine(type: TerminalLine['type'], content: string) {
      // 当有内容添加时，隐藏欢迎信息
      if (this.showWelcome) {
        this.showWelcome = false;
      }
      
      const timestamp = Date.now();
      
      this.terminalLines.push({
        id: `line_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp
      });
      
      // 自动滚动
      this.scrollToBottom();
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
      
      // 检查Shell状态
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', '错误: Shell模块未初始化');
        return;
      }
      
      // 处理内置命令（包括vi）
      if (await this.handleBuiltinCommand(command)) {
        return;
      }
      
      // 执行命令（包含目录切换处理）
      await this.executeCommandWithDir(command);
    },
    
    // 处理内置命令（前端模拟的）
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      
      // 将命令转换为小写进行比较
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
          
        // 添加对vi命令的支持
        case 'vi':
        case 'vim':
          await this.handleViCommand(args);
          return true;
          
        case 'nano':
        case 'ed':
          // 静默处理其他编辑器命令
          await this.handleViCommand(args);
          return true;
          
        default:
          return false;
      }
    },
    
    // 处理vi/vim命令
    async handleViCommand(args: string[]) {
      if (args.length === 0) {
        this.addTerminalLine('error', '用法: vi <文件名>');
        return;
      }
      
      const fileName = args[0];
      let filePath = '';
      
      try {
        // 判断是相对路径还是绝对路径
        if (fileName.startsWith('/')) {
          // 绝对路径
          filePath = fileName;
        } else {
          // 相对路径 - 基于当前目录
          filePath = this.currentDir === '/' ? `/${fileName}` : `${this.currentDir}/${fileName}`;
        }
        
        // 直接跳转到文件编辑器页面
        setTimeout(() => {
          $falcon.navTo('fileEditor', {
            filePath: filePath,
            returnTo: 'shell',
            returnPath: this.currentDir,
          });
        }, 100);
        
      } catch (error: any) {
        this.addTerminalLine('error', `打开文件失败: ${error.message}`);
      }
    },
    
    // 执行命令（包含目录切换处理）
    async executeCommandWithDir(command: string) {
      this.isExecuting = true;
      
      try {
        // 首先检查是否是内置命令（包括vi）
        const [cmd, ...args] = command.split(' ');
        const lowerCmd = cmd.toLowerCase();
        
        // 如果是cd命令，特殊处理
        if (lowerCmd === 'cd') {
          await this.handleCdCommand(args);
          return;
        }
        
        console.log('执行命令:', command);
        
        // 记录开始时间
        const startTime = Date.now();
        
        // 使用langningchen.Shell.exec执行命令
        const fullCommand = `cd "${this.currentDir}" && ${command}`;
        const result = await Shell.exec(fullCommand);
        
        // 计算执行时间
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('命令执行结果:', result);
        console.log('执行耗时:', duration, 'ms');
        
        // 显示结果
        if (result && result.trim()) {
          this.addTerminalLine('output', result);
        }
        
      } catch (error: any) {
        console.error('命令执行失败:', error);
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 处理cd命令
    async handleCdCommand(args: string[]) {
      let targetPath = '';
      
      if (args.length === 0) {
        // cd without arguments goes to home directory
        targetPath = '~';
      } else {
        targetPath = args[0];
      }
      
      try {
        // 构建完整的cd命令
        let cdCommand = '';
        if (targetPath === '~') {
          cdCommand = 'cd ~ && pwd';
        } else if (targetPath.startsWith('/')) {
          // 绝对路径
          cdCommand = `cd "${targetPath}" && pwd`;
        } else {
          // 相对路径
          cdCommand = `cd "${this.currentDir}/${targetPath}" && pwd`;
        }
        
        // 执行cd命令并获取新目录
        const result = await Shell.exec(cdCommand);
        const newDir = result.trim();
        
        // 更新当前目录
        this.currentDir = newDir;
        
      } catch (error: any) {
        this.addTerminalLine('error', `cd: ${error.message || '无法切换目录'}`);
      }
    },
    
    // 测试Shell功能
    async testShell() {
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return;
      }
      
      const testCommands = [
        { cmd: 'echo "Shell测试成功"' },
        { cmd: 'ls' },
        { cmd: 'pwd' },
        { cmd: 'cd / && pwd' },
        { cmd: 'mkdir test_folder_123' },
        { cmd: 'ls' },
        { cmd: 'cd / && pwd' },
      ];
      
      for (const test of testCommands) {
        try {
          // 对于cd命令，特殊处理
          if (test.cmd.startsWith('cd')) {
            const args = test.cmd.replace('cd ', '').split(' && ');
            await this.handleCdCommand(args[0].split(' '));
            continue;
          }
          
          const result = await Shell.exec(`cd "${this.currentDir}" && ${test.cmd}`);
          if (result && result.trim()) {
            this.addTerminalLine('output', result.trim());
          }
        } catch (error: any) {
          this.addTerminalLine('error', `失败: ${error.message}`);
        }
        await this.delay(100);
      }
    },
    
    // 延迟函数
    delay(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // 显示帮助
    showHelp() {
      const helpText = `
可用命令:

=== 内置命令 ===
help          显示帮助信息
clear         清空终端显示
history       显示命令历史
reset         重置终端
test          测试Shell功能
vi <文件>     编辑文本文件

=== 真实Shell命令 ===
所有Linux命令都可以直接执行：

文件操作:
  ls            列出文件
  ls -la        详细文件列表
  cd [目录]     切换目录
  pwd           显示当前目录
  cat [文件]    查看文件
  mkdir [目录]  创建目录
  rm [文件]     删除文件
  touch [文件]  创建文件
  vi <文件>     编辑文件

系统信息:
  ps aux        查看进程
  df -h         磁盘使用情况
  free -m       内存使用情况
  uname -a      系统信息
  date          日期时间

网络工具:
  ping [主机]   网络连通性测试
  curl [URL]    下载文件
  wget [URL]    下载文件

安装应用:
  miniapp_cli install [amr文件]  安装应用
`;
      this.addTerminalLine('output', helpText);
    },
    
    // 显示历史
    showHistory() {
      if (this.commandHistory.length === 0) {
        this.addTerminalLine('output', '命令历史为空');
        return;
      }
      
      let history = '命令历史:\n';
      this.commandHistory.forEach((cmd, index) => {
        history += `${index + 1}. ${cmd}\n`;
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
      this.showWelcome = true; // 重置后显示欢迎信息
      this.initializeShell();
    },
    
    // 清空终端
    clearTerminal() {
      this.terminalLines = [];
      this.showWelcome = false; // 清空后不显示欢迎信息
    },
    
    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const scroller = this.$refs.scroller as any;
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
      
      this.$page.finish();
    }
  }
});