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
import { showError, showSuccess, showInfo, showWarning } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';

export type UpdateOptions = {};

// GitHub配置
const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';

// 当前版本号（需要每次发布时更新）
const CURRENT_VERSION = '1.0.0';

interface GitHubRelease {
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
        size: number;
    }>;
}

const update = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<UpdateOptions>,
            
            // 状态
            status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'updated' | 'error',
            errorMessage: '',
            
            // 版本信息
            currentVersion: CURRENT_VERSION,
            latestRelease: null as GitHubRelease | null,
            
            // 下载信息
            downloadProgress: 0,
            downloadPath: '',
            totalSize: 0,
            
            // Shell状态
            shellInitialized: false,
            
            // 手动更新信息
            manualDownloadUrl: '',
            manualVersion: '',
        };
    },

    async mounted() {
        await this.initializeShell();
        // 不自动检查，让用户手动点击检查
    },

    computed: {
        statusText(): string {
            switch (this.status) {
                case 'idle': return '准备就绪';
                case 'checking': return '正在检查更新...';
                case 'available': return '发现新版本';
                case 'downloading': return '正在下载更新...';
                case 'installing': return '正在安装...';
                case 'updated': return '已是最新版本';
                case 'error': return '检查更新失败';
                default: return '';
            }
        },

        statusClass(): string {
            switch (this.status) {
                case 'checking': return 'status-checking';
                case 'available': return 'status-available';
                case 'updated': return 'status-updated';
                case 'error': return 'status-error';
                default: return '';
            }
        },

        hasUpdate(): boolean {
            if (!this.latestRelease) return false;
            return this.compareVersions(this.latestRelease.tag_name, this.currentVersion) > 0;
        },

        downloadFile(): { name: string; url: string; size: number } | null {
            if (!this.latestRelease || !this.latestRelease.assets.length) return null;
            
            // 查找.amr文件
            const amrAsset = this.latestRelease.assets.find(asset => 
                asset.name.endsWith('.amr') || 
                asset.name.includes('miniapp') ||
                asset.name.includes('release')
            );
            
            if (amrAsset) {
                return {
                    name: amrAsset.name,
                    url: amrAsset.browser_download_url,
                    size: amrAsset.size
                };
            }
            
            return null;
        },

        formattedFileSize(): string {
            const size = this.totalSize || this.downloadFile?.size || 0;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        // 显示release名称
        releaseName(): string {
            if (this.latestRelease) {
                return this.latestRelease.name || this.latestRelease.tag_name;
            }
            return '';
        },

        // 显示release说明
        releaseBody(): string {
            if (this.latestRelease) {
                // 限制长度，避免显示过长
                const body = this.latestRelease.body || '';
                if (body.length > 500) {
                    return body.substring(0, 500) + '...';
                }
                return body;
            }
            return '';
        },

        // 发布日期
        releaseDate(): string {
            if (this.latestRelease) {
                return this.formatDate(this.latestRelease.published_at);
            }
            return '';
        },
    },

    methods: {
        // 初始化Shell
        async initializeShell() {
            try {
                if (!Shell || typeof Shell.initialize !== 'function') {
                    throw new Error('Shell模块不可用');
                }
                
                await Shell.initialize();
                this.shellInitialized = true;
            } catch (error: any) {
                console.error('Shell初始化失败:', error);
                showError(`Shell初始化失败: ${error.message}`);
                this.shellInitialized = false;
            }
        },

        // 检查更新 - 使用Shell的curl命令
        async checkForUpdates() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading('正在检查GitHub Release...');
                
                // 使用Shell执行curl命令获取GitHub API数据
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                
                console.log('使用Shell访问GitHub API:', apiUrl);
                
                // 使用curl获取JSON数据
                const curlCmd = `curl -s -k -L -H "Accept: application/vnd.github.v3+json" "${apiUrl}"`;
                
                const result = await Shell.exec(curlCmd);
                console.log('Shell curl结果:', result);
                
                if (!result || result.trim() === '') {
                    throw new Error('GitHub API返回空响应');
                }
                
                // 解析JSON
                try {
                    const data = JSON.parse(result);
                    this.latestRelease = data as GitHubRelease;
                    
                    console.log('成功获取Release数据:', this.latestRelease.tag_name);
                    
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo(`发现新版本 ${this.latestRelease.tag_name}`);
                    } else {
                        this.status = 'updated';
                        showSuccess('已是最新版本');
                    }
                    
                } catch (parseError) {
                    console.error('解析JSON失败:', parseError, '原始数据:', result);
                    throw new Error('GitHub API返回的数据格式错误');
                }
                
            } catch (error: any) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage}`);
                
                // 如果检查失败，显示手动更新选项
                showWarning('自动检查失败，请尝试手动更新');
            } finally {
                hideLoading();
            }
        },

        // 比较版本号
        compareVersions(v1: string, v2: string): number {
            // 移除v前缀
            const version1 = v1.replace(/^v/, '').split('.').map(Number);
            const version2 = v2.replace(/^v/, '').split('.').map(Number);
            
            for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
                const num1 = version1[i] || 0;
                const num2 = version2[i] || 0;
                
                if (num1 > num2) return 1;
                if (num1 < num2) return -1;
            }
            
            return 0;
        },

        // 下载更新
        async downloadUpdate() {
            if (!this.shellInitialized || !Shell || !this.downloadFile) {
                showError('无法下载更新');
                return;
            }
            
            this.status = 'downloading';
            this.totalSize = this.downloadFile.size;
            
            try {
                showLoading('开始下载...');
                
                // 设置下载路径
                this.downloadPath = `/userdisk/miniapp_update_${Date.now()}.amr`;
                
                console.log('开始下载:', this.downloadFile.url);
                console.log('保存到:', this.downloadPath);
                
                // 使用curl下载文件，增加详细
