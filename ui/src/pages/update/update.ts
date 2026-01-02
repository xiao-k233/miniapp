import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
import { showError, showSuccess, showInfo } from '../../components/ToastMessage';
import { showLoading, hideLoading } from '../../components/Loading';

const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';
const CURRENT_VERSION = '1.2.4';
const DEVICE_MODEL = 'a6p';

const MIRRORS = [
    {
        id: 'none',
        name: '不使用镜像 (直接下载)',
        buttonName: '无镜像源',
        enabled: false,
        urlPattern: '{url}'
    },
    {
        id: 'ghproxy',
        name: 'ghproxy.net (推荐)',
        buttonName: 'ghproxy源',
        enabled: true,
        urlPattern: 'https://ghproxy.net/{url}'
    },
    {
        id: 'fastgit',
        name: 'FastGit',
        buttonName: 'FastGit源',
        enabled: true,
        urlPattern: 'https://download.fastgit.org/{path}'
    }
];

export default defineComponent({
    data() {
        return {
            $page: {} as any,

            status: 'idle',
            errorMessage: '',

            currentVersion: CURRENT_VERSION,
            latestVersion: '',
            releaseNotes: '',
            downloadUrl: '',
            fileSize: 0,

            deviceModel: DEVICE_MODEL,
            downloadPath: '',

            shellInitialized: false,

            mirrors: MIRRORS,
            selectedMirror: 'ghproxy',
            useMirror: true
        };
    },

    computed: {
        currentMirror() {
            return this.mirrors.find(m => m.id === this.selectedMirror) || this.mirrors[0];
        },

        hasUpdate(): boolean {
            if (!this.latestVersion) return false;
            return this.compareVersions(this.latestVersion, this.currentVersion) > 0;
        }
    },

    async mounted() {
        await Shell.initialize();
        this.shellInitialized = true;
        this.checkForUpdates();
    },

    methods: {
        compareVersions(a: string, b: string): number {
            const x = a.split('.').map(Number);
            const y = b.split('.').map(Number);
            for (let i = 0; i < Math.max(x.length, y.length); i++) {
                const diff = (x[i] || 0) - (y[i] || 0);
                if (diff !== 0) return diff;
            }
            return 0;
        },

        selectMirror(id: string) {
            const mirror = this.mirrors.find(m => m.id === id);
            if (!mirror) return;

            this.selectedMirror = id;
            this.useMirror = mirror.enabled;
            showInfo(`已切换到镜像源: ${mirror.name}`);
        },

        async checkForUpdates() {
            try {
                showLoading('正在检查更新...');
                const res = await Shell.exec(
                    `curl -s https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
                );
                const data = JSON.parse(res);

                this.latestVersion = data.tag_name.replace(/^v/, '');
                this.releaseNotes = data.body || '';

                const asset = data.assets.find((a: any) =>
                    a.name.includes(this.deviceModel) && a.name.endsWith('.amr')
                );

                this.downloadUrl = asset.browser_download_url;
                this.fileSize = asset.size;
                this.status = this.hasUpdate ? 'available' : 'updated';
            } catch (e: any) {
                this.status = 'error';
                this.errorMessage = e.message || '检查更新失败';
                showError(this.errorMessage);
            } finally {
                hideLoading();
            }
        },

        async downloadUpdate() {
            try {
                this.status = 'downloading';
                showLoading('正在下载更新...');

                let url = this.downloadUrl;
                if (this.useMirror && this.currentMirror.enabled) {
                    url = this.currentMirror.urlPattern.replace('{url}', url);
                }

                this.downloadPath = `/userdisk/miniapp_${Date.now()}.amr`;
                await Shell.exec(`curl -L "${url}" -o "${this.downloadPath}"`);

                await this.installUpdate();
            } catch {
                this.status = 'error';
                showError('下载失败');
            } finally {
                hideLoading();
            }
        },

        async installUpdate() {
            try {
                this.status = 'installing';
                showLoading('正在安装更新...');
                await Shell.exec(`miniapp_cli install "${this.downloadPath}"`);
                this.status = 'updated';
                showSuccess('安装完成');

                // 安装成功后自动清理
                setTimeout(() => {
                    Shell.exec('rm -f /userdisk/miniapp_*_v*_*.amr 2>/dev/null || true');
                }, 2000);
            } catch {
                this.status = 'error';
                showError('安装失败');
            } finally {
                hideLoading();
            }
        },

        openGitHub() {
            showInfo(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
        },

        forceCheck() {
            this.checkForUpdates();
        }
    }
});
