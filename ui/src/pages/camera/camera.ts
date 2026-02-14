import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showInfo, showError } from '../../components/ToastMessage';

const CAMERA_DEVICE = '/dev/video29';
const STORAGE_PATH = '/userdisk/Favorite';
const MIN_SPACE_MB = 50;
const PREVIEW_WIDTH = 1920;
const PREVIEW_HEIGHT = 1080;
const SCREEN_WIDTH = 960;
const SCREEN_HEIGHT = 266;
const SCREEN_XOFFSET = 0;
const SCREEN_YOFFSET = 107;
const SCREEN_DIRECTION = 270;

export default defineComponent({
  data() {
    return {
      $page: {} as any, // FalconPage type
      previewPid: null as string | null,
      isPreviewing: false,
      shellInitialized: false,
    };
  },
  
  created() {
    // 监听页面显示和隐藏事件
    if (this.$page && this.$page.on) {
        this.$page.on('show', this.onPageShow);
        this.$page.on('hide', this.onPageHide);
    }
  },

  async mounted() {
    await this.initShell();
    // 确保存储目录存在
    await this.ensureDirectory();
    
    // 延迟启动预览，等待页面渲染完成
    setTimeout(() => {
        this.startPreview();
    }, 500);
  },

  beforeDestroy() {
    this.stopPreview();
    if (this.$page && this.$page.off) {
        this.$page.off('show', this.onPageShow);
        this.$page.off('hide', this.onPageHide);
    }
  },

  methods: {
    onPageShow() {
        if (!this.isPreviewing) {
            this.startPreview();
        }
    },

    onPageHide() {
        this.stopPreview();
    },

    async initShell() {
      try {
        if (Shell && Shell.initialize) {
            await Shell.initialize();
            this.shellInitialized = true;
        } else {
            console.error('Shell module not found');
            showError('Shell module not found');
        }
      } catch (e) {
        console.error('Shell init failed', e);
        showError('Shell init failed');
      }
    },

    async ensureDirectory() {
        if (!this.shellInitialized) return;
        try {
            await Shell.exec(`mkdir -p ${STORAGE_PATH}`);
        } catch (e) {
            console.error('Create directory failed', e);
        }
    },

    async checkStorage() {
        if (!this.shellInitialized) return false;
        try {
            // Check space
            const dfRes = await Shell.exec(`df -m ${STORAGE_PATH} | awk 'NR==2 {print $4}'`);
            const freeMb = parseInt(dfRes.trim());
            
            if (isNaN(freeMb)) {
                console.warn('Failed to parse df output:', dfRes);
            } else if (freeMb < MIN_SPACE_MB) {
                showError(`存储空间不足 (${freeMb}MB < ${MIN_SPACE_MB}MB)，禁止拍摄`);
                return false;
            }
            
            // Check writable
            try {
                const testFile = `${STORAGE_PATH}/.test_${Date.now()}`;
                await Shell.exec(`touch ${testFile} && rm ${testFile}`);
            } catch (e) {
                showError('存储路径只读或无写入权限');
                return false;
            }
            return true;
        } catch (e) {
            console.error('Check storage failed', e);
            showError('存储检查失败');
            return false; 
        }
    },

    getTimestamp() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
    },

    getRenderRectangleParam() {
        return `render-rectangle="<${SCREEN_XOFFSET},${SCREEN_YOFFSET},${SCREEN_WIDTH},${SCREEN_HEIGHT}>"`;
    },

    getRotationParam() {
        if (SCREEN_DIRECTION === 270) return 'videoflip method=counterclockwise';
        if (SCREEN_DIRECTION === 180) return 'videoflip method=rotate-180';
        if (SCREEN_DIRECTION === 90) return 'videoflip method=clockwise';
        return '';
    },

    async startPreview() {
        if (this.isPreviewing || !this.shellInitialized) return;
        
        const renderRect = this.getRenderRectangleParam();
        const rotation = this.getRotationParam();
        const rotationPipe = rotation ? ` ${rotation} !` : '';
        
        const cmd = `gst-launch-1.0 v4l2src device=${CAMERA_DEVICE} ! video/x-raw,width=${PREVIEW_WIDTH},height=${PREVIEW_HEIGHT},framerate=30/1 !${rotationPipe} kmssink plane-id=75 sync=false force-aspect-ratio=true render-rectangle="<108,244,266,472>" > /dev/null 2>&1 & echo $!`;
        
        try {
            const result = await Shell.exec(cmd);
            const pid = result.trim();
            if (pid && !isNaN(parseInt(pid))) {
                this.previewPid = pid;
                this.isPreviewing = true;
                console.log('Preview started, PID:', pid);
            } else {
                showError('启动预览失败: 无法获取PID');
            }
        } catch (e) {
            showError('启动预览异常: ' + e);
        }
    },

    async stopPreview() {
        if (this.previewPid) {
            try {
                await Shell.exec(`kill -9 ${this.previewPid}`);
            } catch (e) {
                console.error('Stop preview failed', e);
            }
            this.previewPid = null;
            this.isPreviewing = false;
        }
    },

    async takePhoto() {
        if (!(await this.checkStorage())) return;
        
        await this.stopPreview();
        
        const filename = `IMG_${this.getTimestamp()}.jpg`;
        const filepath = `${STORAGE_PATH}/${filename}`;
        const rotation = this.getRotationParam();
        const rotationPipe = rotation ? ` ${rotation} !` : '';
        
        // 拍照使用 filesink，不需要 kmssink，所以这部分 pipeline 相对独立
        // num-buffers=1
        const cmd = `gst-launch-1.0 v4l2src device=${CAMERA_DEVICE} num-buffers=5 ! video/x-raw,width=${PREVIEW_WIDTH},height=${PREVIEW_HEIGHT} !${rotationPipe} jpegenc ! filesink location=${filepath}`;
        
        try {
            await Shell.exec(cmd);
            showInfo(`已保存: ${filename}`);
        } catch (e) {
            showError('拍照失败: ' + e);
        }
        
        await this.startPreview();
    }
  }
});
