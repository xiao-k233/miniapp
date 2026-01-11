import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

// 设备信息接口
interface DeviceInfo {
  ipAddress?: string;
  deviceId?: string;
  systemInfo?: {
    model?: string;
    version?: string;
    kernel?: string;
  };
  networkInfo?: {
    interfaces?: string;
    connections?: string;
  };
  storageInfo?: {
    total?: string;
    used?: string;
    free?: string;
  };
  batteryPercent?: string;
  slotInfo?: string;
  rootFilesystem?: {
    type?: string;
    mountOptions?: string;
    readWrite?: string;
  };
  timestamp?: number;
  error?: string;
}

// 命令配置
const COMMANDS = {
  // IP地址相关命令 - 简化版，直接提取IP
  IP_ADDRESS: {
    id: 'ip_address',
    name: 'IP地址',
    command: `ip addr show wlan0 2>/dev/null | awk '/inet / {split($2, a, "/"); print a[1]; exit}'`,
    parser: (output: string) => {
      const trimmed = output.trim();
      // 验证是否为IP地址格式
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
        return trimmed;
      }
      return '未获取到IP地址';
    }
  },
  
  // 设备ID相关命令
  DEVICE_ID: {
    id: 'device_id',
    name: '设备ID',
    command: 'cat /proc/sys/kernel/random/uuid || cat /etc/machine-id',
    parser: (output: string) => {
      const trimmed = output.trim();
      return trimmed && trimmed.length > 0 ? trimmed.substring(0, 32) : '未知';
    }
  },
  
  // 系统信息相关命令
  SYSTEM_INFO: {
    id: 'system_info',
    name: '系统信息',
    commands: [
      {
        id: 'model',
        name: '设备型号',
        command: 'uname -m',
        parser: (output: string) => output.trim() || '未知'
      },
      {
        id: 'version',
        name: '内核版本',
        command: 'uname -r',
        parser: (output: string) => output.trim() || '未知'
      },
      {
        id: 'kernel',
        name: '系统版本',
        command: 'uname -s',
        parser: (output: string) => output.trim() || '未知'
      }
    ]
  },
  
  // 存储信息相关命令
  STORAGE_INFO: {
    id: 'storage_info',
    name: '存储信息',
    command: 'df -h /',
    parser: (output: string) => {
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/).filter(Boolean);
        if (parts.length >= 6) {
          return {
            total: parts[1] || '未知',
            used: parts[2] || '未知',
            free: parts[3] || '未知'
          };
        } else if (parts.length >= 5) {
          return {
            total: parts[0] || '未知',
            used: parts[1] || '未知',
            free: parts[2] || '未知'
          };
        }
      }
      return { total: '格式错误', used: '格式错误', free: '格式错误' };
    }
  },
  
  // 电池电量相关命令
  BATTERY_PERCENT: {
    id: 'battery_percent',
    name: '电池电量',
    command: 'hal-battery',
    parser: (output: string) => {
      const match = output.match(/capacity:(\d+)/);
      return match ? `${match[1]}%` : '未找到容量信息';
    }
  },
  
  // 网络接口相关命令
  NETWORK_INFO: {
    id: 'network_info',
    name: '网络接口',
    command: 'ip -4 addr show',
    parser: (output: string) => output.trim() || '无网络接口信息'
  },
  
  // 槽位信息相关命令
  SLOT_INFO: {
    id: 'slot_info',
    name: '槽位信息',
    command: 'cat /proc/cmdline | sed -n "s/.*slot_suffix=\\(\\S*\\).*/\\1/p"',
    parser: (output: string) => {
      const trimmed = output.trim();
      return trimmed && trimmed.length > 0 ? trimmed : '未知';
    }
  },
  
  // 根文件系统信息相关命令 - 新增
  ROOT_FILESYSTEM: {
    id: 'root_filesystem',
    name: '根文件系统',
    // 使用awk提取根文件系统的类型和挂载选项
    command: 'mount | awk \'$3 == "/" {print $5, $6}\'',
    parser: (output: string) => {
      const trimmed = output.trim();
      if (trimmed) {
        const parts = trimmed.split(' ');
        const type = parts[0] || '未知';
        const mountOptions = parts[1] || '未知';
        
        // 提取rw/ro信息
        let readWrite = '未知';
        if (mountOptions.includes('rw')) {
          readWrite = '读写 (rw)';
        } else if (mountOptions.includes('ro')) {
          readWrite = '只读 (ro)';
        }
        
        return {
          type: type,
          mountOptions: mountOptions,
          readWrite: readWrite
        };
      }
      return { type: '未知', mountOptions: '未知', readWrite: '未知' };
    }
  }
};

