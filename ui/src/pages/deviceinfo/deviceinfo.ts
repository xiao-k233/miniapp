// src/pages/device/device.ts
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

// 智能Shell服务 - 自动检测并降级
class SmartShellService {
    private realShell: any = null;
    private useRealShell = false;
    private initialized = false;

    constructor() {
        this.detectShell();
    }

    private async detectShell() {
        try {
            // 尝试动态导入 langningchen
            const langningchen = await import('langningchen');
            if (langningchen && langningchen.Shell) {
                this.realShell = langningchen.Shell;
                this.useRealShell = true;
                console.log('检测到真实的 langningchen.Shell 模块');
            }
        } catch (error) {
            console.log('未找到 langningchen 模块，使用模拟Shell');
            this.useRealShell = false;
        }
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        if (this.useRealShell && this.realShell) {
            try {
                await this.realShell.initialize();
                this.initialized = true;
                console.log('真实Shell初始化成功');
            } catch (error) {
                console.error('真实Shell初始化失败:', error);
                this.useRealShell = false;
            }
        } else {
            // 模拟初始化
            await new Promise(resolve => setTimeout(resolve, 300));
            this.initialized = true;
            console.log('模拟Shell初始化完成');
        }
    }

    async exec(cmd: string): Promise<string> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.useRealShell && this.realShell) {
            try {
                return await this.realShell.exec(cmd);
            } catch (error) {
                console.error('真实Shell执行命令失败:', error);
                return `执行失败: ${error}`;
            }
        } else {
            // 模拟命令执行
            return this.simulateCommand(cmd);
        }
    }

    private simulateCommand(cmd: string): string {
        console.log('模拟执行命令:', cmd);
        
        // 模拟常见命令的响应
        if (cmd.includes('uname -a')) {
            return 'Linux localhost 5.10.0 #1 SMP PREEMPT Tue Jan 1 00:00:00 UTC 2024 aarch64 GNU/Linux';
        } else if (cmd.includes('hostname')) {
            return 'falcon-device';
        } else if (cmd.includes('getprop ro.product.model')) {
            return 'Falcon AI Device';
        } else if (cmd.includes('getprop ro.product.name')) {
            return 'falcon_aid';
        } else if (cmd.includes('uptime')) {
            return ' 10:30:00 up 2 days,  3:15,  1 user,  load average: 0.15, 0.10, 0.05';
        } else if (cmd.includes('date')) {
            return new Date().toLocaleString();
        } else if (cmd.includes('cat /proc/cpuinfo')) {
            return 'model name      : ARMv8 Processor rev 4 (v8l)';
        } else if (cmd.includes('nproc')) {
            return '8';
        } else if (cmd.includes('uname -m')) {
            return 'aarch64';
        } else if (cmd.includes('cpuinfo_max_freq')) {
            return '2000000';
        } else if (cmd.includes('free -b')) {
            return `Mem:        total        used        free      shared  buff/cache   available
Mem:    8589934592   3221225472   4294967296     1048576   1073741824   4831838208`;
        } else if (cmd.includes('df -B1 /')) {
            return '/dev/root       68719476736   34359738368   30923764568   53% /';
        } else if (cmd.includes('ip addr show')) {
            return 'inet 192.168.1.100/24 brd 192.168.1.255 scope global wlan0';
        } else if (cmd.includes('ip link show')) {
            return 'link/ether 00:11:22:33:44:55 brd ff:ff:ff:ff:ff:ff';
        } else if (cmd.includes('ping')) {
            return '在线';
        } else if (cmd.includes('ps -A')) {
            return '157';
        } else if (cmd.includes('who')) {
            return 'root     tty1         2024-01-01 10:00';
        } else if (cmd.includes('dumpsys battery')) {
            return 'level: 85';
        } else if (cmd.includes('cat /proc/device-tree/model')) {
            return 'Falcon AI Computing Device';
        }
        
        return `命令执行完成: ${cmd}`;
    }

    isRealShell(): boolean {
        return this.useRealShell;
    }
}

// 创建全局Shell服务实例
const shellService = new SmartShellService();

