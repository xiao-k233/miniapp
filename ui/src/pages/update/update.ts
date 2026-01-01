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
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_CDN = 'https://ghproxy.net/';

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
            downloadSpeed: 0,
            downloadedSize: 0,
            totalSize: 0,
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
        };
    },

    async mounted() {
        await this.initializeShell();
        this.checkForUpdates();
    },

    computed: {
        statusText(): string {
            switch (this.status) {
                case 'idle': return '准备检查更新';
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
                asset.name.endsWith('.amr') || asset.name.includes('miniapp')
            );
            
            if (amrAsset) {
                return {
                    name: amrAsset.name,
                    url: `${GITHUB_CDN}${amrAsset.browser_download_url}`,
                    size: amrAsset.size
                };
            }
            
            return null;
        },

        formattedFileSize(): string {
            if (this.totalSize < 1024) return `${this.totalSize} B`;
            if (this.totalSize < 1024 * 1024) return `${(this.totalSize / 1024).toFixed(1)} KB`;
            if (this.totalSize < 1024 * 1024 * 1024) return `${(this.totalSize / (1024 * 1024)).toFixed(1)} MB`;
            return `${(this.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        formattedDownloadedSize(): string {
            if (this.downloadedSize < 1024) return `${this.downloadedSize} B`;
            if (this.downloadedSize < 1024 * 1024) return `${(this.downloadedSize / 1024).toFixed(1)} KB`;
            return `${(this.downloadedSize / (1024 * 1024)).toFixed(1)} MB`;
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

        // 检查更新
        async checkForUpdates() {
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading();
                
                // 从GitHub API获取最新release
                const response = await $falcon.jsapi.http.request({
                    url: GITHUB_API,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'miniapp-updater',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    timeout: 10000
                });
                
                if (response.statusCode === 200) {
                    this.latestRelease = response.data as GitHubRelease;
                    
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo(`发现新版本 ${this.latestRelease.tag_name}`);
                    } else {
                        this.status = 'updated';
                        showSuccess('已是最新版本');
                    }
                } else {
                    throw new Error(`GitHub API返回错误: ${response.statusCode}`);
                }
                
            } catch (error: any) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage}`);
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
            this.downloadProgress = 0;
            this.downloadedSize = 0;
            this.totalSize = this.downloadFile.size;
            
            try {
                showLoading('开始下载...');
                
                // 设置下载路径
                this.downloadPath = `/userdisk/miniapp_update_${Date.now()}.amr`;
                
                // 使用curl下载文件
                const downloadCmd = `curl -k -L --progress-bar "${this.downloadFile.url}" -o "${this.downloadPath}"`;
                
                // 执行下载命令
                await Shell.exec(downloadCmd);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists" || echo "not exists"`;
                const result = await Shell.exec(checkCmd);
                
                if (result.trim() === 'exists') {
                    showSuccess('下载完成，开始安装');
                    await this.installUpdate();
                } else {
                    throw new Error('文件下载失败');
                }
                
            } catch (error: any) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
            } finally {
                hideLoading();
            }
        },

        // 安装更新
        async installUpdate() {
            if (!this.shellInitialized || !Shell) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            
            try {
                showLoading('正在安装...');
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                const result = await Shell.exec(installCmd);
                
                console.log('安装结果:', result);
                
                showSuccess('安装完成！请重启应用');
                this.status = 'updated';
                
                // 清理下载的文件
                setTimeout(async () => {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                    } catch (e) {
                        console.warn('清理临时文件失败:', e);
                    }
                }, 5000);
                
            } catch (error: any) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
                
                // 尝试提供手动安装说明
                showInfo(`你可以手动安装: miniapp_cli install ${this.downloadPath}`);
            } finally {
                hideLoading();
            }
        },

        // 格式化日期
        formatDate(dateString: string): string {
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (e) {
                return dateString;
            }
        },

        // 打开GitHub页面
        openGitHub() {
            showInfo('请在GitHub查看项目页面');
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 清理临时文件
        async cleanup() {
            if (!this.shellInitialized || !Shell) return;
            
            try {
                showLoading('正在清理...');
                await Shell.exec('rm -f /userdisk/miniapp_update_*.amr');
                showSuccess('清理完成');
            } catch (error: any) {
                console.error('清理失败:', error);
                showError(`清理失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        }
    }
});

export default update;