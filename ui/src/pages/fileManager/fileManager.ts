// MT管理器风格文件管理器样式
// 版本: 2.1
// 描述: 修复显示不全问题，用文字代替符号

@import url('../../styles/section.less');

/* 文件管理器容器 */
.mt-file-manager {
  flex: 1;
  background-color: #1a1a1a;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

/* 顶部操作栏 */
.top-bar {
  display: flex;
  flex-direction: column;
  background-color: #2d2d2d;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}

.path-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  background-color: #252525;
  min-height: 40px;
}

.path-text {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
  height: 24px;
  line-height: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 5px;
}

.path-text.disabled {
  color: #666;
  opacity: 0.5;
  cursor: not-allowed;
}

.path-btn {
  width: 60px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  font-size: 14px;
  color: #4a9eff;
  margin-left: 10px;
  cursor: pointer;
  background-color: #3a3a3a;
  border-radius: 4px;
}

.path-btn:hover {
  background-color: #4a4a4a;
}

.action-bar {
  display: flex;
  flex-direction: row;
  padding: 8px 12px;
  background-color: #2d2d2d;
  flex-wrap: wrap;
  min-height: 50px;
}

.action-btn {
  min-width: 80px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  font-size: 14px;
  color: #e0e0e0;
  margin-right: 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  background-color: #3a3a3a;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0 12px;
}

.action-btn:last-child {
  margin-right: 0;
}

.action-btn.disabled {
  color: #666;
  background-color: #2a2a2a;
  cursor: not-allowed;
  opacity: 0.6;
}

.action-btn:hover:not(.disabled) {
  background-color: #4a4a4a;
}

/* 权限提示 */
.permission-warning {
  padding: 8px 12px;
  background-color: #332200;
  border-bottom: 1px solid #664400;
  flex-shrink: 0;
}

.warning-text {
  font-size: 12px;
  color: #ffaa00;
  text-align: center;
  display: block;
}

/* 主布局容器 */
.main-layout {
  display: flex;
  flex-direction: row;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* 宽屏布局 */
.main-layout.wide .left-panel {
  width: 200px;
  border-right: 1px solid #333;
  display: flex;
  flex-shrink: 0;
}

.main-layout.wide .right-panel {
  flex: 1;
  display: flex;
  min-width: 0;
}

/* 窄屏布局 */
.main-layout.narrow .left-panel {
  display: none;
}

.main-layout.narrow .right-panel {
  width: 100%;
  display: flex;
  min-width: 0;
}

/* 左侧目录树 */
.left-panel {
  background-color: #252525;
}

.directory-tree {
  flex: 1;
  min-height: 0;
}

.tree-title {
  display: block;
  padding: 10px 12px;
  font-size: 14px;
  color: #888;
  border-bottom: 1px solid #333;
  font-weight: bold;
  background-color: #2a2a2a;
}

.tree-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #2a2a2a;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 44px;
}

.tree-item:hover {
  background-color: #333;
}

.tree-item.selected {
  background-color: #3a3a3a;
}

.tree-icon {
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-size: 16px;
  color: #ffaa00;
  margin-right: 8px;
  flex-shrink: 0;
}

.tree-name {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
  height: 24px;
  line-height: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.empty-tree {
  padding: 20px;
  text-align: center;
}

.empty-text {
  font-size: 14px;
  color: #666;
}

/* 右侧文件列表 */
.right-panel {
  background-color: #1a1a1a;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.file-list {
  flex: 1;
  min-height: 0;
}

/* 搜索状态 */
.search-status {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  background-color: #252525;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.search-text {
  flex: 1;
  font-size: 14px;
  color: #4a9eff;
}

.clear-search {
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-size: 16px;
  color: #888;
  cursor: pointer;
  flex-shrink: 0;
}

.clear-search:hover {
  color: #ff4444;
}

/* 统计信息栏 */
.stats-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  background-color: #2a2a2a;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.stats-text {
  flex: 1;
  font-size: 12px;
  color: #888;
}

.layout-toggle {
  width: 40px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  font-size: 12px;
  color: #e0e0e0;
  background-color: #3a3a3a;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
}

.layout-toggle:hover {
  background-color: #4a4a4a;
}

/* 空列表状态 */
.empty-list {
  padding: 40px 20px;
  text-align: center;
  flex-shrink: 0;
}

.empty-title {
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.empty-description {
  font-size: 14px;
  color: #555;
  display: block;
}

/* 文件项样式 */
.file-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #2a2a2a;
  background-color: #252525;
  margin: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  min-height: 64px;
  flex-shrink: 0;
}

.file-item:hover {
  background-color: #2a2a2a;
}

.file-icon-container {
  width: 40px;
  height: 40px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-icon {
  width: 40px;
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 20px;
}

/* 文件信息区域 */
.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.file-name {
  display: block;
  font-size: 14px;
  color: #e0e0e0;
  height: 20px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.file-details {
  font-size: 12px;
  color: #888;
}

/* 文件操作按钮 */
.file-actions {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin-left: 10px;
  flex-shrink: 0;
}

.file-action {
  min-width: 50px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  font-size: 12px;
  color: #e0e0e0;
  background-color: #3a3a3a;
  border-radius: 3px;
  padding: 0 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-action:hover:not(.disabled) {
  background-color: #4a4a4a;
}

.file-action.disabled {
  color: #666;
  background-color: #2a2a2a;
  cursor: not-allowed;
  opacity: 0.6;
}

.file-action.delete {
  background-color: #5a2a2a;
  color: #ff6b6b;
}

.file-action.delete:hover:not(.disabled) {
  background-color: #6a2a2a;
}

.file-action.delete.disabled {
  background-color: #3a2a2a;
  color: #996b6b;
}

/* 确认对话框 */
.confirm-modal {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  width: 300px;
  background-color: #2d2d2d;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #444;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.modal-title {
  display: block;
  font-size: 16px;
  color: #ffaa00;
  text-align: center;
  margin-bottom: 15px;
  font-weight: bold;
}

.modal-message {
  display: block;
  font-size: 14px;
  color: #e0e0e0;
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.4;
}

.modal-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
}

.modal-btn {
  min-width: 80px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 14px;
  color: #e0e0e0;
  background-color: #3a3a3a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn:hover {
  background-color: #4a4a4a;
}

.modal-btn-danger {
  background-color: #5a2a2a;
  color: #ff6b6b;
}

.modal-btn-danger:hover {
  background-color: #6a2a2a;
}

/* 初始化错误提示 */
.init-error {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  z-index: 1001;
  display: flex;
  justify-content: center;
  align-items: center;
}

.error-content {
  width: 320px;
  background-color: #331111;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #ff4444;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
}

.error-title {
  display: block;
  font-size: 16px;
  color: #ff4444;
  text-align: center;
  margin-bottom: 15px;
  font-weight: bold;
}

.error-message {
  display: block;
  font-size: 14px;
  color: #ff9999;
  text-align: center;
  margin-bottom: 20px;
  line-height: 1.4;
}

.error-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
}

.error-btn {
  min-width: 80px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 14px;
  color: #e0e0e0;
  background-color: #5a2a2a;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.error-btn:hover {
  background-color: #6a2a2a;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
  .main-layout.wide .left-panel {
    display: none;
  }
  
  .main-layout.wide .right-panel {
    width: 100%;
  }
  
  .action-btn {
    min-width: 70px;
    height: 30px;
    line-height: 30px;
    font-size: 13px;
    margin-right: 6px;
    margin-bottom: 4px;
    padding: 0 8px;
  }
  
  .file-actions {
    flex-direction: column;
    gap: 4px;
  }
  
  .file-action {
    min-width: 40px;
    height: 24px;
    line-height: 24px;
    font-size: 11px;
    padding: 0 6px;
  }
  
  .path-btn {
    width: 50px;
    height: 26px;
    line-height: 26px;
    font-size: 13px;
  }
}

/* 文件图标颜色 */
.file-icon.directory {
  color: #ffaa00;
}

.file-icon.file {
  color: #4a9eff;
}

.file-icon.image {
  color: #6bff8d;
}

.file-icon.text {
  color: #6bd7ff;
}

.file-icon.executable {
  color: #ff6b6b;
}

/* 动画效果 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.file-item {
  animation: fadeIn 0.3s ease;
}

.confirm-modal,
.init-error {
  animation: fadeIn 0.2s ease;
}

/* 高亮当前路径 */
.path-text {
  font-weight: bold;
}

/* 禁用状态的视觉反馈 */
.disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
}

/* 悬停效果优化 */
@media (hover: hover) {
  .action-btn:hover:not(.disabled),
  .file-action:hover:not(.disabled),
  .modal-btn:hover,
  .error-btn:hover,
  .tree-item:hover,
  .file-item:hover {
    transform: translateY(-1px);
  }
}