// 日志管理器
const Logger = {
  log: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
  },
  
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ ${message}`, error || '');
  },
  
  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️ ${message}`, data || '');
  },
  
  success: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ ${message}`, data || '');
  }
};

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      isLoading: true,
      isRefreshing: false,
      shellInitialized: false,
      
      deviceInfo: {} as DeviceInfo,
      shellModule: null as any,
      
      // 执行日志
      executionLog: [] as Array<{
        id: string;
        name: string;
        command: string;
        output: string;
        result: any;
        success: boolean;
        timestamp: number;
      }>,
      
      // 错误详情
      errorDetails: ''
    };
  },

  mounted() {
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
    this.initializeAndLoad();
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  methods: {
    async initializeAndLoad() {
      this.isLoading = true;
      try {
        await this.initializeShell();
        await this.fetchDeviceInfo();
      } catch (error: any) {
        this.deviceInfo.error = `加载失败: ${error.message || '未知错误'}`;
        this.errorDetails = JSON.stringify(error, null, 2);
        Logger.error('initializeAndLoad error:', error);
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    
    async initializeShell() {
      Logger.log('开始初始化Shell模块');
      
      if (!Shell || typeof Shell.initialize !== 'function') {
        const error = 'Shell模块不可用';
        Logger.error('Shell模块检查失败', error);
        throw new Error(error);
      }
      
      try {
        Logger.log('调用Shell.initialize()');
        await Shell.initialize();
        this.shellModule = Shell;
        this.shellInitialized = true;
        Logger.success('Shell模块初始化成功');
        
        // 测试Shell是否可用
        Logger.log('测试Shell模块可用性');
        const testResult = await Shell.exec('echo "Shell test"');
        Logger.success('Shell测试命令执行成功', testResult.trim());
      } catch (error: any) {
        Logger.error('Shell模块初始化失败:', error);
        this.shellInitialized = false;
        this.shellModule = null;
        throw new Error(`Shell初始化失败: ${error.message || '未知错误'}`);
      }
    },
    
    async executeCommand(commandId: string, commandName: string, commandString: string) {
      const logEntry = {
        id: commandId,
        name: commandName,
        command: commandString,
        output: '',
        result: null as any,
        success: false,
        timestamp: Date.now()
      };
      
      try {
        Logger.log(`[${commandId}] 执行命令`, commandString);
        
        // 检查Shell状态
        if (!this.shellModule || !this.shellInitialized) {
          Logger.warn(`[${commandId}] Shell未初始化，尝试重新初始化`);
          await this.initializeShell();
        }
        
        const output = await Shell.exec(commandString);
        logEntry.output = output;
        logEntry.result = output.trim();
        logEntry.success = true;
        
        Logger.success(`[${commandId}] 命令执行成功`, output.trim());
      } catch (error: any) {
        logEntry.output = error.message || '命令执行失败';
        logEntry.result = null;
        logEntry.success = false;
        
        Logger.error(`[${commandId}] 命令执行失败`, {
          command: commandString,
          error: error.message,
          stack: error.stack
        });
        
        throw error;
      } finally {
        this.executionLog.push(logEntry);
      }
      
      return logEntry.output;
    },
    
    async fetchDeviceInfo() {
      Logger.log('开始获取设备信息');
      
      // 保存当前设备信息（用于失败时回滚）
      const previousInfo = { ...this.deviceInfo };
      
      try {
        // 检查Shell状态
        if (!this.shellInitialized || !this.shellModule) {
          Logger.warn('Shell未初始化，重新初始化');
          await this.initializeShell();
        }
        
        this.deviceInfo = { timestamp: Date.now() };
        this.executionLog = [];
        
        // IP地址
        try {
          const ipOutput = await this.executeCommand(
            COMMANDS.IP_ADDRESS.id,
            COMMANDS.IP_ADDRESS.name,
            COMMANDS.IP_ADDRESS.command
          );
          this.deviceInfo.ipAddress = COMMANDS.IP_ADDRESS.parser(ipOutput);
          Logger.success(`[${COMMANDS.IP_ADDRESS.id}] 解析成功`, this.deviceInfo.ipAddress);
        } catch (error) {
          this.deviceInfo.ipAddress = '获取失败';
          Logger.error(`[${COMMANDS.IP_ADDRESS.id}] 获取失败，使用默认值`);
        }
        
        // 设备ID
        try {
          const deviceIdOutput = await this.executeCommand(
            COMMANDS.DEVICE_ID.id,
            COMMANDS.DEVICE_ID.name,
            COMMANDS.DEVICE_ID.command
          );
          this.deviceInfo.deviceId = COMMANDS.DEVICE_ID.parser(deviceIdOutput);
          Logger.success(`[${COMMANDS.DEVICE_ID.id}] 解析成功`, this.deviceInfo.deviceId);
        } catch (error) {
          this.deviceInfo.deviceId = '获取失败';
          Logger.error(`[${COMMANDS.DEVICE_ID.id}] 获取失败，使用默认值`);
        }
        
        // 系统信息
        try {
          this.deviceInfo.systemInfo = {
            model: '未知',
            version: '未知',
            kernel: '未知'
          };
          
          for (const cmd of COMMANDS.SYSTEM_INFO.commands) {
            try {
              const output = await this.executeCommand(
                `${COMMANDS.SYSTEM_INFO.id}_${cmd.id}`,
                cmd.name,
                cmd.command
              );
              const result = cmd.parser(output);
              
              if (cmd.id === 'model') this.deviceInfo.systemInfo.model = result;
              else if (cmd.id === 'version') this.deviceInfo.systemInfo.version = result;
              else if (cmd.id === 'kernel') this.deviceInfo.systemInfo.kernel = result;
              
              Logger.success(`[${COMMANDS.SYSTEM_INFO.id}_${cmd.id}] 解析成功`, result);
            } catch (error) {
              Logger.error(`[${COMMANDS.SYSTEM_INFO.id}_${cmd.id}] 获取失败，使用默认值`);
            }
          }
        } catch (error) {
          this.deviceInfo.systemInfo = { model: '获取失败', version: '获取失败', kernel: '获取失败' };
          Logger.error(`[${COMMANDS.SYSTEM_INFO.id}] 整体获取失败`);
        }
        
        // 存储信息
        try {
          const storageOutput = await this.executeCommand(
            COMMANDS.STORAGE_INFO.id,
            COMMANDS.STORAGE_INFO.name,
            COMMANDS.STORAGE_INFO.command
          );
          this.deviceInfo.storageInfo = COMMANDS.STORAGE_INFO.parser(storageOutput);
          Logger.success(`[${COMMANDS.STORAGE_INFO.id}] 解析成功`, this.deviceInfo.storageInfo);
        } catch (error) {
          this.deviceInfo.storageInfo = { total: '获取失败', used: '获取失败', free: '获取失败' };
          Logger.error(`[${COMMANDS.STORAGE_INFO.id}] 获取失败，使用默认值`);
        }
        
        // 电池电量
        try {
          const batteryOutput = await this.executeCommand(
            COMMANDS.BATTERY_PERCENT.id,
            COMMANDS.BATTERY_PERCENT.name,
            COMMANDS.BATTERY_PERCENT.command
          );
          this.deviceInfo.batteryPercent = COMMANDS.BATTERY_PERCENT.parser(batteryOutput);
          Logger.success(`[${COMMANDS.BATTERY_PERCENT.id}] 解析成功`, this.deviceInfo.batteryPercent);
        } catch (error) {
          this.deviceInfo.batteryPercent = '获取失败';
          Logger.error(`[${COMMANDS.BATTERY_PERCENT.id}] 获取失败，使用默认值`);
        }
        
        // 网络接口
        try {
          const networkOutput = await this.executeCommand(
            COMMANDS.NETWORK_INFO.id,
            COMMANDS.NETWORK_INFO.name,
            COMMANDS.NETWORK_INFO.command
          );
          this.deviceInfo.networkInfo = {
            interfaces: COMMANDS.NETWORK_INFO.parser(networkOutput)
          };
          Logger.success(`[${COMMANDS.NETWORK_INFO.id}] 解析成功`, this.deviceInfo.networkInfo);
        } catch (error) {
          this.deviceInfo.networkInfo = { interfaces: '获取失败' };
          Logger.error(`[${COMMANDS.NETWORK_INFO.id}] 获取失败，使用默认值`);
        }
        
        // 槽位信息
        try {
          const slotOutput = await this.executeCommand(
            COMMANDS.SLOT_INFO.id,
            COMMANDS.SLOT_INFO.name,
            COMMANDS.SLOT_INFO.command
          );
          this.deviceInfo.slotInfo = COMMANDS.SLOT_INFO.parser(slotOutput);
          Logger.success(`[${COMMANDS.SLOT_INFO.id}] 解析成功`, this.deviceInfo.slotInfo);
        } catch (error) {
          this.deviceInfo.slotInfo = '获取失败';
          Logger.error(`[${COMMANDS.SLOT_INFO.id}] 获取失败，使用默认值`);
        }
        
        // 根文件系统信息 - 新增
        try {
          const rootFsOutput = await this.executeCommand(
            COMMANDS.ROOT_FILESYSTEM.id,
            COMMANDS.ROOT_FILESYSTEM.name,
            COMMANDS.ROOT_FILESYSTEM.command
          );
          this.deviceInfo.rootFilesystem = COMMANDS.ROOT_FILESYSTEM.parser(rootFsOutput);
          Logger.success(`[${COMMANDS.ROOT_FILESYSTEM.id}] 解析成功`, this.deviceInfo.rootFilesystem);
        } catch (error) {
          this.deviceInfo.rootFilesystem = { type: '获取失败', mountOptions: '获取失败', readWrite: '获取失败' };
          Logger.error(`[${COMMANDS.ROOT_FILESYSTEM.id}] 获取失败，使用默认值`);
        }
        
        // 完成
        this.deviceInfo.timestamp = Date.now();
        this.deviceInfo.error = undefined;
        Logger.success('设备信息获取完成', {
          ipAddress: this.deviceInfo.ipAddress,
          deviceId: this.deviceInfo.deviceId,
          batteryPercent: this.deviceInfo.batteryPercent,
          slotInfo: this.deviceInfo.slotInfo,
          rootFilesystem: this.deviceInfo.rootFilesystem,
          timestamp: new Date(this.deviceInfo.timestamp).toLocaleString()
        });
        
        // 输出执行日志摘要
        const successCount = this.executionLog.filter(log => log.success).length;
        const totalCount = this.executionLog.length;
        Logger.log(`执行摘要: ${successCount}/${totalCount} 个命令成功`);
        
      } catch (error: any) {
        // 回滚到之前的状态
        this.deviceInfo = { ...previousInfo, error: `刷新失败: ${error.message || '未知错误'}` };
        this.errorDetails = JSON.stringify({
          message: error.message,
          stack: error.stack,
          executionLog: this.executionLog
        }, null, 2);
        Logger.error('获取设备信息整体失败', error);
      }
    },
    
    async refreshInfo() {
      if (this.isRefreshing) {
        Logger.warn('刷新操作正在进行中，忽略重复点击');
        return;
      }
      
      Logger.log('用户点击刷新按钮，开始刷新设备信息');
      this.isRefreshing = true;
      
      try {
        await this.fetchDeviceInfo();
        Logger.success('刷新操作成功完成');
      } catch (error: any) {
        Logger.error('刷新操作失败', error);
        // 错误信息已经在fetchDeviceInfo中设置
      } finally {
        this.isRefreshing = false;
        Logger.log('刷新操作结束');
      }
    },
    
    handleBackPress() {
      Logger.log('用户点击返回按钮');
      this.$page.finish();
    },
    
    formatIP(ip?: string) {
      return ip || '未获取到';
    },
    
    // 调试方法：获取执行日志
    getExecutionLog() {
      return this.executionLog;
    },
    
    // 调试方法：获取错误详情
    getErrorDetails() {
      return this.errorDetails;
    }
  }
});