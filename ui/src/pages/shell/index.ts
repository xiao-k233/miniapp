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

// Shell API 类型定义
interface ShellAPI {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
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
      currentDir: '/oem/YoudaoDictPen/output', // 设置默认目录为实际目录
      actualCurrentDir: '/oem/YoudaoDictPen/output', // 保存实际目录
      shellInitialized: false,
      
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
        
        // 直接使用从langningchen导入的Shell
        console.log('使用langningchen.Shell模块...');
        
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
        
        // 获取当前实际目录
        try {
          const pwdResult = await Shell.exec('pwd');
          const actualDir = pwdResult.trim();
          this.actualCurrentDir = actualDir;
          this.currentDir = actualDir;
          
          this.addTerminalLine('system', '✓ Shell模块初始化成功');
          this.addTerminalLine('system', `当前目录: ${this.currentDir}`);
        } catch (error: any) {
          this.addTerminalLine('system', '✓ Shell模块初始化成功');
          this.addTerminalLine('system', `当前目录: ${this.currentDir} (使用默认目录)`);
        }
        
        // 测试Shell功能
        setTimeout(async () => {
          try {
            this.addTerminalLine('system', '测试Shell功能...');
            const result = await Shell.exec('echo "Shell终端已就绪"');
            this.addTerminalLine('output', result.trim());
          } catch (error: any) {
            this.addTerminalLine('error', `Shell测试失败: ${error.message}`);
          }
        }, 500);
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        this.addTerminalLine('error', `✗ Shell模块初始化失败`);
        this.addTerminalLine('error', `错误信息: ${error.message}`);
        
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
      
