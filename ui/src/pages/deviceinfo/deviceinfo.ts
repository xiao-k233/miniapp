import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

// 命令结果接口
interface CommandResult {
  label: string;      // 命令显示标签
  command: string;    // 执行的命令
  result: string;     // 命令执行结果
  showRaw?: boolean;  // 是否显示原始输出
}

// 设备信息接口
interface DeviceInfo {
  ipAddress: CommandResult[];
  deviceId: CommandResult[];
  systemInfo: CommandResult[];
  networkInfo: CommandResult[];
  storageInfo: CommandResult[];
  batteryPercent: CommandResult[];
  
  timestamp?: number;
  error?: string;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      isLoading: true,
      isRefreshing: false,
      shellInitialized: false,
      
      deviceInfo: {
        ipAddress: [],
        deviceId: [],
        systemInfo: [],
        networkInfo: [],
        storageInfo: [],
        batteryPercent: [],
      } as DeviceInfo,
      
      shellModule: null as any,
      
      // 命令配置（可以在这里添加/修改命令）
      commandConfigs: {
        ipAddress: [
          { label: 'WLAN0 IP', command: "ip addr show wlan0 2>/dev/null | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1" },
          { label: 'ETH0 IP', command: "ip addr show eth0 2>/dev/null | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1" },
          { label: '所有IP地址', command: "hostname -I" },
          { label: '公网IP', command: "curl -s ifconfig.me || curl -s ipinfo.io/ip || echo '无法获取'" },
        ] as CommandResult[],
        
        deviceId: [
          { label: 'UUID', command: 'cat /proc/sys/kernel/random/uuid', showRaw: true },
          { label: '机器ID', command: 'cat /etc/machine-id', showRaw: true },
          { label: '序列号', command: 'getprop ro.serialno || echo "N/A"' },
          { label: '产品UUID', command: 'cat /sys/class/dmi/id/product_uuid 2>/dev/null || echo "N/A"', showRaw: true },
          { label: '主机名', command: 'hostname' },
        ] as CommandResult[],
        
        systemInfo: [
          { label: '系统架构', command: 'uname -m' },
          { label: '内核版本', command: 'uname -r' },
          { label: '系统名称', command: 'uname -s' },
          { label: '系统版本', command: 'cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\' || uname -o' },
          { label: 'CPU信息', command: 'cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 | xargs' },
          { label: '运行时间', command: 'uptime -p || uptime' },
        ] as CommandResult[],
        
        networkInfo: [
          { label: '网络接口', command: 'ip -4 addr show', showRaw: true },
          { label: '路由表', command: 'ip route show', showRaw: true },
          { label: 'DNS配置', command: 'cat /etc/resolv.conf 2>/dev/null || echo "未找到"' },
          { label: '网络连接', command: 'ss -tunlp 2>/dev/null | head -20' },
        ] as CommandResult[],
        
        storageInfo: [
          { label: '根目录使用', command: 'df -h /', showRaw: true },
          { label: '所有挂载点', command: 'df -h | head -20', showRaw: true },
          { label: '内存使用', command: 'free -h', showRaw: true },
          { label: '磁盘信息', command: 'lsblk 2>/dev/null | head -20' },
        ] as CommandResult[],
        
        batteryPercent: [
          { label: '电池容量', command: 'hal-battery 2>/dev/null | grep capacity || cat /sys/class/power_supply/BAT0/capacity 2>/dev/null || echo "N/A"' },
          { label: '电池状态', command: 'cat /sys/class/power_supply/BAT0/status 2>/dev/null || echo "未知"' },
          { label: '电池健康', command: 'cat /sys/class/power_supply/BAT0/health 2>/dev/null || echo "未知"' },
        ] as CommandResult[],
      },
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
        await this.fetchAllCommands();
      } catch (error: any) {
        this.deviceInfo.error = `加载失败: ${error.message || '未知错误'}`;
      } finally {
        this.isLoading = false;
        this.isRefreshing = false;
      }
    },
    
    async initializeShell() {
      if (!Shell || typeof Shell.initialize !== 'function') {
        throw new Error('Shell模块不可用');
      }
      await Shell.initialize();
      this.shellModule = Shell;
      this.shellInitialized = true;
    },
    
    async fetchAllCommands() {
      if (!this.shellInitialized) {
        throw new Error('Shell未初始化');
      }

      this.deviceInfo.timestamp = Date.now();
      
      // 并行执行所有命令以提高效率
      await Promise.all([
        this.fetchCommands('ipAddress'),
        this.fetchCommands('deviceId'),
        this.fetchCommands('systemInfo'),
        this.fetchCommands('networkInfo'),
        this.fetchCommands('storageInfo'),
        this.fetchCommands('batteryPercent'),
      ]);
    },
    
    async fetchCommands(type: keyof typeof this.commandConfigs) {
      const results: CommandResult[] = [];
      for (const config of this.commandConfigs[type]) {
        try {
          const result = (await Shell.exec(config.command)).trim();
          results.push({
            ...config,
            result: result || '未获取到',
          });
        } catch (error) {
          results.push({
            ...config,
            result: '执行失败',
          });
        }
      }
      this.deviceInfo[type] = results;
    },

    async refreshInfo() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      await this.fetchAllCommands();
      this.isRefreshing = false;
    },

    handleBackPress() {
      this.$page.finish();
    },
    
    // 简化的IP格式化方法
    formatIP(ipResults: CommandResult[]) {
      // 返回第一个有效的IP结果
      const validIP = ipResults.find(r => r.result && r.result !== '未获取到' && r.result !== '执行失败');
      return validIP ? validIP.result : '未获取到IP地址';
    },
    
    // 简化的电池电量获取
    getBatteryPercent(batteryResults: CommandResult[]) {
      // 查找电池容量结果
      const batteryResult = batteryResults.find(r => r.label.includes('容量'));
      return batteryResult && batteryResult.result !== '未获取到' && batteryResult.result !== '执行失败' 
        ? batteryResult.result 
        : '未知';
    },
    
    // 简化的设备ID获取
    getDeviceId(deviceIdResults: CommandResult[]) {
      // 优先使用UUID，其次是机器ID
      const uuidResult = deviceIdResults.find(r => r.label.includes('UUID'));
      const machineIdResult = deviceIdResults.find(r => r.label.includes('机器ID'));
      
      if (uuidResult && uuidResult.result !== '未获取到' && uuidResult.result !== '执行失败') {
        return uuidResult.result;
      }
      if (machineIdResult && machineIdResult.result !== '未获取到' && machineIdResult.result !== '执行失败') {
        return machineIdResult.result;
      }
      return '未知';
    },
    
    // 获取系统信息中的特定值
    getSystemInfo(systemResults: CommandResult[], key: string) {
      const result = systemResults.find(r => r.label.includes(key));
      return result && result.result !== '未获取到' && result.result !== '执行失败' 
        ? result.result 
        : '未知';
    },
    
    // 获取存储信息中的特定值
    getStorageInfo(storageResults: CommandResult[], key: string) {
      const dfResult = storageResults.find(r => r.label.includes('根目录使用'));
      if (!dfResult || !dfResult.result) return '未知';
      
      try {
        const lines = dfResult.result.split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          if (parts.length >= 6) {
            switch (key) {
              case 'total': return parts[1];
              case 'used': return parts[2];
              case 'free': return parts[3];
            }
          }
        }
      } catch (error) {
        console.error('解析存储信息失败:', error);
      }
      return '未知';
    },
  }
});
