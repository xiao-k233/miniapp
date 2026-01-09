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
  timestamp?: number;
  error?: string;
}

// 命令配置
const COMMANDS = {
  // IP地址相关命令
  IP_ADDRESS: {
    id: 'ip_address',
    name: 'IP地址',
    command: 'ip addr show wlan0 2>/dev/null | grep -m1 "inet " | awk "{print $2}" | cut -d/ -f1',
    parser: (output: string) => output.trim() || '未获取到IP地址'
  },
  
  // 设备ID相关命令
  DEVICE_ID: {
    id: 'device_id',
    name: '设备ID',
    command: 'cat /proc/sys/kernel/random/uuid || cat /etc/machine-id',
    parser: (output: string) => output.trim().substring(0, 32) || '未知'
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
  }
};

// 日志管理器
const Logger = {
  logStart: (moduleName: string) => {
    console.log(`===== 开始获取 ${moduleName} =====`);
  },
  
  logCommand: (commandId: string, commandName: string, command: string) => {
    console.log(`[${commandId}] ${commandName} - 执行命令: ${command}`);
  },
  
  logOutput: (commandId: string, output: string) => {
    console.log(`[${commandId}] 命令输出: ${JSON.stringify(output)}`);
  },
  
  logResult: (commandId: string, result: any) => {
    console.log(`[${commandId}] 处理结果: ${JSON.stringify(result)}`);
  },
  
  logSuccess: (commandId: string, message: string) => {
    console.log(`✅ [${commandId}] ${message}`);
  },
  
  logError: (commandId: string, error: any) => {
    console.error(`❌ [${commandId}] 错误:`, error);
  },
  
  logComplete: (moduleName: string) => {
    console.log(`===== ${moduleName} 获取完成 =====\n`);
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
      }>
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
        console.error('initializeAndLoad error:', error);
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    
    async initializeShell() {
      Logger.logStart('Shell模块');
      if (!Shell || typeof Shell.initialize !== 'function') {
        throw new Error('Shell模块不可用');
      }
      try {
        await Shell.initialize();
        this.shellModule = Shell;
        this.shellInitialized = true;
        Logger.logSuccess('shell_init', 'Shell模块初始化成功');
      } catch (error) {
        Logger.logError('shell_init', error);
        throw error;
      } finally {
        Logger.logComplete('Shell模块');
      }
    },
    
    async executeCommand(commandId: string, commandName: string, commandString: string) {
      try {
        Logger.logCommand(commandId, commandName, commandString);
        const output = await Shell.exec(commandString);
        Logger.logOutput(commandId, output);
        
        // 记录到执行日志
        this.executionLog.push({
          id: commandId,
          name: commandName,
          command: commandString,
          output,
          result: output.trim(),
          success: true,
          timestamp: Date.now()
        });
        
        return output;
      } catch (error) {
        Logger.logError(commandId, error);
        
        // 记录错误到执行日志
        this.executionLog.push({
          id: commandId,
          name: commandName,
          command: commandString,
          output: error.message || '命令执行失败',
          result: null,
          success: false,
          timestamp: Date.now()
        });
        
        throw error;
      }
    },
    
    async fetchDeviceInfo() {
      Logger.logStart('设备信息');
      
      if (!this.shellInitialized) {
        throw new Error('Shell未初始化');
      }

      this.deviceInfo = { timestamp: Date.now() };
      this.executionLog = []; // 清空执行日志

      // IP地址
      try {
        Logger.logStart(COMMANDS.IP_ADDRESS.name);
        const ipOutput = await this.executeCommand(
          COMMANDS.IP_ADDRESS.id,
          COMMANDS.IP_ADDRESS.name,
          COMMANDS.IP_ADDRESS.command
        );
        this.deviceInfo.ipAddress = COMMANDS.IP_ADDRESS.parser(ipOutput);
        Logger.logResult(COMMANDS.IP_ADDRESS.id, this.deviceInfo.ipAddress);
        Logger.logSuccess(COMMANDS.IP_ADDRESS.id, '获取成功');
      } catch (error) {
        this.deviceInfo.ipAddress = '获取失败';
        Logger.logError(COMMANDS.IP_ADDRESS.id, error);
      } finally {
        Logger.logComplete(COMMANDS.IP_ADDRESS.name);
      }

      // 设备ID
      try {
        Logger.logStart(COMMANDS.DEVICE_ID.name);
        const deviceIdOutput = await this.executeCommand(
          COMMANDS.DEVICE_ID.id,
          COMMANDS.DEVICE_ID.name,
          COMMANDS.DEVICE_ID.command
        );
        this.deviceInfo.deviceId = COMMANDS.DEVICE_ID.parser(deviceIdOutput);
        Logger.logResult(COMMANDS.DEVICE_ID.id, this.deviceInfo.deviceId);
        Logger.logSuccess(COMMANDS.DEVICE_ID.id, '获取成功');
      } catch (error) {
        this.deviceInfo.deviceId = '获取失败';
        Logger.logError(COMMANDS.DEVICE_ID.id, error);
      } finally {
        Logger.logComplete(COMMANDS.DEVICE_ID.name);
      }

      // 系统信息
      try {
        Logger.logStart(COMMANDS.SYSTEM_INFO.name);
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
            
            Logger.logResult(`${COMMANDS.SYSTEM_INFO.id}_${cmd.id}`, result);
            Logger.logSuccess(`${COMMANDS.SYSTEM_INFO.id}_${cmd.id}`, '获取成功');
          } catch (error) {
            Logger.logError(`${COMMANDS.SYSTEM_INFO.id}_${cmd.id}`, error);
          }
        }
        
        Logger.logResult(COMMANDS.SYSTEM_INFO.id, this.deviceInfo.systemInfo);
        Logger.logSuccess(COMMANDS.SYSTEM_INFO.id, '获取完成');
      } catch (error) {
        this.deviceInfo.systemInfo = { model: '获取失败', version: '获取失败', kernel: '获取失败' };
        Logger.logError(COMMANDS.SYSTEM_INFO.id, error);
      } finally {
        Logger.logComplete(COMMANDS.SYSTEM_INFO.name);
      }

      // 存储信息
      try {
        Logger.logStart(COMMANDS.STORAGE_INFO.name);
        const storageOutput = await this.executeCommand(
          COMMANDS.STORAGE_INFO.id,
          COMMANDS.STORAGE_INFO.name,
          COMMANDS.STORAGE_INFO.command
        );
        this.deviceInfo.storageInfo = COMMANDS.STORAGE_INFO.parser(storageOutput);
        Logger.logResult(COMMANDS.STORAGE_INFO.id, this.deviceInfo.storageInfo);
        Logger.logSuccess(COMMANDS.STORAGE_INFO.id, '获取成功');
      } catch (error) {
        this.deviceInfo.storageInfo = { total: '获取失败', used: '获取失败', free: '获取失败' };
        Logger.logError(COMMANDS.STORAGE_INFO.id, error);
      } finally {
        Logger.logComplete(COMMANDS.STORAGE_INFO.name);
      }

      // 电池电量
      try {
        Logger.logStart(COMMANDS.BATTERY_PERCENT.name);
        const batteryOutput = await this.executeCommand(
          COMMANDS.BATTERY_PERCENT.id,
          COMMANDS.BATTERY_PERCENT.name,
          COMMANDS.BATTERY_PERCENT.command
        );
        this.deviceInfo.batteryPercent = COMMANDS.BATTERY_PERCENT.parser(batteryOutput);
        Logger.logResult(COMMANDS.BATTERY_PERCENT.id, this.deviceInfo.batteryPercent);
        Logger.logSuccess(COMMANDS.BATTERY_PERCENT.id, '获取成功');
      } catch (error) {
        this.deviceInfo.batteryPercent = '获取失败';
        Logger.logError(COMMANDS.BATTERY_PERCENT.id, error);
      } finally {
        Logger.logComplete(COMMANDS.BATTERY_PERCENT.name);
      }

      // 网络接口
      try {
        Logger.logStart(COMMANDS.NETWORK_INFO.name);
        const networkOutput = await this.executeCommand(
          COMMANDS.NETWORK_INFO.id,
          COMMANDS.NETWORK_INFO.name,
          COMMANDS.NETWORK_INFO.command
        );
        this.deviceInfo.networkInfo = {
          interfaces: COMMANDS.NETWORK_INFO.parser(networkOutput)
        };
        Logger.logResult(COMMANDS.NETWORK_INFO.id, this.deviceInfo.networkInfo);
        Logger.logSuccess(COMMANDS.NETWORK_INFO.id, '获取成功');
      } catch (error) {
        this.deviceInfo.networkInfo = { interfaces: '获取失败' };
        Logger.logError(COMMANDS.NETWORK_INFO.id, error);
      } finally {
        Logger.logComplete(COMMANDS.NETWORK_INFO.name);
      }

      // 完成
      this.deviceInfo.timestamp = Date.now();
      console.log('===== 设备信息获取完成 =====');
      console.log('完整设备信息:', JSON.stringify(this.deviceInfo, null, 2));
      console.log('执行日志:', this.executionLog);
      console.log('时间戳:', new Date(this.deviceInfo.timestamp).toLocaleString());
      console.log('===================================\n');
    },

    async refreshInfo() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      try {
        await this.fetchDeviceInfo();
      } catch (error) {
        this.deviceInfo.error = `刷新失败: ${error.message || '未知错误'}`;
      }
      this.isRefreshing = false;
    },

    handleBackPress() {
      this.$page.finish();
    },

    formatIP(ip?: string) {
      return ip || '未获取到';
    }
  }
});