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

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      isLoading: true,
      isRefreshing: false,
      shellInitialized: false,
      
      deviceInfo: {} as DeviceInfo,
      shellModule: null as any,
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
    
    async fetchDeviceInfo() {
      if (!this.shellInitialized) {
        throw new Error('Shell未初始化');
      }

      this.deviceInfo = { timestamp: Date.now() };

      /* ========== IP 地址 ========== */
      try {
        const ipResult = await Shell.exec(
          "ip addr show wlan0 2>/dev/null | grep -m1 'inet ' | awk '{print $2}' | cut -d/ -f1"
        );
        this.deviceInfo.ipAddress = ipResult.trim() || '未获取到IP地址';
      } catch {
        this.deviceInfo.ipAddress = '获取失败';
      }

      /* ========== 设备 ID ========== */
      try {
        const deviceIdResult = await Shell.exec(
          'cat /proc/sys/kernel/random/uuid || cat /etc/machine-id'
        )
          await this.shell.exec("cat /proc/cmdline");
        this.deviceInfo.deviceId = deviceIdResult.trim().substring(0, 32);
      } catch {
        this.deviceInfo.deviceId = '未知';
      }

      /* ========== 系统信息 ========== */
      try {
        const model = (await Shell.exec('uname -m')).trim();
        const version = (await Shell.exec('uname -r')).trim();
        const kernel = (await Shell.exec('uname -s')).trim();
        this.deviceInfo.systemInfo = { model, version, kernel };
      } catch {
        this.deviceInfo.systemInfo = { model: '未知', version: '未知', kernel: '未知' };
      }

      /* ========== 网络接口 ========== */
      try {
        this.deviceInfo.networkInfo = {
          interfaces: (await Shell.exec('ip -4 addr show')).trim()
        };
      } catch {
        this.deviceInfo.networkInfo = { interfaces: '获取失败' };
      }

      /* ========== 存储信息 ========== */
      try {
        const df = await Shell.exec('df -h /');
        const parts = df.split('\n')[1].split(/\s+/);
        this.deviceInfo.storageInfo = {
          total: parts[1],
          used: parts[2],
          free: parts[3]
        };
      } catch {
        this.deviceInfo.storageInfo = { total: '未知', used: '未知', free: '未知' };
      }

      /* ========== 电池电量 ========== */
      try {
        const batteryOutput = await Shell.exec('hal-battery');
        const match = batteryOutput.match(/capacity:(\d+)/);
        this.deviceInfo.batteryPercent = match ? `${match[1]}%` : '未知';
      } catch {
        this.deviceInfo.batteryPercent = '获取失败';
      }
    },

    async refreshInfo() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      await this.fetchDeviceInfo();
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
