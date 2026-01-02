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
import { showError, showSuccess, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';

export type UpdateOptions = {};

// GitHub配置
const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';

// 当前版本号
const CURRENT_VERSION = '1.0.0';
// 设备型号
const DEVICE_MODEL = 'a6p';

const update = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<UpdateOptions>,
            
            // 状态
            status: 'idle' as 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'updated' | 'error',
            errorMessage: '',
            
            // 版本信息
            currentVersion: CURRENT_VERSION,
            latestVersion: '',
            releaseNotes: '',
            downloadUrl: '',
            fileSize: 0,
            
            // 设备型号
            deviceModel: DEVICE_MODEL,
            
            // 下载信息
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
        };
    },

    mounted() {
        // 延迟初始化，避免立即执行导致问题
        console.log('页面加载完成');
        setTimeout(() => {
            console.log('开始初始化Shell...');
            this.initializeShell();
        }, 1000);
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
            if (!this.latestVersion) return false;
            return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
        },

        formattedFileSize(): string {
            const size = this.fileSize;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },
    },

    methods: {
        // 初始化Shell - 更安全的版本
        initializeShell() {
            try {
                console.log('检查Shell对象...');
                
                // 检查Shell对象是否存在
                if (typeof Shell === 'undefined') {
                    console.error('Shell对象未定义');
                    this.shellInitialized = false;
                    // 仍然尝试检查更新，但可能失败
                    setTimeout(() => {
                        this.checkForUpdates();
                    }, 2000);
                    return;
                }
                
                // 如果有initialize方法，尝试初始化
                if (Shell.initialize && typeof Shell.initialize === 'function') {
                    console.log('调用Shell.initialize()...');
                    Shell.initialize().then(() => {
                        this.shellInitialized = true;
                        console.log('Shell初始化成功');
                        this.checkForUpdates();
                    }).catch((error: any) => {
                        console.warn('Shell初始化失败:', error);
                        this.shellInitialized = false;
                        // 仍然尝试检查更新
                        setTimeout(() => {
                            this.checkForUpdates();
                        }, 2000);
                    });
                } else {
                    console.warn('Shell.initialize方法不存在，直接检查更新');
                    this.shellInitialized = false;
                    setTimeout(() => {
                        this.checkForUpdates();
                    }, 2000);
                }
                
            } catch (error: any) {
                console.error('初始化Shell时发生错误:', error);
                this.shellInitialized = false;
                // 仍然尝试检查更新
                setTimeout(() => {
                    this.checkForUpdates();
                }, 2000);
            }
        },

        // 检查更新
        async checkForUpdates() {
            this.status = 'checking';
            this.errorMessage = '';
            this.latestVersion = ''; // 清空最新版本，避免显示旧数据
            
            try {
                showLoading('正在检查更新...');
                console.log('开始检查更新...');
                
                // 使用GitHub API获取最新版本
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                console.log('检查更新URL:', apiUrl);
                
                let result = '';
                
                // 如果Shell已初始化，使用Shell.exec
                if (this.shellInitialized && Shell && Shell.exec) {
                    try {
                        result = await Shell.exec(`curl -s -k "${apiUrl}"`);
                        console.log('Shell.exec结果长度:', result.length);
                    } catch (execError) {
                        console.warn('Shell.exec失败:', execError);
                        // 尝试直接fetch
                        result = await this.fetchWithTimeout(apiUrl, 5000);
                    }
                } else {
                    // 如果没有Shell，尝试直接fetch
                    result = await this.fetchWithTimeout(apiUrl, 5000);
                }
                
                console.log('获取到的数据:', result.substring(0, 200) + '...');
                
                if (!result || result.trim() === '') {
                    throw new Error('无法获取更新信息');
                }
                
                // 解析JSON
                let data;
                try {
                    data = JSON.parse(result);
                    console.log('解析JSON成功，tag_name:', data.tag_name);
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    throw new Error('数据格式错误');
                }
                
                if (data.tag_name) {
                    this.latestVersion = data.tag_name;
                    this.releaseNotes = data.body || '暂无更新说明';
                    
                    // 查找匹配设备型号的文件
                    if (data.assets && Array.isArray(data.assets)) {
                        console.log('找到', data.assets.length, '个资源文件');
                        
                        const expectedFilename = `miniapp_${this.deviceModel}_v${this.latestVersion}.amr`;
                        
                        // 查找完全匹配的文件
                        let matchedAsset = data.assets.find((asset: any) => 
                            asset.name && asset.name === expectedFilename
                        );
                        
                        // 如果未找到，尝试查找包含型号的文件
                        if (!matchedAsset) {
                            matchedAsset = data.assets.find((asset: any) => 
                                asset.name && 
                                asset.name.includes(this.deviceModel) &&
                                asset.name.endsWith('.amr')
                            );
                        }
                        
                        // 如果还未找到，使用第一个.amr文件
                        if (!matchedAsset) {
                            matchedAsset = data.assets.find((asset: any) => 
                                asset.name && asset.name.endsWith('.amr')
                            );
                        }
                        
                        if (matchedAsset) {
                            this.downloadUrl = matchedAsset.browser_download_url;
                            this.fileSize = matchedAsset.size || 0;
                            console.log(`找到匹配的文件: ${matchedAsset.name}`);
                        } else {
                            console.warn('未找到.amr文件');
                        }
                    }
                    
                    console.log('当前版本:', this.currentVersion, '最新版本:', this.latestVersion);
                    console.log('hasUpdate:', this.hasUpdate);
                    
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo(`发现新版本 ${this.latestVersion}`);
                    } else {
                        this.status = 'updated';
                        showSuccess('已是最新版本');
                    }
                } else {
                    throw new Error('无效的Release数据');
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

        // 备用方法：使用fetch获取数据
        async fetchWithTimeout(url: string, timeout: number): Promise<string> {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('请求超时'));
                }, timeout);
                
                // 使用XMLHttpRequest替代fetch
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.timeout = timeout;
                xhr.onload = () => {
                    clearTimeout(timer);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                };
                xhr.onerror = () => {
                    clearTimeout(timer);
                    reject(new Error('网络错误'));
                };
                xhr.ontimeout = () => {
                    clearTimeout(timer);
                    reject(new Error('请求超时'));
                };
                xhr.send();
            });
        },

        // 比较版本号
        compareVersions(v1: string, v2: string): number {
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
            if (!this.shellInitialized) {
                showError('Shell模块未初始化');
                return;
            }
            
            if (!this.downloadUrl) {
                showError('没有可用的下载链接');
                return;
            }
            
            this.status = 'downloading';
            
            try {
                showLoading('开始下载...');
                
                // 设置下载路径
                const timestamp = Date.now();
                this.downloadPath = `/userdisk/miniapp_update_${timestamp}.amr`;
                
                // 下载文件
                const downloadCmd = `curl -k -L "${this.downloadUrl}" -o "${this.downloadPath}"`;
                console.log('执行下载命令:', downloadCmd);
                await Shell.exec(downloadCmd);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
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

        // 安装更新并自动清理
        async installUpdate() {
            if (!this.shellInitialized) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            
            try {
                showLoading('正在安装...');
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                showSuccess('安装完成！请重启应用');
                this.status = 'updated';
                
                // 立即清理下载的文件
                try {
                    await Shell.exec(`rm -f "${this.downloadPath}"`);
                    console.log('安装完成后自动清理临时文件成功');
                } catch (e) {
                    console.warn('清理临时文件失败:', e);
                }
                
            } catch (error: any) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
            } finally {
                hideLoading();
            }
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },
    }
});

export default update;