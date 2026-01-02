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
import { Shell } from 'langningchen';
import { showError, showSuccess, showInfo } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';

const GITHUB_OWNER = 'penosext';
const GITHUB_REPO = 'miniapp';
const CURRENT_VERSION = '1.2.4';
const DEVICE_MODEL = 'a6p';

const MIRRORS = [
    {
        id: 'none',
        name: 'Github',
        buttonName: 'Github',
        enabled: false,
        urlPattern: '{url}',
        apiPattern: '{url}',
        testUrl: 'https://github.com'
    },
    {
        id: 'ghproxy',
        name: 'ghproxy.net (推荐)',
        buttonName: 'ghproxy源',
        enabled: true,
        urlPattern: 'https://ghproxy.net/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.net/https://github.com'
    },
    {
        id: 'fastgit',
        name: 'FastGit',
        buttonName: 'FastGit源',
        enabled: true,
        urlPattern: 'https://download.fastgit.org/{path}',
        apiPattern: 'https://api.fastgit.org/{path}',
        testUrl: 'https://download.fastgit.org'
    },
    {
        id: 'ghproxycn',
        name: 'ghproxy.com',
        buttonName: 'ghproxy.com源',
        enabled: true,
        urlPattern: 'https://ghproxy.com/{url}',
        apiPattern: '{url}',
        testUrl: 'https://ghproxy.com/https://github.com'
    },
    {
        id: 'kgithub',
        name: 'kgithub.com',
        buttonName: 'kgithub源',
        enabled: true,
        urlPattern: 'https://kgithub.com/{path}',
        apiPattern: 'https://api.kgithub.com/{path}',
        testUrl: 'https://kgithub.com'
    },
    {
        id: 'hubfast',
        name: 'hub.fastgit.xyz',
        buttonName: 'hubfast源',
        enabled: true,
        urlPattern: 'https://hub.fastgit.xyz/{path}',
        apiPattern: 'https://hub.fastgit.xyz/api/{path}',
        testUrl: 'https://hub.fastgit.xyz'
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
            useMirror: true,
        };
    },

    computed: {
        currentMirror() {
            return (
                this.mirrors.find(m => m.id === this.selectedMirror) ||
                this.mirrors[0]
            );
        },
    },

    async mounted() {
        await this.initializeShell();
        await this.autoCheckUpdates();
    },

    methods: {
        async initializeShell() {
            try {
                await Shell.initialize();
                this.shellInitialized = true;
            } catch {
                this.shellInitialized = false;
            }
        },

        async autoCheckUpdates() {
            setTimeout(() => {
                if (this.shellInitialized) {
                    this.checkForUpdates();
                }
            }, 1000);
        },

        selectMirror(mirrorId: string) {
            const mirror = this.mirrors.find(m => m.id === mirrorId);
            if (!mirror) return;

            this.selectedMirror = mirrorId;
            this.useMirror = mirror.enabled;

            showInfo(`已切换到镜像源: ${mirror.name}`);
        },

        async testMirror() {
            try {
                showLoading(`正在测试镜像源: ${this.currentMirror.name}...`);
                await Shell.exec(`curl -s -k "${this.currentMirror.testUrl}" | head -c 50`);
                showSuccess(`镜像源 ${this.currentMirror.name} 连接正常`);
            } catch {
                showError(`镜像源 ${this.currentMirror.name} 连接失败`);
            } finally {
                hideLoading();
            }
        },

        async testNetwork() {
            try {
                showLoading('测试网络连接...');
                await Shell.exec(`curl -s -k https://github.com`);
                showSuccess('网络连接正常');
            } catch {
                showError('网络连接失败');
            } finally {
                hideLoading();
            }
        },

        openGitHub() {
            showInfo(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`);
        },

        cleanup() {
            Shell.exec('rm -f /userdisk/miniapp_*_v*_*.amr || true');
            showSuccess('清理完成');
        },

        forceCheck() {
            this.checkForUpdates();
        },

        async checkForUpdates() {
            // 你原有逻辑不变（为省篇幅这里不重复改动）
        },

        async downloadUpdate() {
            // 原逻辑不变
        }
    }
});
