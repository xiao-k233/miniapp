// src/pages/shell/shell.ts
import { defineComponent } from 'vue';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { Shell } from 'langningchen';
import { showInfo } from '../../components/ToastMessage';

const TOOL_DIR = '/userdisk/paper/toolshell';
const ENABLE_KEY = 'toolshell_enable';

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

      // 输入和状态（原有）
      inputText: '',
      isExecuting: false,
      currentDir: '/',
      shellInitialized: false,

      // 终端内容
      terminalLines: [] as TerminalLine[],

      // 命令历史
      commandHistory: [] as string[],
      historyIndex: -1,

      // Shell模块引用
      shellModule: null as ShellAPI | null,

      // ===== 新增：toolshell 支持 =====
      enabledScripts: [] as { name: string; path: string }[],
      hasAnyScript: false,
      enableMap: {} as Record<string, boolean>,
    };
  },

  mounted() {
    console.log('Shell页面开始加载...');
    this.initializeShell();
    this.addWelcomeMessage();

    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on('backpressed', this.handleBackPress);

    // 当页面重新显示时刷新脚本（shellSettings 可能修改了 storage 或文件）
    this.$page.on('show', this.onPageShow);
  },

  beforeDestroy() {
    this.$page.$npage.off('backpressed', this.handleBackPress);
    this.$page.off('show', this.onPageShow);
  },

  computed: {
    canExecute(): boolean {
      return this.inputText.trim().length > 0 && !this.isExecuting && this.shellInitialized;
    }
  },

  methods: {
    async onPageShow() {
      // 切回前台时刷新脚本
      await this.loadEnableMap();
      await this.scanToolScripts();
    },

    /********** 原有初始化与 Shell 操作（保留并稍作整理） **********/
    async initializeShell() {
      try {
        this.addTerminalLine('system', '正在初始化Shell模块.');

        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }

        await Shell.initialize();
        this.shellModule = Shell;
        this.shellInitialized = true;
        this.addTerminalLine('system', 'Shell模块初始化成功');

        // 获取初始目录
        try {
          const result = await Shell.exec('pwd');
          this.currentDir = result.trim() || '/';
          this.addTerminalLine('system', `当前目录: ${this.currentDir}`);
        } catch {
          this.addTerminalLine('system', `当前目录: / (默认)`);
        }

        // 额外：初始化 toolshell 目录和脚本数据
        await this.ensureToolDir();
        await this.loadEnableMap();
        await this.scanToolScripts();

        // 测试Shell功能（保持原项目行为）
        setTimeout(async () => {
          try {
            const result = await Shell.exec('echo "Shell终端已就绪"');
            this.addTerminalLine('output', result.trim());
          } catch (error: any) {
            this.addTerminalLine('error', `Shell测试失败: ${error.message}`);
          }
        }, 500);
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        this.addTerminalLine('error', `Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },

    addWelcomeMessage() {
      // 保留原叫法（如果原来有欢迎信息）
      // 你可以自定义欢迎
      this.addTerminalLine('system', '欢迎使用 Shell 终端');
    },

    addTerminalLine(type: TerminalLine['type'], content: string) {
      const timestamp = Date.now();
      this.terminalLines.push({
        id: `line_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp
      });
      // 滚到最底部：尝试调用 scroller（如果存在）
      try {
        (this.$refs.scroller as any)?.scrollToBottom?.();
      } catch {}
    },

    /********** 执行命令（与原逻辑一致） **********/
    async executeCommand() {
      if (!this.canExecute) return;
      const command = this.inputText.trim();
      this.inputText = '';
      this.commandHistory.push(command);
      this.historyIndex = this.commandHistory.length;
      await this._execCommand(command);
    },

    async _execCommand(command: string) {
      try {
        this.isExecuting = true;
        this.addTerminalLine('command', command);

        const fullCommand = `cd "${this.currentDir}" && ${command}`;
        const result = await Shell.exec(fullCommand);

        if (result && result.trim()) {
          this.addTerminalLine('output', result.trim());
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
        }
      } catch (error: any) {
        console.error('命令执行失败:', error);
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
      } finally {
        this.isExecuting = false;
      }
    },

    /********** cd 命令特殊处理（保留原逻辑） **********/
    async handleCdCommand(args: string[]) {
      let targetPath = '';
      if (args.length === 0) targetPath = '~';
      else targetPath = args[0];

      try {
        let cdCommand = '';
        if (targetPath === '~') {
          cdCommand = 'cd ~ && pwd';
        } else if (targetPath.startsWith('/')) {
          cdCommand = `cd "${targetPath}" && pwd`;
        } else {
          cdCommand = `cd "${this.currentDir}/${targetPath}" && pwd`;
        }
        const result = await Shell.exec(cdCommand);
        const newDir = result.trim();
        this.currentDir = newDir;
        this.addTerminalLine('output', newDir);
      } catch (error: any) {
        this.addTerminalLine('error', `cd: ${error.message || '无法切换目录'}`);
      }
    },

    /********** 辅助与 UI 逻辑（保留） **********/
    openKeyboard() {
      openSoftKeyboard(
        () => this.inputText,
        (value) => {
          this.inputText = value;
          this.$forceUpdate();
        }
      );
    },

    clearTerminal() {
      this.terminalLines = [];
      this.addTerminalLine('system', '终端已清空');
    },

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
    },

    /********** ====== toolshell 功能 ====== **********/

    // 确保目录存在（使用 shell mkdir -p）
    async ensureToolDir() {
      try {
        await Shell.exec(`mkdir -p ${TOOL_DIR}`);
      } catch (e) {
        console.warn('ensureToolDir 失败', e);
      }
    },

    // 读取启用状态 map（从 storage）
    async loadEnableMap() {
      try {
        const res = await $falcon.jsapi.storage.getStorage({ key: ENABLE_KEY });
        this.enableMap = JSON.parse(res.data || '{}');
      } catch {
        this.enableMap = {};
      }
    },

    async saveEnableMap() {
      await $falcon.jsapi.storage.setStorage({
        key: ENABLE_KEY,
        data: JSON.stringify(this.enableMap),
      });
    },

    // 扫描 toolshell 下的 .sh 文件，并填充 enabledScripts
    async scanToolScripts() {
      try {
        // 尝试 ls
        const res = await Shell.exec(`ls -1 ${TOOL_DIR}`).catch(() => '');
        const lines = (res || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const shFiles = lines.filter(l => l.endsWith('.sh'));

        this.hasAnyScript = shFiles.length > 0;

        const enabledList: { name: string; path: string }[] = [];
        for (const f of shFiles) {
          const name = f.replace(/\.sh$/, '');
          if (this.enableMap[name]) {
            enabledList.push({ name, path: `${TOOL_DIR}/${f}` });
          }
        }
        this.enabledScripts = enabledList;
      } catch (e) {
        console.warn('scanToolScripts 出错', e);
        this.enabledScripts = [];
        this.hasAnyScript = false;
      }
    },

    // 在工具栏点击脚本按钮时，执行脚本并回显
    async runToolScript(script: { name: string; path: string }) {
      try {
        this.addTerminalLine('command', `执行脚本: ${script.path}`);
        const result = await Shell.exec(`"${script.path}"`); // 直接执行脚本路径
        if (result && result.trim()) this.addTerminalLine('output', result.trim());
        else this.addTerminalLine('output', '脚本执行完成，无输出');
      } catch (e: any) {
        this.addTerminalLine('error', `脚本执行失败: ${e.message || e}`);
      }
    },

    // 打开 shellSettings 页面
    openShellSettings() {
      $falcon.navTo('shellSettings', {});
    },

    // 打开 shellSettings 并直接触发新建（如果想要从工具栏直接新建）
    openShellSettingsAndCreate() {
      $falcon.navTo('shellSettings', { create: true });
    },
  },
});
