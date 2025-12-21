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

export type FileManagerOptions = {};

interface FileItem {
  id: string;
  name: string;
  type: 'directory' | 'file' | 'executable' | 'link';
  size: number;
  permissions: string;
  modified: string;
  fullPath: string;
  selected: boolean;
}

interface MenuPosition {
  x: number;
  y: number;
  file?: FileItem;
}

const fileManager = defineComponent({
  data() {
    return {
      $page: {} as FalconPage<FileManagerOptions>,
      
      // 文件列表相关
      currentPath: '/',
      files: [] as FileItem[],
      isLoading: false,
      shellInitialized: false,
      
      // 搜索相关
      searchKeyword: '',
      isSearching: false,
      
      // 选择相关
      selectedFiles: [] as FileItem[],
      selectionMode: false,
      
      // 操作相关
      showMenu: false,
      menuPosition: { x: 0, y: 0 } as MenuPosition,
      showOperationModal: false,
      operationType: '' as 'rename' | 'delete' | 'copy' | 'move' | 'newfile' | 'newfolder' | '',
      operationData: {} as any,
      
      // 排序相关
      sortField: 'name' as 'name' | 'size' | 'modified' | 'type',
      sortAsc: true,
      
      // 历史记录
      history: [] as string[],
      historyIndex: 0,
    };
  },

  created() {
    this.$page.on("show", this.onPageShow);
    this.$page.on("newoptions", this.onNewOptions);
  },
  
  destroyed() {
    this.$page.off("show", this.onPageShow);
    this.$page.off("newoptions", this.onNewOptions);
  },

  mounted() {
    console.log('文件管理器开始初始化...');
    this.initializeShell();
    this.history = ['/'];
    this.historyIndex = 0;
    
    // 监听编辑器保存事件
    $falcon.on<string>('file_saved', this.handleFileSaved);
  },

  beforeDestroy() {
    $falcon.off('file_saved', this.handleFileSaved);
  },

  computed: {
    // 过滤和排序文件
    filteredFiles(): FileItem[] {
      let result = [...this.files];
      
      // 搜索过滤
      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase();
        result = result.filter(file => 
          file.name.toLowerCase().includes(keyword) ||
          file.type.toLowerCase().includes(keyword)
        );
      }
      
      // 排序
      result.sort((a, b) => {
        // 目录始终在前
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        
        let aValue: any, bValue: any;
        
        switch (this.sortField) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'size':
            aValue = a.size;
            bValue = b.size;
            break;
          case 'modified':
            aValue = new Date(a.modified).getTime();
            bValue = new Date(b.modified).getTime();
            break;
          case 'type':
            aValue = a.type;
            bValue = b.type;
            break;
          default:
            aValue = a.name;
            bValue = b.name;
        }
        
        if (aValue < bValue) return this.sortAsc ? -1 : 1;
        if (aValue > bValue) return this.sortAsc ? 1 : -1;
        return 0;
      });
      
      return result;
    },
    
    // 统计信息
    stats(): string {
      const total = this.files.length;
      const dirs = this.files.filter(f => f.type === 'directory').length;
      const files = total - dirs;
      return `${dirs}目录 ${files}文件`;
    },
    
    // 选择信息
    selectionText(): string {
      if (this.selectedFiles.length === 0) return '';
      return `已选 ${this.selectedFiles.length} 项`;
    },
    
    // 是否可以返回上级
    canGoBack(): boolean {
      return this.currentPath !== '/';
    },
    
    // 是否可以前进
    canGoForward(): boolean {
      return this.historyIndex < this.history.length - 1;
    },
  },

  methods: {
    // 页面显示时刷新
    onPageShow() {
      if (this.shellInitialized) {
        this.refreshDirectory();
      }
    },
    
    // 新参数
    onNewOptions(options: any) {
      if (options.path) {
        this.navigateTo(options.path);
      }
    },
    
    // 初始化Shell
    async initializeShell() {
      try {
        this.isLoading = true;
        
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        await Shell.initialize();
        this.shellInitialized = true;
        
        // 加载根目录
        await this.loadDirectory('/');
        
      } catch (error: any) {
        console.error('Shell初始化失败:', error);
        showError(`Shell初始化失败: ${error.message}`);
        this.shellInitialized = false;
      } finally {
        this.isLoading = false;
      }
    },
    
    // 加载目录
    async loadDirectory(path: string) {
      if (!this.shellInitialized || !Shell) {
        showError('Shell未初始化');
        return;
      }
      
      try {
        this.isLoading = true;
        this.selectedFiles = [];
        this.selectionMode = false;
        
        // 记录历史
        if (this.currentPath !== path) {
          this.history = this.history.slice(0, this.historyIndex + 1);
          this.history.push(path);
          this.historyIndex = this.history.length - 1;
        }
        
        this.currentPath = path;
        
        // 获取目录列表
        const command = `cd "${path}" && ls -lah --time-style=long-iso | grep -v '^total'`;
        const result = await Shell.exec(command);
        
        // 解析结果
        this.parseDirectoryListing(result, path);
        
      } catch (error: any) {
        console.error('加载目录失败:', error);
        showError(`加载目录失败: ${error.message}`);
        this.files = [];
      } finally {
        this.isLoading = false;
      }
    },
    
    // 解析目录列表
    parseDirectoryListing(output: string, currentPath: string) {
      const lines = output.trim().split('\n');
      const files: FileItem[] = [];
      
      lines.forEach((line, index) => {
        if (!line.trim()) return;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 8) return;
        
        const permissions = parts[0];
        const links = parts[1];
        const owner = parts[2];
        const group = parts[3];
        const size = parts[4];
        const date = parts.slice(5, 7).join(' ');
        const name = parts.slice(7).join(' ');
        
        // 排除当前目录和上级目录
        if (name === '.' || name === '..') return;
        
        // 确定文件类型
        let type: FileItem['type'] = 'file';
        if (permissions.startsWith('d')) {
          type = 'directory';
        } else if (permissions.includes('x')) {
          type = 'executable';
        } else if (permissions.startsWith('l')) {
          type = 'link';
        }
        
        // 解析文件大小
        let sizeNum = 0;
        if (size !== '-') {
          const sizeMatch = size.match(/^(\d+(\.\d+)?)([KMGTP])?$/);
          if (sizeMatch) {
            sizeNum = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[3];
            if (unit === 'K') sizeNum *= 1024;
            else if (unit === 'M') sizeNum *= 1024 * 1024;
            else if (unit === 'G') sizeNum *= 1024 * 1024 * 1024;
          }
        }
        
        // 构建完整路径
        const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        
        files.push({
          id: `file-${index}-${Date.now()}`,
          name,
          type,
          size: sizeNum,
          permissions,
          modified: date,
          fullPath,
          selected: false
        });
      });
      
      this.files = files;
    },
    
    // 刷新目录
    async refreshDirectory() {
      await this.loadDirectory(this.currentPath);
      showInfo('目录已刷新');
    },
    
    // 进入目录
    async enterDirectory(file: FileItem) {
      if (file.type !== 'directory') {
        this.openFile(file);
        return;
      }
      
      await this.loadDirectory(file.fullPath);
    },
    
    // 打开文件
    openFile(file: FileItem) {
      if (file.type === 'directory') {
        this.enterDirectory(file);
        return;
      }
      
      // 检查文件类型
      const textExtensions = ['.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.xml', '.yaml', '.yml', '.ini', '.conf'];
      const isTextFile = textExtensions.some(ext => file.name.endsWith(ext)) || file.size < 1024 * 100; // 小于100KB也认为是文本
      
      if (isTextFile) {
        this.editFile(file);
      } else {
        showInfo(`打开文件: ${file.name}`);
        // 这里可以添加其他文件类型的处理
      }
    },
    
    // 编辑文件 - 跳转到编辑器
    editFile(file: FileItem) {
      $falcon.navTo('fileEditor', { 
        filePath: file.fullPath,
        returnTo: 'fileManager',
        returnPath: this.currentPath
      });
    },
    
    // 创建并编辑新文件
    async createAndEditFile() {
      this.operationType = 'newfile';
      this.showOperationModal = true;
    },
    
    // 执行创建文件
    async executeCreateFile(filename: string) {
      if (!filename.trim()) {
        showWarning('文件名不能为空');
        return;
      }
      
      const fullPath = this.currentPath === '/' ? `/${filename}` : `${this.currentPath}/${filename}`;
      
      try {
        showLoading();
        await Shell.exec(`touch "${fullPath}"`);
        showSuccess('文件创建成功');
        
        // 跳转到编辑器
        $falcon.navTo('fileEditor', { 
          filePath: fullPath,
          returnTo: 'fileManager',
          returnPath: this.currentPath
        });
        
      } catch (error: any) {
        console.error('创建文件失败:', error);
        showError(`创建文件失败: ${error.message}`);
      } finally {
        hideLoading();
        this.showOperationModal = false;
      }
    },
    
    // 创建目录
    async createDirectory() {
      this.operationType = 'newfolder';
      this.showOperationModal = true;
    },
    
    // 执行创建目录
    async executeCreateDirectory(dirname: string) {
      if (!dirname.trim()) {
        showWarning('目录名不能为空');
        return;
      }
      
      const fullPath = this.currentPath === '/' ? `/${dirname}` : `${this.currentPath}/${dirname}`;
      
      try {
        showLoading();
        await Shell.exec(`mkdir -p "${fullPath}"`);
        showSuccess('目录创建成功');
        await this.refreshDirectory();
      } catch (error: any) {
        console.error('创建目录失败:', error);
        showError(`创建目录失败: ${error.message}`);
      } finally {
        hideLoading();
        this.showOperationModal = false;
      }
    },
    
    // 重命名文件/目录
    renameFile(file: FileItem) {
      this.operationType = 'rename';
      this.operationData = { file };
      this.showOperationModal = true;
    },
    
    // 执行重命名
    async executeRename(newName: string) {
      const { file } = this.operationData;
      
      if (!newName.trim() || newName === file.name) {
        this.showOperationModal = false;
        return;
      }
      
      const newPath = file.fullPath.substring(0, file.fullPath.lastIndexOf('/')) + '/' + newName;
      
      try {
        showLoading();
        await Shell.exec(`mv "${file.fullPath}" "${newPath}"`);
        showSuccess('重命名成功');
        await this.refreshDirectory();
      } catch (error: any) {
        console.error('重命名失败:', error);
        showError(`重命名失败: ${error.message}`);
      } finally {
        hideLoading();
        this.showOperationModal = false;
      }
    },
    
    // 删除文件/目录
    deleteFile(file: FileItem) {
      this.operationType = 'delete';
      this.operationData = { file };
      this.showOperationModal = true;
    },
    
    // 执行删除
    async executeDelete() {
      const { file } = this.operationData;
      
      try {
        showLoading();
        
        if (file.type === 'directory') {
          await Shell.exec(`rm -rf "${file.fullPath}"`);
        } else {
          await Shell.exec(`rm "${file.fullPath}"`);
        }
        
        showSuccess('删除成功');
        await this.refreshDirectory();
      } catch (error: any) {
        console.error('删除失败:', error);
        showError(`删除失败: ${error.message}`);
      } finally {
        hideLoading();
        this.showOperationModal = false;
      }
    },
    
    // 复制文件
    copyFile(file: FileItem) {
      showInfo('复制功能开发中...');
    },
    
    // 移动文件
    moveFile(file: FileItem) {
      showInfo('移动功能开发中...');
    },
    
    // 返回上级目录
    goUp() {
      if (this.currentPath === '/') return;
      
      const parts = this.currentPath.split('/').filter(p => p);
      parts.pop();
      const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
      
      this.navigateTo(newPath);
    },
    
    // 导航到指定路径
    async navigateTo(path: string) {
      await this.loadDirectory(path);
    },
    
    // 返回历史
    goBack() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.loadDirectory(this.history[this.historyIndex]);
      }
    },
    
    // 前进历史
    goForward() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.loadDirectory(this.history[this.historyIndex]);
      }
    },
    
    // 切换选择
    toggleSelection(file: FileItem) {
      file.selected = !file.selected;
      
      if (file.selected) {
        if (!this.selectedFiles.find(f => f.id === file.id)) {
          this.selectedFiles.push(file);
        }
      } else {
        const index = this.selectedFiles.findIndex(f => f.id === file.id);
        if (index !== -1) {
          this.selectedFiles.splice(index, 1);
        }
      }
      
      this.selectionMode = this.selectedFiles.length > 0;
    },
    
    // 清空选择
    clearSelection() {
      this.files.forEach(file => {
        file.selected = false;
      });
      this.selectedFiles = [];
      this.selectionMode = false;
    },
    
    // 全选/取消全选
    toggleSelectAll() {
      const allSelected = this.files.length > 0 && this.files.every(f => f.selected);
      
      this.files.forEach(file => {
        file.selected = !allSelected;
      });
      
      if (!allSelected) {
        this.selectedFiles = [...this.files];
      } else {
        this.selectedFiles = [];
      }
      
      this.selectionMode = this.selectedFiles.length > 0;
    },
    
    // 显示上下文菜单
    showContextMenu(event: TouchEvent | MouseEvent, file?: FileItem) {
      event.preventDefault();
      event.stopPropagation();
      
      // 获取触摸位置
      let x = 0, y = 0;
      if ('touches' in event && event.touches.length > 0) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
      } else if ('clientX' in event) {
        x = event.clientX;
        y = event.clientY;
      }
      
      this.menuPosition = { x, y, file };
      this.showMenu = true;
    },
    
    // 隐藏菜单
    hideMenu() {
      this.showMenu = false;
    },
    
    // 格式化文件大小
    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      const size = bytes / Math.pow(k, i);
      return size.toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i];
    },
    
    // 获取文件图标
    getFileIcon(file: FileItem): string {
      switch (file.type) {
        case 'directory': return '📁';
        case 'executable': return '⚡';
        case 'link': return '🔗';
        default: return '📄';
      }
    },
    
    // 获取文件类型文本
    getFileTypeText(file: FileItem): string {
      switch (file.type) {
        case 'directory': return '目录';
        case 'executable': return '可执行';
        case 'link': return '链接';
        default: return '文件';
      }
    },
    
    // 处理编辑器保存事件
    handleFileSaved(event: { data: string }) {
      // 收到文件保存事件，刷新当前目录
      this.refreshDirectory();
    },
    
    // 处理操作确认
    handleOperationConfirm() {
      switch (this.operationType) {
        case 'newfile':
          this.executeCreateFile(this.operationData.newName || '');
          break;
        case 'newfolder':
          this.executeCreateDirectory(this.operationData.newName || '');
          break;
        case 'rename':
          this.executeRename(this.operationData.newName || '');
          break;
        case 'delete':
          this.executeDelete();
          break;
      }
    },
    
    // 处理操作取消
    handleOperationCancel() {
      this.showOperationModal = false;
      this.operationType = '';
      this.operationData = {};
    },
    
    // 处理返回键
    handleBackPress() {
      if (this.showMenu) {
        this.hideMenu();
        return;
      }
      
      if (this.showOperationModal) {
        this.handleOperationCancel();
        return;
      }
      
      if (this.selectionMode) {
        this.clearSelection();
        return;
      }
      
      if (this.currentPath !== '/') {
        this.goUp();
        return;
      }
      
      this.$page.finish();
    }
  }
});

export default fileManager;
