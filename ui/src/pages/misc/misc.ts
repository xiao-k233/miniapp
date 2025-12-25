import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showSuccess, showError } from '../../components/ToastMessage';

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,

      shellInitialized: false,
      torchOn: false,
    };
  },

  async mounted() {
    // 返回键支持
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on('backpressed', this.handleBack);

    // 初始化 Shell（后台）
    await this.initShell();
  },

  beforeDestroy() {
    this.$page.$npage.off('backpressed', this.handleBack);
  },

  methods: {
    handleBack() {
      this.$page.finish();
    },

    async initShell() {
      try {
        await Shell.initialize();
        this.shellInitialized = true;
      } catch (e: any) {
        showError('Shell 初始化失败');
      }
    },

    async execShell(cmd: string, successMsg?: string) {
      if (!this.shellInitialized) {
        showError('Shell 未初始化');
        return;
      }

      try {
        await Shell.exec(cmd);
        if (successMsg) {
          showSuccess(successMsg, 800);
        }
      } catch (e: any) {
        showError(`执行失败: ${cmd}`);
      }
    },

    /* ========== 亮屏时间 ========== */
    setBrightTime(sec: number, label: string) {
      this.execShell(
        `hal-screen bright_time ${sec}`,
        `亮屏时间：${label}`
      );
    },

    /* ========== 屏幕亮度 ========== */
    setBrightness(value: number) {
      this.execShell(
        `hal-screen set ${value}`,
        `亮度：${value}%`
      );
    },

    /* ========== 手电筒 ========== */
    toggleTorch() {
      this.torchOn = !this.torchOn;
      this.execShell(
        `led_utils ${this.torchOn ? 1 : 0}`,
        this.torchOn ? '手电已打开' : '手电已关闭'
      );
    }
  }
});
