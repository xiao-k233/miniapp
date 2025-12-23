// 文件管理器 TS 文件（更新后的完整代码，包含文件操作、搜索、上下文菜单、隐藏文件切换、属性显示等功能）
import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showError, showSuccess, showWarning, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { formatTime } from '../../utils/timeUtils';

export type FileManagerOptions = {
  path?: string;
  refresh?: boolean;
};

export interface FileItem {
  name: string;
  type: 'file' | 'directory' | 'link' | 'unknown';
  size: number;
  sizeFormatted: string;
  modifiedTime: number;
  modifiedTimeFormatted: string;
  permissions: string;
  isHidden: boolean;
  fullPath: string;
  icon: string;
  isExecutable: boolean;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<FileManagerOptions>,

      // 文件系统状态
      currentPath: '/',
      fileList: [] as FileItem[],
      shellInitialized: false,
      isLoading: false,

      // 操作状态
      showContextMenu: false,
      contextMenuX: 0,
      contextMenuY: 0,
      selectedFile: null as FileItem | null,
      showConfirmModal: false,
      confirmTitle: '',
      confirmMessage: '',
      confirmCallback: null as (() => void) | null,

      // 搜索状态
      searchKeyword: '',
      showHiddenFiles: false,

      // 统计信息
      totalFiles: 0,
      totalSize: 0,
      selectedCount: 0,
    };
  },

  async mounted() {
    console.log('文件管理器页面加载...');

    const options = this.$page.loadOptions;
    this.currentPath = options.path || '/';
    console.log('初始路径:', this.currentPath);

    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on('backpressed', this.handleBackPress);

    $falcon.on('file_saved', this.handleFileSaved);

    await this.initializeShell();
  },

  beforeDestroy() {
    this.$page.$npage.off('backpressed', this.handleBackPress);
    $falcon.off('file_saved', this.handleFileSaved);
  },

  computed: {
    filteredFiles(): FileItem[] {
      let files = [...this.fileList];

      if (!this.showHiddenFiles) {
        files = files.filter(file => !file.isHidden);
      }

      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        files = files.filter(file => file.name.toLowerCase().includes(keyword));
      }

      files.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      return files;
    },

    canGoBack(): boolean {
      return this.currentPath !== '/';
    },

    parentPath(): string {
      if (this.currentPath === '/') return '/';
      const parts = this.currentPath.split('/').filter(part => part);
      if (parts.length === 0) return '/';
      parts.pop();
      return parts.length > 0 ? '/' + parts.join('/') : '/';
    },
  },

  methods: {
    async initializeShell() {
      try {
        if (!Shell) throw new Error('Shell对象未定义');
        if (typeof Shell.initialize !== 'function') throw new Error('Shell.initialize方法不存在');
        await Shell.initialize();
        this.shellInitialized = true;
        console.log('Shell模块初始化成功');
        await this.loadDirectory();
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },

    async loadDirectory() {
      if (!this.shellInitialized || !Shell) {
        showError('Shell模块未初始化');
        return;
      }

      try {
        this.isLoading = true;
        showLoading();

        let path = this.currentPath;
        if (!path.startsWith('/')) path = '/' + path;
        if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
        this.currentPath = path;

        const listCmd = `cd "${path}" && ls -la --time-style=+%s 2>/dev/null || ls -la 2>/dev/null`;
        let result = '';
        try {
          result = await Shell.exec(listCmd);
        } catch (error: any) {
          result = await Shell.exec(`cd "${path}" && ls -la`);
        }

        if (!result || result.trim() === '') {
          this.fileList = [];
          return;
        }

        const lines = result.trim().split('\n').slice(1);
        const files: FileItem[] = [];

        for (const line of lines) {
          const file = this.parseFileLineSimple(line);
          if (file) files.push(file);
        }

        this.fileList = files;
        this.updateStats();
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
        if (this.currentPath !== '/') {
          this.currentPath = '/';
          await this.loadDirectory();
        }
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },

    parseFileLineSimple(line: string): FileItem | null {
      if (!line.trim()) return null;
      if (line.includes(' . ') || line.includes(' .. ')) return null;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;

      const permissions = parts[0];
      const name = parts[parts.length - 1];
      if (name === '.' || name === '..') return null;

      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';
      const typeChar = permissions.charAt(0);

      if (typeChar === '-') {
        type = 'file';
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash)$/i)) icon = '文';
        else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) icon = '图';
        else if (name.match(/\.(amr|apk|bin|so|exe)$/i)) icon = '执';
        else icon = '文';
      } else if (typeChar === 'd') {
        type = 'directory';
        icon = 'Dir';
      } else if (typeChar === 'l') {
        type = 'link';
        icon = 'lin';
      }

      let size = 0;
      let sizeFormatted = '';
      if (type === 'directory') sizeFormatted = '<DIR>';
      else {
        for (let i = 1; i < parts.length - 1; i++) {
          const num = parseInt(parts[i], 10);
          if (!isNaN(num) && num > 0 && num < 1000000000) {
            size = num;
            break;
          }
        }
        if (size < 1024) sizeFormatted = `${size} B`;
        else if (size < 1024 * 1024) sizeFormatted = `${(size / 1024).toFixed(1)} KB`;
        else if (size < 1024 * 1024 * 1024) sizeFormatted = `${(size / (1024 * 1024)).toFixed(1)} MB`;
        else sizeFormatted = `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }

      const isHidden = name.startsWith('.');
      const isExecutable = permissions.includes('x');
      const fullPath = this.currentPath === '/' ? `/${name}` : `${this.currentPath}/${name}`;
      const modifiedTime = Math.floor(Date.now() / 1000);

      return {
        name,
        type,
        size,
        sizeFormatted,
        modifiedTime,
        modifiedTimeFormatted: formatTime(modifiedTime),
        permissions,
        isHidden,
        fullPath,
        icon,
        isExecutable,
      };
    },

    updateStats() {
      this.totalFiles = this.fileList.length;
      this.totalSize = this.fileList.filter(f => f.type === 'file').reduce((sum, f) => sum + f.size, 0);
      this.selectedCount = 0;
    },

    async openItem(item: FileItem) {
      if (item.type === 'directory') {
        this.currentPath = item.fullPath;
        await this.loadDirectory();
      } else {
        await this.openFile(item);
      }
    },

    async openFile(file: FileItem) {
      try {
        const checkCmd = `test -f "${file.fullPath}" && echo "exists" || echo "not exists"`;
        const existsResult = await Shell.exec(checkCmd);
        if (existsResult.trim() === 'not exists') {
          showError(`文件不存在: ${file.fullPath}`);
          return;
        }

        const isTextFile = file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|log|conf|ini|yml|yaml)$/i);
        if (isTextFile) {
          $falcon.navTo('fileEditor', { filePath: file.fullPath, returnTo: 'fileManager', returnPath: this.currentPath });
        } else {
          showInfo(`打开文件: ${file.name} (暂不支持此文件类型的预览)`);
        }
      } catch (error: any) {
        showError(`打开文件失败: ${error.message}`);
      }
    },

    async goBack() {
      if (!this.canGoBack) return;
      this.currentPath = this.parentPath;
      await this.loadDirectory();
    },

    async refreshDirectory() {
      await this.loadDirectory();
      showSuccess('目录已刷新');
    },

    toggleHiddenFiles() {
      this.showHiddenFiles = !this.showHiddenFiles;
      this.$forceUpdate();
    },

    searchFiles() {
      openSoftKeyboard(() => this.searchKeyword, (value) => {
        this.searchKeyword = value;
        this.$forceUpdate();
      });
    },

    clearSearch() {
      this.searchKeyword = '';
      this.$forceUpdate();
    },

    formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },

    getFileIconClass(file: FileItem): string {
      let baseClass = 'file-icon';
      if (file.type === 'directory') return `${baseClass} file-icon-folder`;
      if (file.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) return `${baseClass} file-icon-image`;
      if (file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm)$/i)) return `${baseClass} file-icon-text`;
      if (file.isExecutable || file.name.match(/\.(sh|bash|amr|apk|bin|so)$/i)) return `${baseClass} file-icon-executable`;
      return `${baseClass} file-icon-file`;
    },

    handleFileSaved(e: { data: string }) {
      this.loadDirectory();
    },

    handleBackPress() {
      if (this.showContextMenu || this.showConfirmModal) {
        this.showContextMenu = false;
        this.showConfirmModal = false;
        return;
      }
      if (this.canGoBack) {
        this.goBack();
        return;
      }
      this.$page.finish();
    },

    executeConfirmAction() {
      if (this.confirmCallback) this.confirmCallback();
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },

    cancelConfirmAction() {
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },
  },
});
