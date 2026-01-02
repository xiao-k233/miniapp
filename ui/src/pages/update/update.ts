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

// 当前版本号（每次发布需要更新）
const CURRENT_VERSION = '1.2.4';
// 设备型号（根据设备设置）
const DEVICE_MODEL = 'a6p'; // 例如: a6p, a6x, a5, c7 等

// 镜像源配置
const MIRRORS = [
    {
        id: 'none',
        name: '不使用镜像 (直接下载)',
        buttonName: '无镜像源',
        enabled: false,
        urlPattern: '{url}',
        apiPattern: '{url}',
        testUrl: 'https://github.com'
    },
    {
        id: 'ghproxy',
        name: 'ghproxy.net (推荐)',
        buttonName: 'ghproxy源',
        enabled: true,
        urlPattern: 'https://ghproxy.net/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.net/https://github.com'
    },
    {
        id: 'fastgit',
        name: 'FastGit',
        buttonName: 'FastGit源',
        enabled: true,
        urlPattern: 'https://download.fastgit.org/{path}',
        apiPattern: 'https://api.fastgit.org/{path}',
        testUrl: 'https://download.fastgit.org'
    },
    {
        id: 'ghproxycn',
        name: 'ghproxy.com',
        buttonName: 'ghproxy.com源',
        enabled: true,
        urlPattern: 'https://ghproxy.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.com/https://github.com'
    },
    {
        id: 'kgithub',
        name: 'kgithub.com',
        buttonName: 'kgithub源',
        enabled: true,
        urlPattern: 'https://kgithub.com/{path}',
        apiPattern: 'https://api.kgithub.com/{path}',
        testUrl: 'https://kgithub.com'
    },
    {
        id: 'hubfast',
        name: 'hub.fastgit.xyz',
        buttonName: 'hubfast源',
        enabled: true,
        urlPattern: 'https://hub.fastgit.xyz/{path}',
        apiPattern: 'https://hub.fastgit.xyz/api/{path}',
        testUrl: 'https://hub.fastgit.xyz'
    }
];

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
            
            // 设备型号（使用常量）
            deviceModel: DEVICE_MODEL,
            
            // 下载信息
            downloadPath: '',
            
            // Shell状态
            shellInitialized: false,
            
            // 镜像源设置
            mirrors: MIRRORS,
            selectedMirror: 'ghproxy', // 默认使用ghproxy镜像
            useMirror: true, // 是否使用镜像
            currentMirror: MIRRORS.find(m => m.id === 'ghproxy') || MIRRORS[0],
        };
    },

    async mounted() {
        await this.initializeShell();
        await this.autoCheckUpdates();
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

        // 显示版本信息，包括型号
        versionInfo(): string {
            if (this.latestVersion) {
                return `最新版本: v${this.latestVersion} (${this.deviceModel} 型号)`;
            }
            return `当前版本: v${this.currentVersion} (${this.deviceModel} 型号)`;
        },

        // 当前设备对应的预期文件名
        currentDeviceFilename(): string {
            if (this.latestVersion) {
                return `miniapp_${this.deviceModel}_v${this.latestVersion}.amr`;
            }
            return `miniapp_${this.deviceModel}_v${this.currentVersion}.amr`;
        },

        // 显示更新状态摘要
        updateStatusSummary(): string {
            if (this.status === 'checking') return '正在检查更新...';
            if (this.status === 'available') return `发现新版本 v${this.latestVersion} (${this.deviceModel})`;
            if (this.status === 'updated') return `已是最新版本 v${this.currentVersion} (${this.deviceModel})`;
            if (this.status === 'error') return '检查更新失败';
            return `当前版本: v${this.currentVersion} (${this.deviceModel})`;
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
                console.log(`设备型号: ${this.deviceModel}`);
            } catch (error: any) {
                console.error('Shell初始化失败:', error);
                this.shellInitialized = false;
            }
        },

        // 页面加载时自动检查更新
        async autoCheckUpdates() {
            // 等待Shell初始化完成
            setTimeout(async () => {
                if (this.shellInitialized) {
                    await this.checkForUpdates();
                } else {
                    // 如果Shell未初始化，等待一段时间再重试
                    setTimeout(() => {
                        if (this.shellInitialized) {
                            this.checkForUpdates();
                        }
                    }, 2000);
                }
            }, 1000);
        },

        // 检查更新
        async checkForUpdates() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading('正在检查更新...');
                
                // 使用Shell curl命令获取GitHub API数据
                const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                console.log('检查更新，URL:', apiUrl);
                console.log('设备型号:', this.deviceModel);
                console.log('当前版本:', this.currentVersion);
                
                // 尝试不同的curl命令选项
                const curlCommands = [
                    `curl -s -k -L "${apiUrl}"`,
                    `curl -s -k -H "Accept: application/json" "${apiUrl}"`,
                    `curl -s -k -H "User-Agent: miniapp" "${apiUrl}"`
                ];
                
                let result = '';
                let success = false;
                
                for (const cmd of curlCommands) {
                    try {
                        console.log('尝试命令:', cmd);
                        result = await Shell.exec(cmd);
                        
                        if (result && result.trim() !== '') {
                            success = true;
                            break;
                        }
                    } catch (cmdError) {
                        console.log('命令失败:', cmd, cmdError);
                    }
                }
                
                if (!success) {
                    throw new Error('无法获取更新信息');
                }
                
                // 解析JSON
                let data: any;
                try {
                    data = JSON.parse(result);
                    console.log('GitHub API响应:', data);
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError, '原始数据:', result);
                    throw new Error('数据格式错误');
                }
                
                if (data.tag_name) {
                    // 获取版本号（移除可能的v前缀）
                    const tagVersion = data.tag_name.replace(/^v/, '');
                    this.latestVersion = tagVersion;
                    this.releaseNotes = data.body || '暂无更新说明';
                    
                    // 查找匹配设备型号的.amr文件
                    if (data.assets && Array.isArray(data.assets)) {
                        console.log('可用的资源文件:', data.assets.map((a: any) => a.name));
                        
                        // 构建预期的文件名
                        const expectedFilename = `miniapp_${this.deviceModel}_v${tagVersion}.amr`;
                        console.log('预期的文件名:', expectedFilename);
                        
                        // 查找完全匹配的文件
                        let matchedAsset = data.assets.find((asset: any) => 
                            asset.name && asset.name === expectedFilename
                        );
                        
                        // 如果未找到完全匹配的文件，尝试查找包含型号和版本的文件
                        if (!matchedAsset) {
                            matchedAsset = data.assets.find((asset: any) => 
                                asset.name && 
                                asset.name.includes(this.deviceModel) && 
                                asset.name.includes(tagVersion) &&
                                asset.name.endsWith('.amr')
                            );
                        }
                        
                        // 如果还未找到，尝试查找包含型号的文件
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
                            
                            // 检查文件是否匹配当前设备型号
                            if (matchedAsset.name.includes(this.deviceModel)) {
                                console.log(`文件匹配当前设备型号: ${this.deviceModel}`);
                            } else {
                                console.warn(`警告: 文件 ${matchedAsset.name} 不匹配当前设备型号 ${this.deviceModel}`);
                            }
                        } else {
                            console.warn('未找到合适的.amr文件');
                            throw new Error(`未找到适用于 ${this.deviceModel} 型号的更新文件`);
                        }
                    } else {
                        throw new Error('Release中没有找到资源文件');
                    }
                    
                    if (this.hasUpdate) {
                        this.status = 'available';
                        showInfo(`发现新版本 ${this.latestVersion} (${this.deviceModel})`);
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
            if (!this.shellInitialized || !Shell) {
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
                this.downloadPath = `/userdisk/miniapp_${this.deviceModel}_v${this.latestVersion}_${timestamp}.amr`;
                
                // 根据是否使用镜像源构建下载URL
                let finalDownloadUrl = this.downloadUrl;
                if (this.useMirror && this.currentMirror.enabled) {
                    if (this.currentMirror.urlPattern.includes('{url}')) {
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{url}', this.downloadUrl);
                    } else if (this.currentMirror.urlPattern.includes('{path}')) {
                        const urlObj = new URL(this.downloadUrl);
                        const path = urlObj.pathname + urlObj.search;
                        finalDownloadUrl = this.currentMirror.urlPattern.replace('{path}', path);
                    }
                }
                
                console.log('下载URL:', finalDownloadUrl);
                console.log('保存到:', this.downloadPath);
                console.log('设备型号:', this.deviceModel);
                console.log('目标版本:', this.latestVersion);
                console.log('使用镜像:', this.useMirror ? this.currentMirror.name : '无');
                
                // 使用curl下载文件
                const downloadCmd = `curl -k -L "${finalDownloadUrl}" -o "${this.downloadPath}"`;
                console.log('执行命令:', downloadCmd);
                
                await Shell.exec(downloadCmd);
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取文件大小
                    const sizeCmd = `wc -c < "${this.downloadPath}"`;
                    const fileSize = parseInt(await Shell.exec(sizeCmd)) || 0;
                    console.log(`文件下载成功，大小: ${fileSize} 字节`);
                    
                    if (fileSize > 0) {
                        showSuccess(`${this.deviceModel} 型号的更新下载完成，开始安装`);
                        await this.installUpdate();
                    } else {
                        throw new Error('下载的文件为空');
                    }
                } else {
                    throw new Error('文件下载失败');
                }
                
            } catch (error: any) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
                
                // 提供手动安装说明
                if (this.downloadUrl) {
                    showInfo(`手动下载 ${this.deviceModel} 型号的更新: ${this.downloadUrl}`);
                    showInfo(`下载后执行: miniapp_cli install 文件名.amr`);
                }
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
                showLoading(`正在安装 ${this.deviceModel} 型号的更新...`);
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                console.log('设备型号:', this.deviceModel);
                console.log('安装文件:', this.downloadPath);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                showSuccess(`${this.deviceModel} 型号的更新安装完成！请重启应用`);
                this.status = 'updated';
                
                // 清理下载的文件
                setTimeout(async () => {
                    try {
                        await Shell.exec(`rm -f "${this.downloadPath}"`);
                        console.log('清理临时文件成功');
                    } catch (e) {
                        console.warn('清理临时文件失败:', e);
                    }
                }, 3000);
                
            } catch (error: any) {
                console.error('安装失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '安装失败';
                showError(`安装失败: ${this.errorMessage}`);
                
                showInfo(`手动安装 ${this.deviceModel} 型号的更新:`);
                showInfo(`miniapp_cli install ${this.downloadPath}`);
            } finally {
                hideLoading();
            }
        },

        // 选择镜像源
        selectMirror(mirrorId: string) {
            const mirror = this.mirrors.find(m => m.id === mirrorId);
            if (mirror) {
                this.selectedMirror = mirrorId;
                this.currentMirror = mirror;
                this.useMirror = mirror.enabled;
                showInfo(`已切换到镜像源: ${mirror.name}`);
            }
        },

        // 测试镜像源
        async testMirror() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading(`正在测试镜像源: ${this.currentMirror.name}...`);
                
                const testUrl = this.currentMirror.testUrl;
                const testCmd = `curl -s -k --connect-timeout 10 "${testUrl}" | head -c 100`;
                
                await Shell.exec(testCmd);
                
                showSuccess(`镜像源 ${this.currentMirror.name} 连接正常`);
            } catch (error: any) {
                console.error('镜像源测试失败:', error);
                showError(`镜像源 ${this.currentMirror.name} 连接失败，请尝试其他镜像源`);
            } finally {
                hideLoading();
            }
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
                // 清理所有miniapp更新文件
                await Shell.exec('rm -f /userdisk/miniapp_*_v*_*.amr 2>/dev/null || true');
                await Shell.exec('rm -f /userdisk/miniapp_update_*.amr 2>/dev/null || true');
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
            showInfo(`请访问: ${url}`);
        },

        // 测试网络连接
        async testNetwork() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            try {
                showLoading('测试网络连接...');
                
                const testCmd = `curl -s -k --connect-timeout 10 "https://github.com"`;
                await Shell.exec(testCmd);
                
                showSuccess('网络连接正常');
            } catch (error: any) {
                console.error('网络测试失败:', error);
                showError('网络连接失败，请检查网络设置');
            } finally {
                hideLoading();
            }
        },

        // 显示设备信息
        showDeviceInfo() {
            showInfo(`设备型号: ${this.deviceModel}\n当前版本: v${this.currentVersion}`);
        },

        // 格式化日期
        formatDate(dateString: string): string {
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('zh-CN');
            } catch (e) {
                return dateString;
            }
        },
    }
});

export default update;