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

// GitHub配置 - 使用常量定义
const GITHUB_OWNER = 'penosext';
const RELEASE_REPO = 'miniapp';  // 发布版仓库
const DEV_REPO = 'miniapp_dev';      // 开发版仓库

// 当前版本号（每次发布需要更新）
const CURRENT_VERSION = '1.2.11';
// 设备型号（根据设备设置）
const DEVICE_MODEL = 'x7'; // 例如: a6p, a6x, a5, c7 等

// 镜像源配置 - 添加buttonName字段显示简短名称
const MIRRORS = [
    {
        id: 'github',
        name: 'github',
        buttonName: 'github',
        enabled: false,
        urlPattern: '{url}',
        apiPattern: '{url}',
        testUrl: 'https://github.com'
    },
    {
        id: 'ghproxy',
        name: 'ghproxy',
        buttonName: 'ghproxy源',
        enabled: true,
        urlPattern: 'https://ghproxy.net/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.net/https://github.com'
    },
    {
        id: 'langningchen',
        name: 'langningchen',
        buttonName: 'langningchen源',
        enabled: true,
        urlPattern: 'https://proxy.langningchen.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://proxy.langningchen.com/https://github.com'
    },
    {
        id: 'fastgit',
        name: 'FastGit',
        buttonName: 'FastGit源',
        enabled: true,
        urlPattern: 'https://download.fastgit.org/{path}',
        apiPattern: '{url}',
        testUrl: 'https://download.fastgit.org'
    },
    {
        id: 'ghproxycn',
        name: 'ghproxycn',
        buttonName: 'ghproxycn源',
        enabled: true,
        urlPattern: 'https://ghproxy.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.com/https://github.com'
    },
    {
        id: 'kgithub',
        name: 'kgithub',
        buttonName: 'kgithub源',
        enabled: true,
        urlPattern: 'https://kgithub.com/{path}',
        apiPattern: 'https://api.kgithub.com/{path}',
        testUrl: 'https://kgithub.com'
    },
    {
        id: 'hubfast',
        name: 'hubfast',
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
            selectedMirror: 'langningchen', // 默认使用langningchen镜像
            useMirror: true, // 是否使用镜像
            currentMirror: MIRRORS.find(m => m.id === 'langningchen') || MIRRORS[0],
            
            // 设备匹配状态
            deviceMatched: true,
            otherDeviceModels: [] as string[],
            
            // 下载进度信息
            downloadedSize: 0,
            downloadProgress: 0,
            downloadProgressText: '',
            downloadTimer: null as any,
            isDownloading: false,
            
            // GitHub仓库设置
            currentRepo: 'release' as 'release' | 'dev', // 当前选择的仓库
            currentRepoName: RELEASE_REPO, // 当前仓库名称
            releaseRepoName: RELEASE_REPO, // 发布版仓库名
            devRepoName: DEV_REPO, // 开发版仓库名
            githubOwner: GITHUB_OWNER, // GitHub用户名
            
            // 解锁安装限制
            unlockInstall: false, // 是否解锁安装限制
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
                case 'available': return this.deviceMatched ? '发现新版本' : '有新版本但不匹配设备';
                case 'downloading': return '正在下载更新...';
                case 'installing': return '正在安装...';
                case 'updated': return '已是最新版本';
                case 'error': return '检查更新失败';
                default: return '';
            }
        },

        statusClass(): string {
            switch (this.status) {
                case 'idle': return 'status-idle'; // 准备就绪使用绿色
                case 'checking': return 'status-checking';
                case 'available': 
                    return this.deviceMatched ? 'status-available' : 'status-error';
                case 'updated': return 'status-updated';
                case 'error': return 'status-error';
                default: return '';
            }
        },

        // 是否可以安装（有下载链接且设备匹配）
        canInstall(): boolean {
            // 必须有最新版本和下载链接
            if (!this.latestVersion || !this.downloadUrl) {
                console.log('canInstall: 缺少最新版本或下载链接', {
                    latestVersion: this.latestVersion,
                    downloadUrl: !!this.downloadUrl
                });
                return false;
            }
            
            // 设备必须匹配
            if (!this.deviceMatched) {
                console.log('canInstall: 设备不匹配', {
                    deviceModel: this.deviceModel,
                    deviceMatched: this.deviceMatched
                });
                return false;
            }
            
            // 如果解锁了安装限制，任何版本都可以安装
            if (this.unlockInstall) {
                console.log('canInstall: 解锁状态下可以安装');
                return true;
            }
            
            // 未解锁时，只有新版本可以安装
            const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
            const canInstall = compareResult > 0;
            console.log('canInstall: 未解锁状态', {
                latestVersion: this.latestVersion,
                currentVersion: this.currentVersion,
                compareResult,
                canInstall
            });
            return canInstall;
        },

        // 安装按钮类
        installButtonClass(): string {
            if (!this.canInstall) {
                return 'no-update-btn'; // 无更新时灰色背景
            } else {
                return 'install-btn'; // 有更新时绿色背景
            }
        },

        // 安装按钮文本
        installButtonText(): string {
            console.log('installButtonText计算:', {
                canInstall: this.canInstall,
                latestVersion: this.latestVersion,
                downloadUrl: !!this.downloadUrl,
                deviceMatched: this.deviceMatched,
                unlockInstall: this.unlockInstall,
                currentVersion: this.currentVersion,
                text: this.canInstall ? (this.unlockInstall ? '安装/回退' : '安装') : '暂无更新'
            });
            
            if (!this.canInstall) {
                return '暂无更新';
            }
            
            if (this.unlockInstall) {
                const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
                if (compareResult > 0) {
                    return '安装';
                } else if (compareResult < 0) {
                    return '回退';
                } else {
                    return '安装'; // 相同版本也显示为安装
                }
            } else {
                // 未解锁时，只有新版本才显示安装
                return '安装';
            }
        },

        formattedFileSize(): string {
            const size = this.fileSize;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        // 格式化的下载进度文本
        formattedDownloadedSize(): string {
            const size = this.downloadedSize;
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
            return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        },

        // 当前设备对应的预期文件名
        currentDeviceFilename(): string {
            if (this.latestVersion) {
                return `miniapp_${this.deviceModel}_v${this.latestVersion}.amr`;
            }
            return `miniapp_${this.deviceModel}_v${this.currentVersion}.amr`;
        },

        // 当前仓库完整名称
        currentRepoFullName(): string {
            return `${this.githubOwner}/${this.currentRepoName}`;
        },

        // 当前仓库显示文本
        repoButtonText(): string {
            return this.currentRepo === 'release' ? '切换到开发版' : '切换到发布版';
        },

        // 下载按钮文本（固定为"检查更新"）
        downloadButtonText(): string {
            return '检查更新';
        },

        // 下载按钮是否可用
        downloadButtonDisabled(): boolean {
            return this.status === 'checking' || this.status === 'downloading' || this.status === 'installing';
        },

        // 仓库按钮是否可用
        repoButtonDisabled(): boolean {
            return this.status === 'checking' || this.status === 'downloading' || this.status === 'installing';
        },

        // 解锁按钮文本
        unlockButtonText(): string {
            return this.unlockInstall ? '锁定安装' : '解锁安装';
        },

        // 解锁按钮颜色类
        unlockButtonClass(): string {
            return this.unlockInstall ? 'unlock-btn-active' : 'unlock-btn';
        },

        // 安装按钮是否可用
        installButtonDisabled(): boolean {
            // 如果不能安装，则禁用
            if (!this.canInstall) {
                return true;
            }
            
            // 如果正在检查、下载或安装，则禁用
            return this.status === 'checking' || this.status === 'downloading' || this.status === 'installing';
        },

        // 版本比较结果文本
        versionCompareText(): string {
            if (!this.latestVersion) return '';
            
            const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
            if (compareResult > 0) {
                return '发现新版本';
            } else if (compareResult < 0) {
                return '版本回退';
            } else {
                return '相同版本';
            }
        },

        // 版本比较结果颜色
        versionCompareClass(): string {
            if (!this.latestVersion) return '';
            
            const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
            if (compareResult > 0) {
                return 'version-newer';
            } else if (compareResult < 0) {
                return 'version-older';
            } else {
                return 'version-same';
            }
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
            this.deviceMatched = true;
            this.otherDeviceModels = [];
            
            try {
                showLoading('正在检查更新...');
                
                // 根据当前选择的仓库决定使用哪个仓库名
                const repoName = this.currentRepo === 'release' ? this.releaseRepoName : this.devRepoName;
                this.currentRepoName = repoName;
                
                // 使用Shell curl命令获取GitHub API数据
                const apiUrl = `https://api.github.com/repos/${this.githubOwner}/${repoName}/releases/latest`;
                console.log('检查更新，URL:', apiUrl);
                console.log('GitHub用户:', this.githubOwner);
                console.log('仓库:', repoName);
                console.log('仓库类型:', this.currentRepo);
                console.log('设备型号:', this.deviceModel);
                console.log('当前版本:', this.currentVersion);
                console.log('解锁状态:', this.unlockInstall);
                
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
                        
                        // 构建预期的文件名模式
                        const expectedFilenamePattern = `miniapp_${this.deviceModel}_v${tagVersion}.amr`;
                        console.log('预期的文件名:', expectedFilenamePattern);
                        
                        // 查找完全匹配当前设备型号的文件
                        let matchedAsset = data.assets.find((asset: any) => 
                            asset.name && asset.name === expectedFilenamePattern
                        );
                        
                        // 如果未找到完全匹配，尝试查找包含设备型号的文件
                        if (!matchedAsset) {
                            const deviceModelRegex = new RegExp(`miniapp_${this.deviceModel}_v[0-9.]+\.amr$`, 'i');
                            matchedAsset = data.assets.find((asset: any) => 
                                asset.name && deviceModelRegex.test(asset.name)
                            );
                        }
                        
                        // 查找其他设备型号的文件（用于信息提示）
                        const otherDeviceAssets = data.assets.filter((asset: any) => {
                            if (!asset.name || !asset.name.endsWith('.amr')) return false;
                            // 检查是否包含其他设备型号
                            const deviceModelRegex = /miniapp_([a-z0-9]+)_v[0-9.]+\.amr$/i;
                            const match = asset.name.match(deviceModelRegex);
                            if (match && match[1] !== this.deviceModel) {
                                return true;
                            }
                            return false;
                        });
                        
                        // 收集其他设备型号
                        this.otherDeviceModels = otherDeviceAssets.map((asset: any) => {
                            const match = asset.name.match(/miniapp_([a-z0-9]+)_v[0-9.]+\.amr$/i);
                            return match ? match[1] : 'unknown';
                        }).filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);
                        
                        if (matchedAsset) {
                            this.downloadUrl = matchedAsset.browser_download_url;
                            this.fileSize = matchedAsset.size || 0;
                            this.deviceMatched = true;
                            console.log(`找到匹配的文件: ${matchedAsset.name}`);
                            console.log(`文件匹配当前设备型号: ${this.deviceModel}`);
                            console.log('下载URL:', this.downloadUrl);
                        } else {
                            this.deviceMatched = false;
                            this.downloadUrl = '';
                            console.warn(`警告: 未找到适用于 ${this.deviceModel} 型号的更新文件`);
                            
                            if (otherDeviceAssets.length > 0) {
                                console.log(`发现其他设备的更新文件: ${otherDeviceAssets.map((a: any) => a.name).join(', ')}`);
                                console.log(`可用设备型号: ${this.otherDeviceModels.join(', ')}`);
                            }
                        }
                    } else {
                        this.deviceMatched = false;
                        this.downloadUrl = '';
                        throw new Error('Release中没有找到资源文件');
                    }
                    
                    // 检查版本比较结果
                    const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
                    console.log('版本比较结果:', {
                        latestVersion: this.latestVersion,
                        currentVersion: this.currentVersion,
                        compareResult,
                        deviceMatched: this.deviceMatched,
                        downloadUrl: !!this.downloadUrl
                    });
                    
                    if (compareResult > 0) {
                        if (this.deviceMatched) {
                            this.status = 'available';
                            showInfo(`发现新版本 ${this.latestVersion} (${this.deviceModel}) [${this.currentRepo}]`);
                        } else {
                            this.status = 'available'; // 仍然显示为available，但设备不匹配
                            if (this.otherDeviceModels.length > 0) {
                                showWarning(`发现新版本 ${this.latestVersion}，但不适用于当前设备 (${this.deviceModel})。可用设备型号: ${this.otherDeviceModels.join(', ')}`);
                            } else {
                                showWarning(`发现新版本 ${this.latestVersion}，但没有适用于 ${this.deviceModel} 型号的文件`);
                            }
                        }
                    } else {
                        this.status = 'updated';
                        if (compareResult < 0) {
                            showInfo(`当前版本 v${this.currentVersion} 比仓库版本 v${this.latestVersion} 更高 [${this.currentRepo}]`);
                        } else {
                            showSuccess(`已是最新版本 v${this.currentVersion} (${this.deviceModel}) [${this.currentRepo}]`);
                        }
                    }
                } else {
                    throw new Error('无效的Release数据');
                }
                
            } catch (error: any) {
                console.error('检查更新失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '网络连接失败';
                showError(`检查更新失败: ${this.errorMessage} [仓库: ${this.currentRepo}]`);
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

        // 更新下载进度
        async updateDownloadProgress() {
            if (!this.downloadPath || !Shell || !this.isDownloading) return;
            
            try {
                // 检查文件是否存在并获取大小
                const checkCmd = `test -f "${this.downloadPath}" && wc -c < "${this.downloadPath}" || echo 0`;
                const sizeResult = await Shell.exec(checkCmd);
                const currentSize = parseInt(sizeResult.trim()) || 0;
                
                this.downloadedSize = currentSize;
                
                if (this.fileSize > 0) {
                    this.downloadProgress = Math.min(100, Math.round((currentSize / this.fileSize) * 100));
                    this.downloadProgressText = `${this.formattedDownloadedSize}/${this.formattedFileSize} (${this.downloadProgress}%)`;
                } else {
                    this.downloadProgressText = `${this.formattedDownloadedSize}`;
                }
                
                console.log(`下载进度: ${this.downloadProgressText}`);
                
                // 如果下载完成，停止定时器
                if (currentSize >= this.fileSize && this.fileSize > 0) {
                    this.clearDownloadProgress();
                    this.isDownloading = false;
                }
                
            } catch (error) {
                console.warn('获取下载进度失败:', error);
            }
        },

        // 清理下载进度监控
        clearDownloadProgress() {
            if (this.downloadTimer) {
                clearInterval(this.downloadTimer);
                this.downloadTimer = null;
            }
            this.isDownloading = false;
        },

        // 下载更新
        async downloadUpdate() {
            if (!this.shellInitialized || !Shell) {
                showError('Shell模块未初始化');
                return;
            }
            
            if (!this.canInstall) {
                showError('没有可安装的更新');
                return;
            }
            
            // 检查设备匹配
            if (!this.deviceMatched && !this.unlockInstall) {
                showError(`当前更新不适用于您的设备 (${this.deviceModel})`);
                if (this.otherDeviceModels.length > 0) {
                    showInfo(`此更新适用于: ${this.otherDeviceModels.join(', ')} 型号`);
                }
                return;
            }
            
            this.status = 'downloading';
            this.clearDownloadProgress(); // 清理之前的进度
            this.downloadedSize = 0;
            this.downloadProgress = 0;
            this.downloadProgressText = '';
            
            try {
                // 根据是否解锁显示不同的提示
                const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
                let loadingText = `正在下载 ${this.deviceModel} 型号的更新...`;
                
                if (this.unlockInstall) {
                    if (compareResult > 0) {
                        loadingText = `正在下载新版本 v${this.latestVersion}...`;
                    } else if (compareResult < 0) {
                        loadingText = `正在回退到版本 v${this.latestVersion}...`;
                    } else {
                        loadingText = `正在重新安装版本 v${this.latestVersion}...`;
                    }
                }
                
                showLoading(loadingText);
                
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
                console.log('仓库类型:', this.currentRepo);
                console.log('解锁状态:', this.unlockInstall);
                console.log('使用镜像:', this.useMirror ? this.currentMirror.name : '无');
                console.log('文件总大小:', this.fileSize, 'bytes');
                
                // 启动进度监控（每秒更新一次）
                this.isDownloading = true;
                this.downloadTimer = setInterval(async () => {
                    await this.updateDownloadProgress();
                }, 1000);
                
                // 使用curl下载文件（简单版本，不使用后台进程）
                const downloadCmd = `curl -k -L "${finalDownloadUrl}" -o "${this.downloadPath}"`;
                console.log('执行命令:', downloadCmd);
                
                // 执行下载命令
                await Shell.exec(downloadCmd);
                
                // 等待一下确保文件已写入
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 清理进度监控
                this.clearDownloadProgress();
                
                // 检查文件是否下载成功
                const checkCmd = `test -f "${this.downloadPath}" && echo "exists"`;
                const checkResult = await Shell.exec(checkCmd);
                
                if (checkResult.trim() === 'exists') {
                    // 获取最终文件大小
                    const sizeCmd = `wc -c < "${this.downloadPath}"`;
                    const fileSize = parseInt(await Shell.exec(sizeCmd)) || 0;
                    console.log(`文件下载成功，最终大小: ${fileSize} 字节`);
                    
                    if (fileSize > 0) {
                        const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
                        let successMsg = `${this.deviceModel} 型号的更新下载完成，开始安装`;
                        
                        if (this.unlockInstall) {
                            if (compareResult > 0) {
                                successMsg = `新版本 v${this.latestVersion} 下载完成，开始安装`;
                            } else if (compareResult < 0) {
                                successMsg = `版本回退到 v${this.latestVersion} 下载完成，开始安装`;
                            } else {
                                successMsg = `版本 v${this.latestVersion} 重新下载完成，开始安装`;
                            }
                        }
                        
                        showSuccess(successMsg);
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
                
                // 清理进度监控
                this.clearDownloadProgress();
                
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
            
            // 检查设备匹配
            if (!this.deviceMatched && !this.unlockInstall) {
                showError(`当前更新不适用于您的设备 (${this.deviceModel})，安装已取消`);
                return;
            }
            
            this.status = 'installing';
            
            try {
                const compareResult = this.compareVersions(this.latestVersion, this.currentVersion);
                let loadingText = `正在安装 ${this.deviceModel} 型号的更新...`;
                
                if (this.unlockInstall) {
                    if (compareResult > 0) {
                        loadingText = `正在安装新版本 v${this.latestVersion}...`;
                    } else if (compareResult < 0) {
                        loadingText = `正在回退到版本 v${this.latestVersion}...`;
                    } else {
                        loadingText = `正在重新安装版本 v${this.latestVersion}...`;
                    }
                }
                
                showLoading(loadingText);
                
                // 执行安装命令
                const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                console.log('执行安装命令:', installCmd);
                console.log('设备型号:', this.deviceModel);
                console.log('安装文件:', this.downloadPath);
                console.log('解锁状态:', this.unlockInstall);
                
                const result = await Shell.exec(installCmd);
                console.log('安装结果:', result);
                
                // 清理旧的临时文件
                await Shell.exec('rm -f /userdisk/miniapp_*_v*_*.amr 2>/dev/null || true');
                await Shell.exec('rm -f /userdisk/miniapp_update_*.amr 2>/dev/null || true');
                
                // 根据是否解锁显示不同的成功消息
                const compareResult2 = this.compareVersions(this.latestVersion, this.currentVersion);
                let successMsg = `${this.deviceModel} 型号的更新安装完成！请重启应用`;
                
                if (this.unlockInstall) {
                    if (compareResult2 > 0) {
                        successMsg = `新版本 v${this.latestVersion} 安装完成！请重启应用`;
                    } else if (compareResult2 < 0) {
                        successMsg = `已回退到版本 v${this.latestVersion}！请重启应用`;
                    } else {
                        successMsg = `版本 v${this.latestVersion} 重新安装完成！请重启应用`;
                    }
                }
                
                showSuccess(successMsg);
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

        // 切换GitHub仓库
        switchRepo() {
            if (this.repoButtonDisabled) {
                showWarning('正在检查或下载更新，请稍后再切换');
                return;
            }
            
            // 切换仓库类型
            this.currentRepo = this.currentRepo === 'release' ? 'dev' : 'release';
            
            // 更新仓库名称
            this.currentRepoName = this.currentRepo === 'release' ? this.releaseRepoName : this.devRepoName;
            
            // 清空之前的更新信息
            this.latestVersion = '';
            this.releaseNotes = '';
            this.downloadUrl = '';
            this.fileSize = 0;
            this.status = 'idle';
            
            // 显示切换信息
            const repoDisplayName = this.currentRepo === 'release' ? '发布版' : '开发版';
            showInfo(`已切换到 ${repoDisplayName} 仓库: ${this.currentRepoFullName}`);
            
            // 自动检查新仓库的更新
            setTimeout(() => {
                this.checkForUpdates();
            }, 500);
        },

        // 处理检查更新按钮点击
        handleCheckUpdate() {
            // 总是检查更新
            this.checkForUpdates();
        },

        // 切换解锁状态
        toggleUnlock() {
            this.unlockInstall = !this.unlockInstall;
            
            if (this.unlockInstall) {
                showInfo('已解锁安装限制，可以安装任意版本（需设备型号匹配）');
            } else {
                showInfo('已锁定安装限制，仅可安装新版本');
            }
            
            console.log('解锁状态:', this.unlockInstall);
        },

        // 查看GitHub页面
        openGitHub() {
            const url = `https://github.com/${this.githubOwner}/${this.currentRepoName}/releases`;
            showInfo(`请访问: ${url} (${this.currentRepo})`);
        },

        // 显示设备信息
        showDeviceInfo() {
            let info = `设备型号: ${this.deviceModel}\n当前版本: v${this.currentVersion}\n当前仓库: ${this.currentRepo} (${this.currentRepoFullName})\n解锁状态: ${this.unlockInstall ? '已解锁' : '已锁定'}`;
            if (this.otherDeviceModels.length > 0) {
                info += `\n\n发现其他设备型号的更新: ${this.otherDeviceModels.join(', ')}`;
            }
            showInfo(info);
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