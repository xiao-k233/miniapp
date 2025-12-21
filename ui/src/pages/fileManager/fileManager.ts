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
      $page: {} as any,
      
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
    
    // 获取初始路径
    const options = (this as any).$page.loadOptions || {};
    this.currentPath = options.path || '/';
    console.log('初始路径:', this.currentPath);
    
    // 设置页面返回键处理
    (this as any).$page.$npage.setSupportBack(true);
    (this as any).$page.$npage.on("backpressed", this.handleBackPress);
    
    // 监听文件保存事件
    $falcon.on('file_saved', this.handleFileSaved);
    
    await this.initializeShell();
  },

  beforeDestroy() {
    (this as any).$page.$npage.off("backpressed", this.handleBackPress);
    $falcon.off('file_saved', this.handleFileSaved);
  },

  computed: {
    filteredFiles(): FileItem[] {
      let files = [...this.fileList];
      
      // 过滤隐藏文件
      if (!this.showHiddenFiles) {
        files = files.filter(file => !file.isHidden);
      }
      
      // 过滤搜索关键词
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        files = files.filter(file => file.name.toLowerCase().includes(keyword));
      }
      
      // 排序：目录在前，文件在后，按名称排序
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
    // 初始化Shell
    async initializeShell() {
      try {
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        if (typeof (Shell as any).initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        await (Shell as any).initialize();
        this.shellInitialized = true;
        console.log('Shell模块初始化成功');
        
        // 加载当前目录
        await this.loadDirectory();
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },
    
    // 加载目录
    async loadDirectory() {
      if (!this.shellInitialized) {
        showError('Shell模块未初始化');
        return;
      }
      
      try {
        this.isLoading = true;
        showLoading();
        
        console.log('加载目录:', this.currentPath);
        
        // 使用简单的ls命令
        const listCmd = `cd "${this.currentPath}" && ls -la`;
        console.log('执行命令:', listCmd);
        
        const result = await (Shell as any).exec(listCmd);
        console.log('原始输出:', result);
        
        // 解析结果
        this.parseLsOutput(result);
        
        // 更新统计信息
        this.updateStats();
        
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.fileList = [];
      } finally {
        this.isLoading = false;
        hideLoading();
      }
    },

    // 解析ls输出
    parseLsOutput(lsOutput: string) {
      const lines = lsOutput.trim().split('\n');
      const files: FileItem[] = [];
      
      // 跳过第一行（total行）
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const file = this.parseLsLine(line);
        if (file) {
          files.push(file);
        }
      }
      
      this.fileList = files;
      console.log('解析出', files.length, '个文件/目录');
    },

    // 解析ls单行
    parseLsLine(line: string): FileItem | null {
      // 分割并过滤空字符串
      const parts = line.split(/\s+/).filter(p => p);
      if (parts.length < 8) {
        console.warn('无法解析行:', line);
        return null;
      }
      
      const permissions = parts[0];
      const name = parts.slice(7).join(' ');
      
      // 跳过当前目录和上级目录
      if (name === '.' || name === '..') {
        return null;
      }
      
      // 判断文件类型
      const typeChar = permissions.charAt(0);
      let type: 'file' | 'directory' | 'link' | 'unknown' = 'unknown';
      let icon = '?';
      
      if (typeChar === '-') {
        type = 'file';
        // 根据文件扩展名设置图标
        if (name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash)$/i)) {
          icon = '文';
        } else if (name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
          icon = '图';
        } else if (name.match(/\.(amr|apk|bin|so|exe)$/i)) {
          icon = '执';
        } else {
          icon = '文';
        }
      } else if (typeChar === 'd') {
        type = 'directory';
        icon = '📁';
      } else if (typeChar === 'l') {
        type = 'link';
        icon = '🔗';
      }
      
      // 获取大小
      let size = 0;
      try {
        size = parseInt(parts[4], 10) || 0;
      } catch (e) {
        size = 0;
      }
      
      // 格式化大小
      let sizeFormatted = '';
      if (type === 'directory') {
        sizeFormatted = '<DIR>';
      } else if (size < 1024) {
        sizeFormatted = `${size} B`;
      } else if (size < 1024 * 1024) {
        sizeFormatted = `${(size / 1024).toFixed(1)} KB`;
      } else if (size < 1024 * 1024 * 1024) {
        sizeFormatted = `${(size / (1024 * 1024)).toFixed(1)} MB`;
      } else {
        sizeFormatted = `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
      }
      
      // 判断是否为隐藏文件
      const isHidden = name.startsWith('.');
      
      // 判断是否可执行
      const isExecutable = permissions.includes('x');
      
      // 构建完整路径
      let fullPath = '';
      if (this.currentPath === '/') {
        fullPath = `/${name}`;
      } else {
        fullPath = `${this.currentPath}/${name}`;
      }
      
      // 简化的时间处理
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
    
    // 更新统计信息
    updateStats() {
      this.totalFiles = this.fileList.length;
      
      // 计算总大小（仅文件）
      this.totalSize = this.fileList
        .filter(file => file.type === 'file')
        .reduce((sum, file) => sum + file.size, 0);
      
      this.selectedCount = 0;
    },
    
    // 打开文件或目录
    async openItem(item: FileItem) {
      console.log('打开项目:', item.name, '类型:', item.type, '路径:', item.fullPath);
      
      if (item.type === 'directory') {
        // 进入目录
        this.currentPath = item.fullPath;
        console.log('切换到目录:', this.currentPath);
        await this.loadDirectory();
      } else {
        // 打开文件
        await this.openFile(item);
      }
    },
    
    // 打开文件
    async openFile(file: FileItem) {
      console.log('打开文件:', file.fullPath);
      
      try {
        // 判断文件类型，如果是文本文件则用编辑器打开
        const isTextFile = file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|log|conf|ini|yml|yaml)$/i);
        
        if (isTextFile) {
          // 用文件编辑器打开
          $falcon.navTo('fileEditor', {
            filePath: file.fullPath,
            returnTo: 'fileManager',
            returnPath: this.currentPath,
          });
        } else {
          showInfo(`打开文件: ${file.name} (暂不支持此文件类型的预览)`);
        }
      } catch (error: any) {
        console.error('打开文件失败:', error);
        showError(`打开文件失败: ${error.message}`);
      }
    },
    
    // 返回上一级
    async goBack() {
      console.log('返回上一级，当前路径:', this.currentPath, '父路径:', this.parentPath);
      
      if (!this.canGoBack) {
        console.log('已经在根目录');
        showInfo('已经是根目录');
        return;
      }
      
      this.currentPath = this.parentPath;
      await this.loadDirectory();
    },
    
    // 刷新目录
    async refreshDirectory() {
      console.log('刷新目录:', this.currentPath);
      await this.loadDirectory();
      showSuccess('目录已刷新');
    },
    
    // 创建新文件
    async createNewFile() {
      openSoftKeyboard(
        () => '',
        async (fileName: string) => {
          if (!fileName.trim()) {
            showWarning('文件名不能为空');
            return;
          }
          
          try {
            showLoading();
            
            const fullPath = this.currentPath === '/' 
              ? `/${fileName}`
              : `${this.currentPath}/${fileName}`;
            
            console.log('创建文件:', fullPath);
            
            // 创建空文件
            await (Shell as any).exec(`touch "${fullPath}"`);
            
            showSuccess(`文件创建成功: ${fileName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('创建文件失败:', error);
            showError(`创建文件失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value: string) => {
          if (!value.trim()) return '请输入文件名';
          if (value.includes('/')) return '文件名不能包含斜杠';
          return undefined;
        }
      );
    },
    
    // 创建新目录
    async createNewDirectory() {
      openSoftKeyboard(
        () => '',
        async (dirName: string) => {
          if (!dirName.trim()) {
            showWarning('目录名不能为空');
            return;
          }
          
          try {
            showLoading();
            
            const fullPath = this.currentPath === '/' 
              ? `/${dirName}`
              : `${this.currentPath}/${dirName}`;
            
            console.log('创建目录:', fullPath);
            
            // 创建目录
            await (Shell as any).exec(`mkdir -p "${fullPath}"`);
            
            showSuccess(`目录创建成功: ${dirName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('创建目录失败:', error);
            showError(`创建目录失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value: string) => {
          if (!value.trim()) return '请输入目录名';
          if (value.includes('/')) return '目录名不能包含斜杠';
          return undefined;
        }
      );
    },
    
    // 删除文件/目录
    async deleteItem(item: FileItem) {
      this.showConfirmModal = true;
      this.confirmTitle = '确认删除';
      this.confirmMessage = `确定要删除 ${item.name} 吗？此操作不可恢复！`;
      this.confirmCallback = async () => {
        try {
          showLoading();
          
          console.log('删除:', item.fullPath);
          
          // 删除文件或目录
          await (Shell as any).exec(`rm -rf "${item.fullPath}"`);
          
          showSuccess(`删除成功: ${item.name}`);
          await this.loadDirectory();
          
        } catch (error: any) {
          console.error('删除失败:', error);
          showError(`删除失败: ${error.message}`);
        } finally {
          hideLoading();
          this.showConfirmModal = false;
        }
      };
    },
    
    // 重命名文件/目录
    async renameItem(item: FileItem) {
      openSoftKeyboard(
        () => item.name,
        async (newName: string) => {
          if (!newName.trim()) {
            showWarning('新名称不能为空');
            return;
          }
          
          if (newName === item.name) {
            showInfo('文件名未改变');
            return;
          }
          
          try {
            showLoading();
            
            // 构建新路径
            let newPath = '';
            if (this.currentPath === '/') {
              newPath = `/${newName}`;
            } else {
              newPath = `${this.currentPath}/${newName}`;
            }
            
            console.log('重命名:', item.fullPath, '->', newPath);
            
            // 执行重命名
            await (Shell as any).exec(`mv "${item.fullPath}" "${newPath}"`);
            
            showSuccess(`重命名成功: ${item.name} -> ${newName}`);
            await this.loadDirectory();
            
          } catch (error: any) {
            console.error('重命名失败:', error);
            showError(`重命名失败: ${error.message}`);
          } finally {
            hideLoading();
          }
        },
        (value: string) => {
          if (!value.trim()) return '请输入新名称';
          if (value.includes('/')) return '名称不能包含斜杠';
          if (value === item.name) return '新名称不能与原名相同';
          return undefined;
        }
      );
    },
    
    // 切换显示隐藏文件
    toggleHiddenFiles() {
      this.showHiddenFiles = !this.showHiddenFiles;
      console.log('切换显示隐藏文件:', this.showHiddenFiles);
      this.$forceUpdate();
    },
    
    // 搜索文件
    searchFiles() {
      openSoftKeyboard(
        () => this.searchKeyword,
        (value: string) => {
          this.searchKeyword = value;
          console.log('搜索关键词:', value);
          this.$forceUpdate();
        }
      );
    },
    
    // 清除搜索
    clearSearch() {
      this.searchKeyword = '';
      this.$forceUpdate();
    },
    
    // 格式化大小
    formatSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    },
    
    // 获取文件图标类
    getFileIconClass(file: FileItem): string {
      let baseClass = 'file-icon';
      
      if (file.type === 'directory') {
        return `${baseClass} file-icon-folder`;
      }
      
      // 根据文件扩展名设置图标
      if (file.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) {
        return `${baseClass} file-icon-image`;
      }
      
      if (file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm)$/i)) {
        return `${baseClass} file-icon-text`;
      }
      
      if (file.isExecutable || file.name.match(/\.(sh|bash|amr|apk|bin|so)$/i)) {
        return `${baseClass} file-icon-executable`;
      }
      
      return `${baseClass} file-icon-file`;
    },
    
    // 处理文件保存事件
    handleFileSaved(e: any) {
      console.log('收到文件保存事件:', e.data);
      // 刷新当前目录
      this.loadDirectory();
    },
    
    // 处理返回键
    handleBackPress() {
      if (this.showContextMenu || this.showConfirmModal) {
        this.showContextMenu = false;
        this.showConfirmModal = false;
        return;
      }
      
      if (this.canGoBack) {
        console.log('返回键：返回上一级目录');
        this.goBack();
        return;
      }
      
      console.log('返回键：退出文件管理器');
      (this as any).$page.finish();
    },
    
    // 确认对话框相关
    executeConfirmAction() {
      if (this.confirmCallback) {
        this.confirmCallback();
      }
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },
    
    cancelConfirmAction() {
      this.showConfirmModal = false;
      this.confirmCallback = null;
    },
    
    // 测试基本功能
    async testBasicFunctions() {
      try {
        showLoading();
        
        // 测试创建文件
        const testFile = `${this.currentPath === '/' ? '' : this.currentPath}/test_${Date.now()}.txt`;
        await (Shell as any).exec(`touch "${testFile}"`);
        console.log('创建测试文件:', testFile);
        
        // 刷新目录
        await this.loadDirectory();
        
        showSuccess('基本功能测试完成');
        
      } catch (error: any) {
        console.error('测试失败:', error);
        showError(`测试失败: ${error.message}`);
      } finally {
        hideLoading();
      }
    },
  },
});