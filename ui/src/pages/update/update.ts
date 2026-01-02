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

    async mounted() {
        // 只进行Shell初始化，不自动检查更新
        if (Shell && typeof Shell.initialize === 'function') {
            try {
                await Shell.initialize();
                this.shellInitialized = true;
                console.log('Shell初始化成功');
            } catch (error) {
                console.warn('Shell初始化失败:', error);
                this.shellInitialized = false;
            }
        }
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
        // 检查更新
        async checkForUpdates() {
            if (!this.shellInitialized) {
                showError('Shell模块未初始化，请稍后重试');
                return;
            }
            
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading('正在检查更新...');
                
                // 使用Shell curl命令获取GitHub API数据
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                console.log('检查更新，URL:', apiUrl);
                
                // 使用简单的curl命令
                const result = await Shell.exec(`curl -s -k "${apiUrl}"`);
                
                if (!result || result.trim() === '') {
                    throw new Error('无法获取更新信息');
                }
                
                // 解析JSON
                const data = JSON.parse(result);
                
                if (data.tag_name) {
                    this.latestVersion = data.tag_name.replace(/^v/, '');
                    this.releaseNotes = data.body || '暂无更新说明';
                    
                    // 查找匹配设备型号的.amr文件
                    if (data.assets && Array.isArray(data.assets)) {
                        // 预期的文件名模式: miniapp_{model}_v{version}.amr
                        const expectedPattern = `miniapp_${this.deviceModel}_v${this.latestVersion}`;
                        
                        let matchedAsset = data.assets.find((asset: any) => 
                            asset.name && (
                                asset.name.includes(expectedPattern) ||
                                asset.name.toLowerCase().includes(this.deviceModel)
                            )
                        );
                        
                        // 如果未找到匹配型号的文件，查找通用文件
                        if (!matchedAsset) {
                            matchedAsset = data.assets.find((asset: any) => 
                                asset.name && asset.name.endsWith('.amr')
                            );
                        }
                        
                        if (matchedAsset) {
                            this.downloadUrl = matchedAsset.browser_download_url;
                            this.fileSize = matchedAsset.size || 0;
                            console.log(`找到匹配的文件: ${matchedAsset.name}`);
                        }
                    }
                    
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo(`发现新版本 v${this.latestVersion} (${this.deviceModel})`);
                    } else {
                        this.status = 'updated';
                        showSuccess(`已是最新版本 v${this.currentVersion} (${this.deviceModel})`);
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
                showLoading(`正在下载 ${this.deviceModel} 型号的更新...`);
                
                // 设置下载路径，包含型号和版本信息
                const timestamp = Date.now();
                this.downloadPath = `/userdisk/miniapp_update_${timestamp}.amr`;
                
                console.log('下载URL:', this.downloadUrl);
                console.log('保存到:', this.downloadPath);
                
                // 使用curl下载文件
                const downloadCmd = `curl -k -L "${this.downloadUrl}" -o "${this.downloadPath}"`;
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

        // 安装更新
        async installUpdate() {
            if (!this.shellInitialized) {
                showError('无法安装更新');
                return;
            }
            
            this.status = 'installing';
            
            try {
                showLoading(`正在安装 ${this.deviceModel} 型号的更新...`);
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                showSuccess(`${this.deviceModel} 型号的更新安装完成！请重启应用`);
                this.status = 'updated';
                
                // 安装完成后立即清理临时文件
                try {
                    await Shell.exec(`rm -f "${this.downloadPath}"`);
                    console.log('清理临时文件成功');
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