      // 自动滚动
      this.scrollToBottom();
    },
    
    // 添加欢迎消息
    addWelcomeMessage() {
      this.addTerminalLine('system', '=== Shell终端 ===');
      this.addTerminalLine('system', '基于langningchen.Shell模块');
      this.addTerminalLine('system', '状态: ' + (this.shellInitialized ? '已就绪' : '初始化中...'));
      this.addTerminalLine('system', '输入 "help" 查看帮助');
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
        this.addTerminalLine('system', '请尝试重新初始化: 输入 "reset" 命令');
        return;
      }
      
      // 执行真实的shell命令
      await this.executeRealShellCommand(command);
    },
    
    // 处理内置命令（前端模拟的）
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'help':
          this.showHelp();
          return true;
          
        case 'clear':
          this.clearTerminal();
          return true;
          
        case 'pwd':
          // 返回实际目录
          this.addTerminalLine('output', this.actualCurrentDir);
          return true;
          
        case 'cd':
          // 真正的目录切换
          return await this.handleCdCommand(args);
          
        case 'history':
          this.showHistory();
          return true;
          
        case 'reset':
          this.resetTerminal();
          return true;
          
        case 'test':
          await this.testShell();
          return true;
          
        case 'realpwd':
          // 获取真实的工作目录
          try {
            const result = await Shell.exec('pwd');
            this.addTerminalLine('output', result.trim());
            this.addTerminalLine('system', `前端显示目录: ${this.currentDir}`);
          } catch (error: any) {
            this.addTerminalLine('error', `获取目录失败: ${error.message}`);
          }
          return true;
          
        default:
          return false;
      }
    },
    
    // 处理cd命令
    async handleCdCommand(args: string[]): Promise<boolean> {
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return true;
      }
      
      let targetPath = '';
      
      if (args.length === 0) {
        // cd without arguments goes to home directory
        targetPath = '~';
      } else {
        targetPath = args[0];
      }
      
      try {
        // 执行cd命令
        const result = await Shell.exec(`cd "${targetPath}" && pwd`);
        const newDir = result.trim();
        
        // 更新目录
        this.actualCurrentDir = newDir;
        this.currentDir = newDir;
        
        this.addTerminalLine('output', newDir);
        this.addTerminalLine('system', '目录切换成功');
        
      } catch (error: any) {
        this.addTerminalLine('error', `cd: ${error.message || '无法切换目录'}`);
        
        // 尝试使用绝对路径
        if (!targetPath.startsWith('/') && targetPath !== '~') {
          const absolutePath = `${this.actualCurrentDir}/${targetPath}`;
          try {
            const result = await Shell.exec(`cd "${absolutePath}" && pwd`);
            const newDir = result.trim();
            this.actualCurrentDir = newDir;
            this.currentDir = newDir;
            this.addTerminalLine('output', newDir);
            this.addTerminalLine('system', '目录切换成功 (使用绝对路径)');
          } catch (absError: any) {
            this.addTerminalLine('error', `cd: 无法切换到目录 "${targetPath}"`);
          }
        }
      }
      
      return true;
    },
    
    // 执行真实的shell命令
    async executeRealShellCommand(command: string) {
      this.isExecuting = true;
      
      try {
        console.log('执行真实shell命令:', command);
        
        // 记录开始时间
        const startTime = Date.now();
        
        // 使用langningchen.Shell.exec执行命令
        const result = await Shell.exec(command);
        
        // 计算执行时间
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('命令执行结果:', result);
        console.log('执行耗时:', duration, 'ms');
        
        // 显示结果
        if (result && result.trim()) {
          this.addTerminalLine('output', result);
          this.addTerminalLine('system', `✓ 执行完成 (${duration}ms)`);
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
          this.addTerminalLine('system', `✓ 执行完成 (${duration}ms)`);
        }
        
      } catch (error: any) {
        console.error('命令执行失败:', error);
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
        
        // 常见错误提示
        if (error.message.includes('permission denied')) {
          this.addTerminalLine('system', '提示: 权限不足，可能需要root权限');
        } else if (error.message.includes('not found')) {
          this.addTerminalLine('system', '提示: 命令不存在或路径错误');
        } else if (error.message.includes('timeout')) {
          this.addTerminalLine('system', '提示: 命令执行超时');
        } else if (error.message.includes('No such file or directory')) {
          this.addTerminalLine('system', '提示: 文件或目录不存在');
        }
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 测试Shell功能
    async testShell() {
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return;
      }
      
      this.addTerminalLine('system', '开始Shell功能测试...');
      
      const testCommands = [
        { cmd: 'echo "Shell测试成功"', desc: '基本echo命令' },
        { cmd: 'ls -la', desc: '当前目录列表' },
        { cmd: 'pwd', desc: '当前路径' },
        { cmd: 'cd / && pwd', desc: '切换到根目录' },
        { cmd: 'cd /oem && pwd', desc: '切换到/oem目录' },
        { cmd: 'cd /oem/YoudaoDictPen && pwd', desc: '切换到YoudaoDictPen目录' },
        { cmd: 'cd /oem/YoudaoDictPen/output && pwd', desc: '切换回output目录' },
      ];
      
      for (const test of testCommands) {
        try {
          this.addTerminalLine('system', `测试: ${test.desc}...`);
          const result = await Shell.exec(test.cmd);
          this.addTerminalLine('output', `${test.desc}: ${result.trim()}`);
        } catch (error: any) {
          this.addTerminalLine('error', `${test.desc}失败: ${error.message}`);
        }
        await this.delay(300); // 延迟避免过快
      }
      
      this.addTerminalLine('system', 'Shell测试完成');
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
pwd           显示当前目录
cd [目录]     切换目录
realpwd       显示真实的当前目录（从shell获取）

=== 目录切换示例 ===
cd /                    切换到根目录
cd /oem                切换到oem目录
cd /oem/YoudaoDictPen  切换到YoudaoDictPen目录
cd ..                  返回上一级目录
cd                     返回家目录（通常是根目录）

=== 真实Shell命令示例 ===
所有Linux命令都可以直接执行：

文件操作:
  ls            列出文件
  ls -la        详细文件列表
  cat [文件]    查看文件
  mkdir [目录]  创建目录
  rm [文件]     删除文件
  cp [源] [目标] 复制文件
  mv [源] [目标] 移动文件

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

状态: ${this.shellInitialized ? 'Shell模块已就绪' : 'Shell模块未初始化'}
当前目录: ${this.currentDir}
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
      this.currentDir = '/oem/YoudaoDictPen/output';
      this.actualCurrentDir = '/oem/YoudaoDictPen/output';
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
        this.addTerminalLine('system', '再次按返回键退出');
        return;
      }
      
      this.$page.finish();
    }
  }
});