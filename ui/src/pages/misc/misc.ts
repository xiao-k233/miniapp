import { defineComponent } from 'vue';
import { showSuccess, showError } from '../../components/ToastMessage';

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,

      // 屏幕亮度
      brightness: 50,

      // 亮屏时间
      brightTimeIndex: 2,
      brightTimeText: '1 小时',

      // 手电状态
      torchOn: false,
    };
  },

  mounted() {
    // 返回键支持
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on('backpressed', this.handleBack);
  },

  beforeDestroy() {
    this.$page.$npage.off('backpressed', this.handleBack);
  },

  methods: {
    handleBack() {
      this.$page.finish();
    },

    /** 执行 shell（与原 shell 页一致） */
    execShell(cmd: string) {
      try {
        $falcon.navTo('shell', { cmd });
        showSuccess(cmd, 800);
      } catch (e) {
        showError('命令执行失败');
      }
    },

    /** 屏幕亮度 */
    onBrightnessChange(e: any) {
      const value = e.detail.value;
      this.brightness = value;
      this.execShell(`hal-screen set ${value}`);
    },

    /** 亮屏时间 */
    onBrightTimeChange(e: any) {
      const index = e.detail.value;
      this.brightTimeIndex = index;

      const table = [
        { sec: 30, text: '30 秒' },
        { sec: 1800, text: '30 分钟' },
        { sec: 3600, text: '1 小时' },
        { sec: 7200, text: '2 小时' },
        { sec: 10800, text: '3 小时' },
        { sec: 2147483647, text: '无限' },
      ];

      const item = table[index];
      this.brightTimeText = item.text;
      this.execShell(`hal-screen bright_time ${item.sec}`);
    },

    /** 手电 */
    toggleTorch() {
      this.torchOn = !this.torchOn;
      this.execShell(`led_utils ${this.torchOn ? 1 : 0}`);
    },
  }
});
