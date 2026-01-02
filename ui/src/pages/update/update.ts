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

// 使用不同的API端点避免限制
const API_ENDPOINTS = [
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
];

// 使用CDN代理绕过限制
const PROXY_URLS = [
    '', // 直连
    'https://ghproxy.net/', 
    'https://mirror.ghproxy.com/',
];

// 当前版本号（每次发布需要更新）
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
            status: 'idle' as 'idle' | 'checking' | 'downloading' | 'installing' | 'updated' | 'error',
            errorMessage: '',
            
            // 版本信息
            currentVersion: CURRENT_VERSION,
            latestVersion: '',
            releaseNotes: '',
            downloadUrl: '',
            fileSize: 0,
            
            // 下载信息
            downloadProgress: 0,
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
            
            // 使用Shell检查的标记
            useShellForCheck: false,
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
                case 'downloading': return 'status-available';
                case 'updated': return 'status-updated';
                case 'error': return 'status-error';
                default: return '';
            }
        },

        hasUpdate(): boolean {
            if (!this.latestVersion) return false;
            return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
        },

        formattedFileSize(): string {
            if (this.fileSize < 1024) return `${this.fileSize} B`;
            if (this.fileSize < 1024 * 1024) return `${(this.fileSize / 1024).toFixed(1)} KB`;
            if (this.fileSize < 1024 * 1024 * 1024) return `${(this.fileSize / (1024 * 1024)).toFixed(1)} MB`;
            return `${(this.fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
                console.log('Shell初始化成功');
            } catch (error: any) {
                console.error('Shell初始化失败:', error);
                this.shellInitialized = false;
                showError('Shell模块初始化失败，部分功能受限');
            }
        },

        // 检查更新 - 使用多种方法
        async checkForUpdates() {
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading();
                
                // 方法1：首先尝试使用Shell命令检查（绕过HTTP限制）
                if (this.shellInitialized) {
                    try {
                        await this.checkViaShell();
                        if (this.latestVersion) {
                            // Shell检查成功
                            if (this.hasUpdate) {
                                this.status = 'updated';
                                showInfo(`发现新版本 ${this.latestVersion}`);
                            } else {
                                this.status = 'updated';
                                showSuccess('已是最新版本');
                            }
                            return;
                        }
                    } catch (shellError) {
                        console.log('Shell检查失败，尝试HTTP:', shellError);
                    }
                }
                
                // 方法2：尝试HTTP请求
                await this.checkViaHttp();
                
                if (this.latestVersion) {
                    if (this.hasUpdate) {
                        this.status = 'updated';
                        showInfo(`发现新版本 ${this.latestVersion}`);
                    } else {
                        this.status = 'updated';
                        showSuccess('已是最新版本');
                    }
                } else {
                    throw new Error('无法获取版本信息');
                }
                
            } catch (error: any) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage}`);
                
                // 提供备选方案
                showInfo('请尝试手动更新或使用Shell命令检查');
            } finally {
                hideLoading();
            }
        },

        // 使用Shell命令检查更新
        async checkViaShell() {
            if (!this.shellInitialized || !Shell) {
                throw new Error('Shell不可用');
            }
            
            console.log('使用Shell命令检查更新...');
            
            // 尝试从version.txt获取版本信息
            const versionCheckCmd = `curl -s -k -L "https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/version.txt" || echo "1.0.0"`;
            
            try {
                const versionResult = await Shell.exec(versionCheckCmd);
                const version = versionResult.trim();
                
                if (version && version !== '1.0.0') {
                    this.latestVersion = version;
                    this.releaseNotes = `版本 ${version} 已发布`;
                    
                    // 构建下载URL
                    this.downloadUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${version}/miniapp_${version}.amr`;
                    this.fileSize = 30000000; // 估计大小
                    
                    console.log('通过Shell获取到版本:', version);
                    return;
                }
            } catch (error) {
                console.error('Shell版本检查失败:', error);
            }
            
            // 如果version.txt失败，尝试其他方法
            throw new Error('无法通过Shell获取版本');
        },

        // 使用HTTP请求检查更新
        async checkViaHttp() {
            console.log('尝试HTTP请求检查更新...');
            
            // 尝试不同的端点和代理组合
            for (const endpoint of API_ENDPOINTS) {
                for (const proxy of PROXY_URLS) {
                    try {
                        const url = proxy ? `${proxy}${endpoint}` : endpoint;
                        
                        console.log(`尝试URL: ${url}`);
                        
                        const response = await $falcon.jsapi.http.request({
                            url: url,
                            method: 'GET',
                            headers: {
                                'User-Agent': 'miniapp-updater/1.0',
                                'Accept': 'application/json'
                            },
                            timeout: 10000
                        });
                        
                        console.log('HTTP响应状态:', response.statusCode);
                        
                        if (response.statusCode === 200) {
                            const data = response.data;
                            
                            // 处理数据
                            if (Array.isArray(data) && data.length > 0) {
                                // 如果是数组，取第一个（最新）
                                const latest = data[0];
                                this.latestVersion = latest.tag_name;
                                this.releaseNotes = latest.body || '无更新说明';
                                
                                if (latest.assets && latest.assets.length > 0) {
                                    const amrAsset = latest.assets.find((a: any) => 
                                        a.name.endsWith('.amr') || a.name.includes('miniapp')
                                    );
                                    if (amrAsset) {
                                        this.downloadUrl = amrAsset.browser_download_url;
                                        this.fileSize = amrAsset.size || 0;
                                    }
                                }
                            } else if (data.tag_name) {
                                // 如果是单个release对象
                                this.latestVersion = data.tag_name;
                                this.releaseNotes = data.body || '无更新说明';
                                
                                if (data.assets && data.assets.length > 0) {
                                    const amrAsset = data.assets.find((a: any) => 
                                        a.name.endsWith('.amr') || a.name.includes('miniapp')
                                    );
                                    if (amrAsset) {
                                        this.downloadUrl = amrAsset.browser_download_url;
                                        this.fileSize = amrAsset.size || 0;
                                    }
                                }
                            }
                            
                            if (this.latestVersion) {
                                console.log('HTTP检查成功，版本:', this.latestVersion);
                                return;
                            }
                        } else if (response.statusCode === 403) {
                            console.warn(`HTTP 403错误: ${url}`);
                            continue; // 继续尝试下一个
                        }
                    } catch (error) {
                        console.log(`HTTP请求失败: ${endpoint}`, error);
                        // 继续尝试下一个
                    }
                    
                    // 短暂延迟避免请求过快
                    await this.delay(500);
                }
            }
            
            throw new Error('所有HTTP尝试都失败了');
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
            if (!this.shellInitialized || !Shell) {
                showError('无法下载更新，Shell模块未初始化');
                return;
            }
            
            if (!this.downloadUrl) {
                showError('没有可用的下载链接');
                return;
            }
            
            this.status = 'downloading';
            this.downloadProgress = 0;
            
            try {
                showLoading('开始下载...');
                
                // 设置下载路径
                this.downloadPath = `/userdisk/miniapp_update_${Date.now()}.amr`;
                
                console.log('下载URL:', this.downloadUrl);
                console.log('保存到:', this.downloadPath);
                
                // 使用curl下载文件，尝试不同的选项
                const downloadCmd = `curl -k -L --retry 3 --retry-delay 5 --connect-timeout 60 --max-time 600 "${this.downloadUrl}" -o "${this.downloadPath}" 2>&1`;
                
                console.log('执行下载命令:', downloadCmd);
                
                // 执行下载命令
                const result = await Shell.exec(downloadCmd);
                console.log('下载结果:', result);
                
                // 检查文件是否下载成功
                const checkCmd = `if [ -f "${this.downloadPath}" ]; then echo "exists"; else echo "not exists"; fi`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取文件大小
                    const sizeCmd = `wc -c < "${this.downloadPath}"`;
                    const sizeResult = await Shell.exec(sizeCmd);
                    const actualSize = parseInt(sizeResult.trim()) || 0;
                    
                    console.log('文件下载成功，大小:', actualSize, '字节');
                    
                    if (actualSize > 10000) { // 至少10KB
                        showSuccess('下载完成，开始安装');
                        await this.installUpdate();
                    } else {
                        throw new Error(`下载的文件大小异常: ${actualSize} 字节`);
                    }
                } else {
                    throw new Error('文件下载失败');
                }
                
            } catch (error: any) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
                
                // 清理可能的部分文件
                if (this.downloadPath) {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                    } catch (cleanupError) {
                        console.warn('清理临时文件失败:', cleanupError);
                    }
                }
                
                // 提供手动安装说明
                showInfo(`手动下载链接: ${this.downloadUrl}`);
                showInfo(`手动安装命令: miniapp_cli install 下载的文件路径`);
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
                const installCmd = `miniapp_cli install "${this.downloadPath}" 2>&1`;
                console.log('执行安装命令:', installCmd);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                // 根据输出判断是否成功
                if (result.includes('success') || result.includes('Success') || 
                    result.includes('安装成功') || result.trim() === '') {
                    showSuccess('安装完成！应用将自动重启');
                    this.status = 'updated';
                    
                    // 清理下载的文件
                    setTimeout(async () => {
                        try {
                            await Shell.exec(`rm -f "${this.downloadPath}"`);
                            console.log('清理临时文件成功');
                        } catch (e) {
                            console.warn('清理临时文件失败:', e);
                        }
                    }, 2000);
                    
                    // 提示重启
                    setTimeout(() => {
                        showInfo('请手动重启应用以使用新版本');
                    }, 3000);
                    
                } else {
                    throw new Error(`安装可能失败: ${result}`);
                }
                
            } catch (error: any) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
                
                // 提供手动安装说明
                showInfo(`请手动安装: miniapp_cli install ${this.downloadPath}`);
            } finally {
                hideLoading();
            }
        },

        // 延迟函数
        delay(ms: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 清理临时文件
        async cleanup() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading('正在清理...');
                const result = await Shell.exec('rm -f /userdisk/miniapp_update_*.amr 2>/dev/null || true');
                console.log('清理结果:', result);
                showSuccess('清理完成');
            } catch (error: any) {
                console.error('清理失败:', error);
                showError(`清理失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },

        // 查看GitHub页面
        openGitHub() {
            const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
            showInfo(`GitHub Releases: ${url}`);
        },

        // 手动输入下载链接
        async manualDownload() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            showInfo('请在Shell中输入下载链接，格式如: https://github.com/.../miniapp_v1.0.1.amr');
            
            // 这里可以添加一个输入框让用户输入URL
            // 暂时使用提示
        },

        // 测试网络连接
        async testNetwork() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading('测试网络连接...');
                
                const testUrls = [
                    'https://github.com',
                    'https://raw.githubusercontent.com',
                    'https://api.github.com'
                ];
                
                let success = false;
                
                for (const url of testUrls) {
                    try {
                        const cmd = `curl -s -k --connect-timeout 10 "${url}" | head -c 100`;
                        const result = await Shell.exec(cmd);
                        if (result && result.trim().length > 0) {
                            showSuccess(`可以访问: ${url}`);
                            success = true;
                            break;
                        }
                    } catch (e) {
                        console.log(`无法访问 ${url}:`, e);
                    }
                }
                
                if (!success) {
                    showError('网络连接测试失败，请检查网络设置');
                }
                
            } catch (error: any) {
                console.error('网络测试失败:', error);
                showError(`网络测试失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        }
    }
});

export default update;