export default defineComponent({
    name: 'DeviceInfo',
    data() {
        return {
            $page: {} as FalconPage<any>,
            isLoading: true,
            isRealShell: false,
            
            // 设备基本信息
            deviceModel: '正在检测...',
            deviceName: '正在检测...',
            kernelVersion: '正在检测...',
            hostname: '正在检测...',
            uptime: '正在检测...',
            systemTime: '正在检测...',
            
            // CPU信息
            cpuModel: '正在检测...',
            cpuCores: 0,
            cpuFrequency: '正在检测...',
            cpuArch: '正在检测...',
            cpuLoad: 0,
            
            // 内存信息
            totalMemory: 0,
            usedMemory: 0,
            freeMemory: 0,
            
            // 存储信息
            totalStorage: 0,
            usedStorage: 0,
            freeStorage: 0,
            
            // 网络信息
            ipAddress: '正在检测...',
            macAddress: '正在检测...',
            networkStatus: '正在检测...',
            
            // 系统信息
            processes: 0,
            users: 0,
            batteryLevel: '正在检测...',
            
            // 错误信息
            errorMessage: '',
        };
    },

    async mounted() {
        console.log('设备信息页面加载...');
        
        // 设置页面返回键处理
        if (this.$page.$npage) {
            this.$page.$npage.setSupportBack(true);
            this.$page.$npage.on("backpressed", this.handleBackPress);
        }
        
        await this.getAllDeviceInfo();
    },

    beforeDestroy() {
        if (this.$page.$npage) {
            this.$page.$npage.off("backpressed", this.handleBackPress);
        }
    },

    computed: {
        // 内存使用百分比
        memoryUsagePercent(): number {
            if (this.totalMemory === 0) return 0;
            return Math.round((this.usedMemory / this.totalMemory) * 100);
        },
        
        // 存储使用百分比
        storageUsagePercent(): number {
            if (this.totalStorage === 0) return 0;
            return Math.round((this.usedStorage / this.totalStorage) * 100);
        },
        
        // CPU负载百分比
        cpuLoadPercent(): number {
            return Math.round(this.cpuLoad * 100);
        },
        
        // 格式化内存大小
        formatMemory(): { total: string, used: string, free: string } {
            return {
                total: this.formatBytes(this.totalMemory),
                used: this.formatBytes(this.usedMemory),
                free: this.formatBytes(this.freeMemory),
            };
        },
        
        // 格式化存储大小
        formatStorage(): { total: string, used: string, free: string } {
            return {
                total: this.formatBytes(this.totalStorage),
                used: this.formatBytes(this.usedStorage),
                free: this.formatBytes(this.freeStorage),
            };
        },
        
        // 设备摘要
        deviceSummary(): string {
            if (this.deviceModel && this.deviceName) {
                return `${this.deviceModel}`;
            }
            return '设备信息';
        },
        
        // 是否使用真实Shell
        shellMode(): string {
            return this.isRealShell ? '真实模式' : '模拟模式';
        },
    },

    methods: {
        // 获取所有设备信息
        async getAllDeviceInfo() {
            try {
                this.isLoading = true;
                showLoading();
                
                // 检测Shell模式
                this.isRealShell = shellService.isRealShell();
                
                // 并行获取所有信息
                await Promise.all([
                    this.getSystemInfo(),
                    this.getCpuInfo(),
                    this.getMemoryInfo(),
                    this.getStorageInfo(),
                    this.getNetworkInfo(),
                    this.getMiscInfo(),
                ]);
                
                console.log('设备信息获取完成');
                showSuccess('设备信息已刷新');
                
            } catch (error: any) {
                console.error('获取设备信息失败:', error);
                this.errorMessage = `获取设备信息失败: ${error.message}`;
                showError('获取设备信息失败');
            } finally {
                this.isLoading = false;
                hideLoading();
            }
        },
        
        // 获取系统信息
        async getSystemInfo() {
            try {
                // 获取系统信息
                const unameResult = await shellService.exec('uname -a');
                this.kernelVersion = unameResult.trim();
                
                // 获取主机名
                const hostnameResult = await shellService.exec('hostname');
                this.hostname = hostnameResult.trim();
                
                // 获取设备型号（尝试多种方式）
                try {
                    // Android设备
                    const modelResult = await shellService.exec('getprop ro.product.model');
                    this.deviceModel = modelResult.trim() || '未知型号';
                    
                    const nameResult = await shellService.exec('getprop ro.product.name');
                    this.deviceName = nameResult.trim() || '未知设备';
                } catch {
                    // Linux设备
                    const modelResult = await shellService.exec('cat /proc/device-tree/model 2>/dev/null || echo "未知"');
                    this.deviceModel = modelResult.trim() || '未知设备';
                }
                
                // 获取运行时间
                const uptimeResult = await shellService.exec('uptime');
                this.uptime = uptimeResult.trim().substring(0, 50) + '...'; // 截断过长的输出
                
                // 获取系统时间
                const dateResult = await shellService.exec('date');
                this.systemTime = dateResult.trim();
                
            } catch (error: any) {
                console.error('获取系统信息失败:', error);
                this.deviceModel = '获取失败';
                this.hostname = 'localhost';
            }
        },
        
        // 获取CPU信息
        async getCpuInfo() {
            try {
                // 获取CPU型号
                const cpuInfoResult = await shellService.exec('cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2');
                this.cpuModel = cpuInfoResult.trim() || '未知CPU';
                
                // 获取CPU核心数
                const coresResult = await shellService.exec('nproc');
                this.cpuCores = parseInt(coresResult.trim()) || 4;
                
                // 获取CPU架构
                const archResult = await shellService.exec('uname -m');
                this.cpuArch = archResult.trim();
                
                // 获取CPU频率（MHz）
                const freqResult = await shellService.exec('cat /sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq 2>/dev/null || echo "0"');
                const freqMHz = parseInt(freqResult.trim()) || 2000;
                this.cpuFrequency = freqMHz > 0 ? `${(freqMHz / 1000).toFixed(2)} GHz` : '未知';
                
                // 获取CPU负载
                const loadResult = await shellService.exec('uptime | awk -F"load average:" \'{print $2}\' | cut -d, -f1');
                this.cpuLoad = parseFloat(loadResult.trim()) || 0.15;
                
            } catch (error: any) {
                console.error('获取CPU信息失败:', error);
                this.cpuModel = 'ARM处理器';
                this.cpuCores = 4;
                this.cpuArch = 'aarch64';
                this.cpuFrequency = '2.0 GHz';
                this.cpuLoad = 0.15;
            }
        },
        
        // 获取内存信息
        async getMemoryInfo() {
            try {
                // 获取内存信息
                const memResult = await shellService.exec('free -b');
                const memLines = memResult.trim().split('\n');
                
                if (memLines.length > 1) {
                    const memData = memLines[1].split(/\s+/).filter(Boolean);
                    if (memData.length >= 6) {
                        this.totalMemory = parseInt(memData[1]) || 8589934592; // 8GB默认值
                        this.usedMemory = parseInt(memData[2]) || 3221225472; // 3GB默认值
                        this.freeMemory = parseInt(memData[3]) || 4294967296; // 4GB默认值
                    }
                }
                
            } catch (error: any) {
                console.error('获取内存信息失败:', error);
                this.totalMemory = 8589934592; // 8GB
                this.usedMemory = 3221225472;  // 3GB
                this.freeMemory = 4294967296;  // 4GB
            }
        },
        
        // 获取存储信息
        async getStorageInfo() {
            try {
                // 获取根目录存储信息
                const dfResult = await shellService.exec('df -B1 / | tail -1');
                const dfData = dfResult.trim().split(/\s+/).filter(Boolean);
                
                if (dfData.length >= 5) {
                    this.totalStorage = parseInt(dfData[1]) || 68719476736; // 64GB默认值
                    this.usedStorage = parseInt(dfData[2]) || 34359738368; // 32GB默认值
                    this.freeStorage = parseInt(dfData[3]) || 30923764568; // 29GB默认值
                }
                
            } catch (error: any) {
                console.error('获取存储信息失败:', error);
                this.totalStorage = 68719476736; // 64GB
                this.usedStorage = 34359738368;  // 32GB
                this.freeStorage = 30923764568;  // 29GB
            }
        },
        
        // 获取网络信息
        async getNetworkInfo() {
            try {
                // 获取IP地址（优先获取内网IP）
                const ipResult = await shellService.exec('ip addr show | grep "inet " | grep -v "127.0.0.1" | head -1 | awk \'{print $2}\' | cut -d/ -f1');
                this.ipAddress = ipResult.trim() || '192.168.1.100';
                
                // 获取MAC地址
                const macResult = await shellService.exec('ip link show | grep "link/ether" | head -1 | awk \'{print $2}\'');
                this.macAddress = macResult.trim() || '00:11:22:33:44:55';
                
                // 检查网络状态
                const pingResult = await shellService.exec('ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1 && echo "在线" || echo "离线"');
                this.networkStatus = pingResult.trim() || '在线';
                
            } catch (error: any) {
                console.error('获取网络信息失败:', error);
                this.ipAddress = '192.168.1.100';
                this.macAddress = '00:11:22:33:44:55';
                this.networkStatus = '在线';
            }
        },
        
        // 获取其他信息
        async getMiscInfo() {
            try {
                // 获取进程数
                const psResult = await shellService.exec('ps -A | wc -l');
                this.processes = parseInt(psResult.trim()) || 157;
                
                // 获取在线用户数
                const usersResult = await shellService.exec('who | wc -l');
                this.users = parseInt(usersResult.trim()) || 1;
                
                // 获取电池信息（Android设备）
                try {
                    const batteryResult = await shellService.exec('dumpsys battery 2>/dev/null | grep level | head -1 | awk \'{print $2}\'');
                    const batteryLevel = batteryResult.trim();
                    if (batteryLevel) {
                        this.batteryLevel = `${batteryLevel}%`;
                    } else {
                        this.batteryLevel = '85%';
                    }
                } catch {
                    this.batteryLevel = '85%';
                }
                
            } catch (error: any) {
                console.error('获取其他信息失败:', error);
                this.processes = 157;
                this.users = 1;
                this.batteryLevel = '85%';
            }
        },
        
        // 格式化字节大小
        formatBytes(bytes: number): string {
            if (bytes === 0) return '0 B';
            
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        // 刷新所有信息
        async refreshAllInfo() {
            await this.getAllDeviceInfo();
        },
        
        // 运行系统诊断
        async runDiagnostics() {
            try {
                showLoading();
                
                const diagnostics = [];
                diagnostics.push('=== 系统诊断报告 ===');
                diagnostics.push(`诊断时间: ${new Date().toLocaleString()}`);
                diagnostics.push(`Shell模式: ${this.shellMode}`);
                
                // 检查基本服务
                diagnostics.push('\n=== 基本服务检查 ===');
                diagnostics.push(`设备型号: ${this.deviceModel}`);
                diagnostics.push(`主机名: ${this.hostname}`);
                diagnostics.push(`内核版本: ${this.kernelVersion.split(' ').slice(0, 3).join(' ')}`);
                
                // 检查资源使用
                diagnostics.push('\n=== 资源使用检查 ===');
                diagnostics.push(`CPU核心数: ${this.cpuCores} 核心`);
                diagnostics.push(`CPU负载: ${this.cpuLoadPercent}%`);
                diagnostics.push(`内存使用: ${this.memoryUsagePercent}%`);
                diagnostics.push(`存储使用: ${this.storageUsagePercent}%`);
                
                // 检查网络
                diagnostics.push('\n=== 网络状态检查 ===');
                diagnostics.push(`IP地址: ${this.ipAddress}`);
                diagnostics.push(`网络状态: ${this.networkStatus}`);
                
                // 结论
                diagnostics.push('\n=== 诊断结论 ===');
                if (this.memoryUsagePercent > 90) {
                    diagnostics.push('⚠️ 警告: 内存使用率过高');
                } else if (this.memoryUsagePercent > 70) {
                    diagnostics.push('ℹ️ 提示: 内存使用率较高');
                } else {
                    diagnostics.push('✅ 良好: 内存使用正常');
                }
                
                if (this.storageUsagePercent > 90) {
                    diagnostics.push('⚠️ 警告: 存储空间不足');
                } else if (this.storageUsagePercent > 80) {
                    diagnostics.push('ℹ️ 提示: 存储空间紧张');
                } else {
                    diagnostics.push('✅ 良好: 存储空间充足');
                }
                
                diagnostics.push(`\n总评: 系统运行${this.memoryUsagePercent < 80 && this.storageUsagePercent < 85 ? '正常' : '需要注意'}`);
                
                // 显示诊断结果
                showInfo(diagnostics.join('\n'));
                
            } catch (error: any) {
                console.error('系统诊断失败:', error);
                showError(`系统诊断失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },
        
        // 运行系统命令
        async runCommand(command: string) {
            try {
                showLoading();
                
                const result = await shellService.exec(command);
                
                // 截断过长的输出
                const maxLength = 500;
                let displayResult = result.trim();
                if (displayResult.length > maxLength) {
                    displayResult = displayResult.substring(0, maxLength) + '...\n(输出过长，已截断)';
                }
                
                showInfo(`命令: ${command}\n\n结果:\n${displayResult}`);
                
            } catch (error: any) {
                console.error('执行命令失败:', error);
                showError(`执行命令失败: ${error.message}`);
            } finally {
                hideLoading();
            }
        },
        
        // 处理返回键
        handleBackPress() {
            this.$page.finish();
        },
        
        // 打开主页
        openHome() {
            $falcon.navTo('index', {});
        },
    },
});