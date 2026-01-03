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
import { showError, showSuccess, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { Shell } from 'langningchen';
import { Update } from 'langningchen';

export type UpdateOptions = {};

// GitHub配置
const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';

// 当前版本号（每次发布需要更新）
const CURRENT_VERSION = '1.2.10.5';
// 设备型号（根据设备设置）
const DEVICE_MODEL = 'a6p'; // 例如: a6p, a6x, a5, c7 等

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
        apiPattern: 'https://api.fastgit.org/{path}',
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
            assetName: '',
            publishedAt: '',
            
            // 设备型号（使用常量）
            deviceModel: DEVICE_MODEL,
            
            // 下载信息
            downloadPath: '',
            
            // 镜像源设置
            mirrors: MIRRORS,
            selectedMirror: 'langningchen', // 默认使用langningchen镜像
            useMirror: true, // 是否使用镜像
            currentMirror: MIRRORS.find(m => m.id === 'langningchen') || MIRRORS[0],
            
            // Update API状态
            updateApiAvailable: false,
            updateInitialized: false,
            
            // Shell状态（作为备用方案）
            shellInitialized: false,
        };
    },

    async mounted() {
        // 初始化Update API
        await this.initializeUpdateAPI();
        // 初始化Shell（作为备用）
        await this.initializeShell();
        // 自动检查更新
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
            const result = this.compareVersions(this.latestVersion, this.currentVersion);
            console.log(`版本比较: ${this.latestVersion} vs ${this.currentVersion} = ${result}`);
            return result > 0;
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

        // 格式化发布日期
        formattedPublishedDate(): string {
            if (!this.publishedAt) return '';
            try {
                const date = new Date(this.publishedAt);
                return date.toLocaleDateString('zh-CN');
            } catch (e) {
                return this.publishedAt;
            }
        },

        // API状态文本
        apiStatusText(): string {
            if (this.updateApiAvailable) return 'Update API可用';
            if (this.shellInitialized) return 'Shell备用方案';
            return '无可用更新方案';
        },

        apiStatusClass(): string {
            if (this.updateApiAvailable) return 'status-updated';
            if (this.shellInitialized) return 'status-checking';
            return 'status-error';
        },

        // 获取当前镜像处理后的URL
        processedUrl(): string {
            if (!this.downloadUrl) return '';
            
            if (this.useMirror && this.currentMirror.enabled) {
                if (this.currentMirror.urlPattern.includes('{url}')) {
                    return this.currentMirror.urlPattern.replace('{url}', this.downloadUrl);
                } else if (this.currentMirror.urlPattern.includes('{path}')) {
                    try {
                        const urlObj = new URL(this.downloadUrl);
                        const path = urlObj.pathname + urlObj.search;
                        return this.currentMirror.urlPattern.replace('{path}', path);
                    } catch (e) {
                        console.error('URL解析失败:', e);
                        return this.downloadUrl;
                    }
                }
            }
            return this.downloadUrl;
        },
    },

    methods: {
        // 初始化Update API
        async initializeUpdateAPI() {
            try {
                // 检查Update API是否可用
                if (typeof Update === 'undefined') {
                    console.warn('Update API 不可用');
                    this.updateApiAvailable = false;
                    return;
                }

                // 配置更新仓库
                const result = Update.setRepo({
                    owner: GITHUB_OWNER,
                    repo: GITHUB_REPO,
                    downloadPath: '/userdisk/downloads',
                    currentVersion: this.currentVersion,
                    filterPattern: `.*${this.deviceModel}.*\\.amr$` // 过滤设备型号对应的文件
                });

                console.log('Update API 初始化结果:', result);
                console.log('设备型号:', this.deviceModel);
                console.log('当前版本:', this.currentVersion);
                
                this.updateApiAvailable = true;
                this.updateInitialized = true;
                
                showInfo('Update API 初始化成功');
                
            } catch (error: any) {
                console.error('Update API 初始化失败:', error);
                this.updateApiAvailable = false;
                showError('Update API 初始化失败，将使用备用方案');
            }
        },

        // 初始化Shell
        async initializeShell() {
            try {
                // 检查Shell是否可用
                if (typeof Shell === 'undefined') {
                    console.warn('Shell模块不可用');
                    this.shellInitialized = false;
                    return;
                }

                await Shell.initialize();
                this.shellInitialized = true;
                console.log(`Shell初始化成功，设备型号: ${this.deviceModel}`);
            } catch (error: any) {
                console.error('Shell初始化失败:', error);
                this.shellInitialized = false;
            }
        },

        // 页面加载时自动检查更新
        async autoCheckUpdates() {
            // 等待初始化完成
            setTimeout(async () => {
                if (this.updateInitialized || this.shellInitialized) {
                    await this.checkForUpdates();
                } else {
                    console.log('更新模块未初始化，等待重试');
                    setTimeout(() => {
                        if (this.updateInitialized || this.shellInitialized) {
                            this.checkForUpdates();
                        } else {
                            this.status = 'error';
                            this.errorMessage = '更新模块初始化失败';
                            showError('无法检查更新');
                        }
                    }, 2000);
                }
            }, 1000);
        },

        // 检查更新
        async checkForUpdates() {
            this.status = 'checking';
            this.errorMessage = '';
            
            try {
                showLoading('正在检查更新...');
                
                console.log('检查更新...');
                console.log('设备型号:', this.deviceModel);
                console.log('当前版本:', this.currentVersion);
                console.log('使用镜像:', this.useMirror ? this.currentMirror.name : '无');
                
                // 优先使用Update API
                if (this.updateInitialized) {
                    await this.checkWithUpdateAPI();
                } 
                // 备用方案：使用Shell
                else if (this.shellInitialized) {
                    await this.checkWithShell();
                } else {
                    throw new Error('没有可用的更新模块');
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

        // 使用Update API检查更新
        async checkWithUpdateAPI() {
            console.log('使用Update API检查更新');
            
            // 构建API URL（考虑镜像源）
            let apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
            
            if (this.useMirror && this.currentMirror.apiPattern) {
                if (this.currentMirror.apiPattern.includes('{url}')) {
                    apiUrl = this.currentMirror.apiPattern.replace('{url}', apiUrl);
                } else if (this.currentMirror.apiPattern.includes('{path}')) {
                    const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                    apiUrl = this.currentMirror.apiPattern.replace('{path}', path);
                }
            }
            
            console.log('API URL:', apiUrl);
            
            // 使用Update API检查更新
            const result = await Update.check();
            
            console.log('Update API 检查结果:', result);
            
            if (result.success) {
                this.latestVersion = result.latestVersion || '';
                this.releaseNotes = result.releaseNotes || '';
                this.downloadUrl = result.downloadUrl || '';
                this.fileSize = result.downloadSize || 0;
                this.assetName = result.assetName || '';
                this.publishedAt = result.publishedAt || '';
                
                // 检查是否有新版本
                const hasUpdate = this.compareVersions(this.latestVersion, this.currentVersion) > 0;
                console.log(`Update API 判断是否有更新: ${hasUpdate} (${this.latestVersion} vs ${this.currentVersion})`);
                
                if (hasUpdate) {
                    this.status = 'available';
                    
                    // 验证下载文件是否匹配设备型号
                    if (this.assetName && this.assetName.includes(this.deviceModel)) {
                        console.log(`找到匹配 ${this.deviceModel} 型号的更新文件: ${this.assetName}`);
                        showInfo(`发现新版本 ${this.latestVersion} (${this.deviceModel})`);
                    } else if (this.assetName) {
                        console.warn(`警告: 文件 ${this.assetName} 可能不匹配设备型号 ${this.deviceModel}`);
                        showInfo(`发现新版本 ${this.latestVersion}，但文件可能不匹配当前设备`);
                    }
                } else {
                    this.status = 'updated';
                    showSuccess(`已是最新版本 v${this.currentVersion} (${this.deviceModel})`);
                }
            } else {
                throw new Error(result.error || '检查更新失败');
            }
        },

        // 使用Shell检查更新
        async checkWithShell() {
            console.log('使用Shell检查更新');
            
            // 构建API URL（考虑镜像源）
            let apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
            
            if (this.useMirror && this.currentMirror.apiPattern) {
                if (this.currentMirror.apiPattern.includes('{url}')) {
                    apiUrl = this.currentMirror.apiPattern.replace('{url}', apiUrl);
                } else if (this.currentMirror.apiPattern.includes('{path}')) {
                    const path = `repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
                    apiUrl = this.currentMirror.apiPattern.replace('{path}', path);
                }
            }
            
            console.log('API URL:', apiUrl);
            
            // 使用Shell curl命令获取GitHub API数据
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
                // 获取版本号（不移除v前缀，由比较函数处理）
                const tagVersion = data.tag_name;
                this.latestVersion = tagVersion;
                this.releaseNotes = data.body || '暂无更新说明';
                this.publishedAt = data.published_at || '';
                
                // 查找匹配设备型号的.amr文件
                if (data.assets && Array.isArray(data.assets)) {
                    console.log('可用的资源文件:', data.assets.map((a: any) => a.name));
                    
                    // 构建预期的文件名
                    const expectedFilename = `miniapp_${this.deviceModel}_v${tagVersion.replace(/^v/, '')}.amr`;
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
                            asset.name.includes(tagVersion.replace(/^v/, '')) &&
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
                        this.assetName = matchedAsset.name || '';
                        console.log(`找到匹配的文件: ${this.assetName}`);
                        
                        // 检查文件是否匹配当前设备型号
                        if (this.assetName.includes(this.deviceModel)) {
                            console.log(`文件匹配当前设备型号: ${this.deviceModel}`);
                        } else {
                            console.warn(`警告: 文件 ${this.assetName} 不匹配当前设备型号 ${this.deviceModel}`);
                        }
                    } else {
                        console.warn('未找到合适的.amr文件');
                        throw new Error(`未找到适用于 ${this.deviceModel} 型号的更新文件`);
                    }
                } else {
                    throw new Error('Release中没有找到资源文件');
                }
                
                // 检查是否有新版本
                const hasUpdate = this.compareVersions(this.latestVersion, this.currentVersion) > 0;
                console.log(`Shell 判断是否有更新: ${hasUpdate} (${this.latestVersion} vs ${this.currentVersion})`);
                
                if (hasUpdate) {
                    this.status = 'available';
                    showInfo(`发现新版本 ${this.latestVersion} (${this.deviceModel})`);
                } else {
                    this.status = 'updated';
                    showSuccess(`已是最新版本 v${this.currentVersion} (${this.deviceModel})`);
                }
            } else {
                throw new Error('无效的Release数据');
            }
        },

        // 比较版本号 - 修复版
        compareVersions(v1: string, v2: string): number {
            // 清理版本号字符串
            const cleanVersion = (version: string): string => {
                // 移除开头的v字符
                let cleaned = version.replace(/^v/i, '');
                // 移除所有非数字和点的字符
                cleaned = cleaned.replace(/[^0-9.]/g, '');
                // 确保版本号格式正确
                return cleaned;
            };
            
            const version1 = cleanVersion(v1).split('.').map(Number);
            const version2 = cleanVersion(v2).split('.').map(Number);
            
            console.log(`比较版本: ${v1} => ${version1}, ${v2} => ${version2}`);
            
            // 逐段比较版本号
            for (let i = 0; i < Math.max(version1.length, version2.length); i++) {
                const num1 = version1[i] || 0;
                const num2 = version2[i] || 0;
                
                console.log(`  第${i+1}段: ${num1} vs ${num2}`);
                
                if (num1 > num2) {
                    console.log(`  结果: ${v1} > ${v2} (${num1} > ${num2})`);
                    return 1;
                }
                if (num1 < num2) {
                    console.log(`  结果: ${v1} < ${v2} (${num1} < ${num2})`);
                    return -1;
                }
            }
            
            console.log('  结果: 版本相同');
            return 0;
        },

        // 下载更新
        async downloadUpdate() {
            if (!this.downloadUrl) {
                showError('没有可用的下载链接');
                return;
            }
            
            this.status = 'downloading';
            
            try {
                showLoading(`正在下载 ${this.deviceModel} 型号的更新...`);
                
                console.log('开始下载更新...');
                console.log('设备型号:', this.deviceModel);
                console.log('目标版本:', this.latestVersion);
                console.log('下载文件:', this.assetName);
                console.log('使用镜像:', this.useMirror ? this.currentMirror.name : '无');
                
                // 优先使用Update API
                if (this.updateInitialized) {
                    await this.downloadWithUpdateAPI();
                } 
                // 备用方案：使用Shell
                else if (this.shellInitialized) {
                    await this.downloadWithShell();
                } else {
                    throw new Error('没有可用的下载模块');
                }
                
            } catch (error: any) {
                console.error('下载失败:', error);
                this.status = 'error';
                this.errorMessage = error.message || '下载失败';
                showError(`下载失败: ${this.errorMessage}`);
                
                // 提供手动安装说明
                if (this.processedUrl) {
                    showInfo(`手动下载 ${this.deviceModel} 型号的更新: ${this.processedUrl}`);
                    showInfo(`下载后执行: miniapp_cli install 文件名.amr`);
                }
            } finally {
                hideLoading();
            }
        },

        // 使用Update API下载
        async downloadWithUpdateAPI() {
            console.log('使用Update API下载更新');
            
            // 使用Update API下载文件
            const result = await Update.download();
            
            console.log('Update API 下载结果:', result);
            
            if (result.success) {
                this.downloadPath = result.path || '';
                const actualFileSize = result.size || 0;
                
                console.log(`文件下载成功: ${this.downloadPath}`);
                console.log(`文件大小: ${actualFileSize} 字节`);
                
                // 验证文件大小
                if (actualFileSize > 0) {
                    if (this.fileSize > 0 && Math.abs(actualFileSize - this.fileSize) > 1024) {
                        console.warn(`文件大小不匹配: 预期 ${this.fileSize}, 实际 ${actualFileSize}`);
                    }
                    
                    showSuccess(`${this.deviceModel} 型号的更新下载完成，开始安装`);
                    await this.installUpdate();
                } else {
                    throw new Error('下载的文件为空');
                }
            } else {
                throw new Error(result.error || '下载失败');
            }
        },

        // 使用Shell下载
        async downloadWithShell() {
            console.log('使用Shell下载更新');
            
            // 设置下载路径，包含型号和版本信息
            const timestamp = Date.now();
            const cleanVersion = this.latestVersion.replace(/^v/i, '').replace(/[^0-9.]/g, '');
            this.downloadPath = `/userdisk/miniapp_${this.deviceModel}_v${cleanVersion}_${timestamp}.amr`;
            
            // 获取处理后的下载URL（考虑镜像源）
            const finalDownloadUrl = this.processedUrl;
            
            console.log('下载URL:', finalDownloadUrl);
            console.log('保存到:', this.downloadPath);
            
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
        },

        // 安装更新
        async installUpdate() {
            this.status = 'installing';
            
            try {
                showLoading(`正在安装 ${this.deviceModel} 型号的更新...`);
                
                console.log('开始安装更新...');
                console.log('设备型号:', this.deviceModel);
                console.log('安装文件:', this.downloadPath);
                
                // 使用Shell安装（Update API可能没有安装功能）
                if (typeof Shell !== 'undefined' && Shell.exec) {
                    // 执行安装命令
                    const installCmd = `miniapp_cli install "${this.downloadPath}"`;
                    console.log('执行安装命令:', installCmd);
                    
                    const result = await Shell.exec(installCmd);
                    console.log('安装结果:', result);
                    
                    // 安装完成后清理下载文件
                    await this.cleanupDownloadFiles();
                    
                    showSuccess(`${this.deviceModel} 型号的更新安装完成！请重启应用`);
                    this.status = 'updated';
                } else {
                    // 如果没有Shell API，提示手动安装
                    showInfo(`请手动安装 ${this.deviceModel} 型号的更新:`);
                    showInfo(`miniapp_cli install ${this.downloadPath}`);
                    this.status = 'available';
                }
                
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

        // 清理下载文件（只在安装完成后调用）
        async cleanupDownloadFiles() {
            try {
                console.log('安装完成，清理下载文件...');
                
                // 清理当前下载的文件
                if (this.downloadPath) {
                    if (typeof Shell !== 'undefined' && Shell.exec) {
                        const cleanupCmd = `rm -f "${this.downloadPath}" 2>/dev/null || true`;
                        await Shell.exec(cleanupCmd);
                        console.log(`清理文件: ${this.downloadPath}`);
                    }
                }
                
                // 清理旧的临时文件
                if (typeof Shell !== 'undefined' && Shell.exec) {
                    const oldCleanupCmd = 'rm -f /userdisk/miniapp_*_v*_*.amr 2>/dev/null || true';
                    await Shell.exec(oldCleanupCmd);
                    console.log('清理旧的临时文件');
                }
                
                // 尝试使用Update API清理更多文件
                if (typeof Update !== 'undefined' && Update.cleanup) {
                    const result = Update.cleanup(1); // 清理1天前的文件
                    console.log('Update API清理结果:', result);
                }
                
                console.log('文件清理完成');
            } catch (error) {
                console.warn('清理下载文件失败:', error);
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
                
                // 重新检查更新以应用新的镜像源
                if (this.latestVersion) {
                    this.checkForUpdates();
                }
            }
        },

        // 手动检查更新
        forceCheck() {
            this.checkForUpdates();
        },

        // 查看GitHub页面
        openGitHub() {
            const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
            showInfo(`请访问: ${url}`);
        },

        // 显示设备信息
        showDeviceInfo() {
            showInfo(`设备型号: ${this.deviceModel}\n当前版本: v${this.currentVersion}`);
        },

        // 获取配置信息
        async showConfigInfo() {
            try {
                let configInfo = [
                    `设备型号: ${this.deviceModel}`,
                    `当前版本: v${this.currentVersion}`,
                    `更新方案: ${this.updateApiAvailable ? 'Update API' : 'Shell备用'}`,
                    `镜像源: ${this.currentMirror.name}`,
                    `镜像状态: ${this.useMirror ? '已启用' : '已禁用'}`
                ];
                
                // 尝试获取Update API配置
                if (typeof Update !== 'undefined' && Update.getConfig) {
                    const config = await Update.getConfig();
                    configInfo.push(`仓库: ${config.owner}/${config.repo}`);
                    configInfo.push(`下载路径: ${config.downloadPath}`);
                }
                
                showInfo(configInfo.join('\n'));
            } catch (error) {
                console.error('获取配置失败:', error);
                showInfo(`设备型号: ${this.deviceModel}\n当前版本: v${this.currentVersion}`);
            }
        },

        // 测试镜像源连接
        async testMirrorConnection() {
            try {
                showLoading('正在测试镜像源连接...');
                
                const testUrl = this.currentMirror.testUrl;
                if (typeof Shell !== 'undefined' && Shell.exec) {
                    const testCmd = `curl -s -o /dev/null -w "%{http_code}" -k "${testUrl}" --connect-timeout 10`;
                    const result = await Shell.exec(testCmd);
                    
                    if (result.trim() === '200') {
                        showSuccess(`镜像源 ${this.currentMirror.name} 连接正常`);
                    } else {
                        showError(`镜像源 ${this.currentMirror.name} 连接失败，状态码: ${result}`);
                    }
                } else {
                    showError('无法测试镜像源连接');
                }
            } catch (error: any) {
                showError(`测试失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },

        // 查看当前下载URL
        showCurrentUrl() {
            if (this.processedUrl) {
                showInfo(`当前下载URL: ${this.processedUrl}`);
            } else {
                showInfo('暂无下载链接');
            }
        },
    }
});

export default update;
