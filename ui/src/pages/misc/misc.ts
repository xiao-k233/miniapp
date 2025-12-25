import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,

      shellReady: false,

      // 屏幕亮度
      brightness: 50,

      // 亮屏时间 index
      screenTimeIndex: 2,
      screenTimeText: '1 小时',

      // 手电
      torchOn: false,
    };
  },

  async mounted() {
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on('backpressed', this.handleBack);

    await this.initShell();
  },

  beforeDestroy() {
    this.$page.$npage.off('backpressed', this.handleBack);
  },

  methods: {
    async initShell() {
      if (!Shell || typeof Shell.initialize !== 'function') {
        console.error('Shell 模块不可用');
        return;
      }
      await Shell.initialize();
      this.shellReady = true;
    },

    async exec(cmd: string) {
      if (!this.shellReady) return;
      try {
        await Shell.exec(cmd);
      } catch (e) {
        console.error('Shell 执行失败:', cmd, e);
      }
    },

    /* ================= 屏幕亮度 ================= */

    onBrightnessChange(e: any) {
      const value = e.detail.value;
      this.brightness = value;

      // 实时生效
      this.exec(`hal-screen set ${value}`);
    },

    /* ================= 亮屏时间 ================= */

    onScreenTimeChange(e: any) {
      const index = e.detail.value;
      this.screenTimeIndex = index;

      const table = [
        { sec: 30, text: '30 秒' },
        { sec: 1800, text: '30 分钟' },
        { sec: 3600, text: '1 小时' },
        { sec: 7200, text: '2 小时' },
        { sec: 10800, text: '3 小时' },
        { sec: 2147483647, text: '无限' },
      ];

      const item = table[index];
      this.screenTimeText = item.text;

      this.exec(`hal-screen bright_time ${item.sec}`);
    },

    /* ================= 手电 ================= */

    async toggleTorch() {
      this.torchOn = !this.torchOn;
      await this.exec(`led_utils ${this.torchOn ? 1 : 0}`);
    },

    handleBack() {
      this.$page.finish();
    }
  }
});
