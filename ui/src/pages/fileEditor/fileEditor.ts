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
import { showError, showSuccess, showWarning } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';

export type FileEditorOptions = {
  filePath: string;
  returnTo?: string;
  returnPath?: string;
};

const fileEditor = defineComponent({
  data() {
    return {
      $page: {} as FalconPage<FileEditorOptions>,
      
      // 文件信息
      filePath: '',
      fileName: '',
      fileContent: '',
      originalContent: '',
      isModified: false,
      fileExists: false,
      isNewFile: false,
      
      // 编辑状态
      cursorPosition: { row: 0, col: 0 },
      totalLines: 1,
      totalChars: 0,
      
      // 工具状态
      showSaveAsModal: false,
      showFindModal: false,
      showGoToModal: false,
      showConfirmModal: false,
      confirmTitle: '',
      confirmAction: '' as string,
      
      // 查找相关
      findText: '',
      findResults: [] as { row: number; col: number }[],
      currentFindIndex: -1,
      
      // Shell状态
      shellInitialized: false,
      
      // 返回信息
      returnTo: '',
      returnPath: '/',
    };
  },

  async mounted() {
    const options = this.$page.loadOptions;
    this.filePath = options.filePath || '';
    this.fileName = this.getFileName(this.filePath);
    this.isNewFile = !this.filePath;
    this.returnTo = options.returnTo || '';
    this.returnPath = options.returnPath || '/';
    
    console.log('文件编辑器加载:', options);
    
    await this.initializeShell();
    
    if (!this.isNewFile && this.filePath) {
      await this.loadFile();
    } else if (this.isNewFile) {
      this.fileContent = '';
      this.originalContent = '';
      this.fileExists = false;
      this.isModified = false;
    }
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
    
    // 监听内容变化 - 立即更新一次
    this.updateStats();
    
    // 在下一帧确保DOM已渲染
    this.$nextTick(() => {
      this.updateStats();
    });
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  computed: {
    lineNumbers(): number[] {
      return Array.from({ length: this.totalLines }, (_, i) => i + 1);
    },
    
    fileStats(): string {
      return `行: ${this.cursorPosition.row + 1}/${this.totalLines} | 列: ${this.cursorPosition.col + 1} | 字符: ${this.totalChars}`;
    },
    
    canSave(): boolean {
      return this.shellInitialized && (this.isNewFile || this.fileContent !== this.originalContent);
    }
  },

  methods: {
    // 初始化Shell
    async initializeShell() {
      try {
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        await Shell.initialize();
        this.shellInitialized = true;
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        showError(`Shell模块初始化失败: ${error.message}`);
        this.shellInitialized = false;
      }
    },
    
    // 获取文件名
    getFileName(path: string): string {
      if (!path) return '新文件.txt';
      
      const parts = path.split('/');
      return parts[parts.length - 1] || '未命名文件';
    },
    
    // 加载文件
    async loadFile() {
      if (!this.shellInitialized || !Shell || !this.filePath) {
        showError('Shell模块未初始化或文件路径无效');
        return;
      }
      
      try {
        showLoading();
        
        // 检查文件是否存在
        const checkCmd = `test -f "${this.filePath}" && echo "exists" || echo "not exists"`;
        const existsResult = await Shell.exec(checkCmd);
        
        if (existsResult.trim() === 'not exists') {
          this.fileExists = false;
          this.fileContent = '';
          this.isNewFile = true;
          showWarning('文件不存在，将创建新文件');
          return;
        }
        
        // 读取文件内容
        const readCmd = `cat "${this.filePath}"`;
        const content = await Shell.exec(readCmd);
        
        this.fileContent = content;
        this.originalContent = content;
        this.fileExists = true;
        this.isModified = false;
        
        this.updateStats();
        
      } catch (error: any) {
        console.error('加载文件失败:', error);
        showError(`加载文件失败: ${error.message}`);
        this.fileContent = '加载文件失败: ' + error.message;
        this.fileExists = false;
      } finally {
        hideLoading();
      }
    },
    
    // 保存文件
    async saveFile() {
      if (!this.shellInitialized || !Shell) {
        showError('Shell模块未初始化');
        return;
      }
      
      if (!this.filePath || this.isNewFile) {
        this.showSaveAsDialog();
        return;
      }
      
      try {
        showLoading();
        
        // 创建临时文件
        const tempFile = `/tmp/editor_${Date.now()}.txt`;
        const escapedContent = this.escapeContent(this.fileContent);
        
        await Shell.exec(`echo "${escapedContent}" > "${tempFile}"`);
        
        // 备份原文件
        const backupFile = `${this.filePath}.bak_${Date.now()}`;
        await Shell.exec(`cp "${this.filePath}" "${backupFile}" 2>/dev/null || true`);
        
        // 移动临时文件到目标位置
        await Shell.exec(`mv "${tempFile}" "${this.filePath}"`);
        
        this.originalContent = this.fileContent;
        this.isModified = false;
        
        // 保存成功后触发事件，通知文件管理器刷新
        $falcon.trigger('file_saved', this.filePath);
        
        showSuccess('文件保存成功');
        
      } catch (error: any) {
        console.error('保存文件失败:', error);
        showError(`保存文件失败: ${error.message}`);
      } finally {
        hideLoading();
      }
    },
    
    // 另存为
    async saveAsFile(newPath: string) {
      if (!this.shellInitialized || !Shell) {
        showError('Shell模块未初始化');
        return;
      }
      
      try {
        showLoading();
        
        const escapedContent = this.escapeContent(this.fileContent);
        
        // 创建临时文件
        const tempFile = `/tmp/editor_${Date.now()}.txt`;
        await Shell.exec(`echo "${escapedContent}" > "${tempFile}"`);
        
        // 移动临时文件到新位置
        await Shell.exec(`mv "${tempFile}" "${newPath}"`);
        
        // 更新文件信息
        this.filePath = newPath;
        this.fileName = this.getFileName(newPath);
        this.originalContent = this.fileContent;
        this.isModified = false;
        this.isNewFile = false;
        this.fileExists = true;
        
        // 通知文件管理器刷新
        $falcon.trigger('file_saved', this.filePath);
        
        showSuccess('文件另存为成功');
        this.showSaveAsModal = false;
        
      } catch (error: any) {
        console.error('另存为失败:', error);
        showError(`另存为失败: ${error.message}`);
      } finally {
        hideLoading();
      }
    },
    
    // 转义内容
    escapeContent(content: string): string {
      return content
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`')
        .replace(/!/g, '\\!')
        .replace(/~/g, '\\~')
        .replace(/&/g, '\\&')
        .replace(/\|/g, '\\|')
        .replace(/;/g, '\\;')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/</g, '\\<')
        .replace(/>/g, '\\>')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    },
    
    // 内容变化处理
    onContentChange(event: any) {
      // 由于使用v-model，fileContent已经自动更新了
      this.isModified = this.fileContent !== this.originalContent;
      this.updateStats();
    },
    
    // 更新统计信息
    updateStats() {
      if (!this.fileContent) {
        this.totalLines = 1;
        this.totalChars = 0;
        return;
      }
      
      const lines = this.fileContent.split('\n');
      this.totalLines = lines.length;
      this.totalChars = this.fileContent.length;
      
      // 简化光标位置计算，在小程序中无法准确获取
      // 这里设置为0，如果需要更精确，可以考虑使用其他方法
      this.cursorPosition = { row: 0, col: 0 };
      
      // 强制更新视图
      this.$forceUpdate();
    },
    
    // 显示另存为对话框
    showSaveAsDialog() {
      const defaultName = this.fileName || '新文件.txt';
      openSoftKeyboard(
        () => this.filePath || `/tmp/${defaultName}`,
        (newPath) => {
          if (newPath.trim()) {
            this.saveAsFile(newPath.trim());
          }
        },
        (value) => {
          if (!value.trim()) return '文件路径不能为空';
          return undefined;
        }
      );
    },
    
    // 显示查找对话框
    showFindDialog() {
      this.showFindModal = true;
    },
    
    // 执行查找
    async performFind() {
      if (!this.findText) {
        this.findResults = [];
        this.currentFindIndex = -1;
        return;
      }
      
      const content = this.fileContent;
      const searchText = this.findText.toLowerCase();
      const lines = content.split('\n');
      const results: { row: number; col: number }[] = [];
      
      for (let row = 0; row < lines.length; row++) {
        const line = lines[row].toLowerCase();
        let col = line.indexOf(searchText);
        
        while (col !== -1) {
          results.push({ row, col });
          col = line.indexOf(searchText, col + 1);
        }
      }
      
      this.findResults = results;
      
      if (results.length > 0) {
        this.currentFindIndex = 0;
        this.highlightFindResult(results[0]);
        showSuccess(`找到 ${results.length} 个匹配项`);
      } else {
        this.currentFindIndex = -1;
        showWarning('未找到匹配项');
      }
    },
    
    // 高亮查找结果
    highlightFindResult(result: { row: number; col: number }) {
      showSuccess(`找到匹配项: 第 ${result.row + 1} 行, 第 ${result.col + 1} 列`);
    },
    
    // 查找下一个
    findNext() {
      if (this.findResults.length === 0) {
        this.showFindDialog();
        return;
      }
      
      if (this.currentFindIndex < this.findResults.length - 1) {
        this.currentFindIndex++;
      } else {
        this.currentFindIndex = 0;
      }
      
      this.highlightFindResult(this.findResults[this.currentFindIndex]);
    },
    
    // 查找上一个
    findPrev() {
      if (this.findResults.length === 0) {
        this.showFindDialog();
        return;
      }
      
      if (this.currentFindIndex > 0) {
        this.currentFindIndex--;
      } else {
        this.currentFindIndex = this.findResults.length - 1;
      }
      
      this.highlightFindResult(this.findResults[this.currentFindIndex]);
    },
    
    // 显示跳转行对话框
    showGoToDialog() {
      this.showGoToModal = true;
    },
    
    // 跳转到指定行
    goToLine(lineNumber: number) {
      if (lineNumber < 1) lineNumber = 1;
      if (lineNumber > this.totalLines) lineNumber = this.totalLines;
      
      this.showGoToModal = false;
      
      showSuccess(`已跳转到第 ${lineNumber} 行`);
    },
    
    // 打开软键盘编辑
    openKeyboard() {
      openSoftKeyboard(
        () => this.fileContent,
        (newContent) => {
          if (newContent !== this.fileContent) {
            this.fileContent = newContent;
            this.isModified = newContent !== this.originalContent;
            this.updateStats();
          }
        }
      );
    },
    
    // 清空内容
    clearContent() {
      this.showConfirm('确定要清空所有内容吗？', 'clear');
    },
    
    // 执行确认操作
    executeConfirmAction(action: string) {
      this.showConfirmModal = false;
      
      switch (action) {
        case 'clear':
          this.fileContent = '';
          this.isModified = this.fileContent !== this.originalContent;
          this.updateStats();
          break;
        case 'exit':
          this.exitEditor();
          break;
        case 'save_and_exit':
          this.saveAndExit();
          break;
      }
    },
    
    // 保存并退出
    async saveAndExit() {
      await this.saveFile();
      this.exitEditor();
    },
    
    // 显示确认对话框
    showConfirm(message: string, action: string) {
      this.confirmTitle = message;
      this.confirmAction = action;
      this.showConfirmModal = true;
    },
    
    // 退出编辑器
    exitEditor() {
      if (this.isModified) {
        this.showConfirm('文件已修改，确定要退出吗？', 'exit');
        return;
      }
      
      // 如果是从文件管理器跳转过来的，返回时刷新
      if (this.returnTo === 'fileManager') {
        $falcon.trigger('file_saved', this.filePath);
        
        // 返回文件管理器并传递当前路径
        $falcon.navTo('fileManager', { 
          refresh: true,
          path: this.returnPath 
        });
      } else {
        this.$page.finish();
      }
    },
    
    // 快速退出（不保存）
    quickExit() {
      if (this.isModified) {
        showWarning('文件已修改，未保存');
      }
      
      if (this.returnTo === 'fileManager') {
        $falcon.navTo('fileManager', { 
          refresh: true,
          path: this.returnPath 
        });
      } else {
        this.$page.finish();
      }
    },
    
    // 处理返回键
    handleBackPress() {
      if (this.showSaveAsModal || this.showFindModal || this.showGoToModal || this.showConfirmModal) {
        this.showSaveAsModal = false;
        this.showFindModal = false;
        this.showGoToModal = false;
        this.showConfirmModal = false;
        return;
      }
      
      this.exitEditor();
    },
    
    // 获取文件信息
    getFileInfo(): string {
      if (!this.fileExists) return '新文件';
      
      const size = this.totalChars;
      const lines = this.totalLines;
      
      let sizeText = '';
      if (size < 1024) {
        sizeText = `${size} 字节`;
      } else if (size < 1024 * 1024) {
        sizeText = `${(size / 1024).toFixed(1)} KB`;
      } else {
        sizeText = `${(size / (1024 * 1024)).toFixed(1)} MB`;
      }
      
      return `${lines} 行, ${sizeText}`;
    }
  }
});

export default fileEditor;