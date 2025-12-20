<!--
    Copyright (C) 2025 Langning Chen

    This file is part of miniapp.

    miniapp is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    miniapp is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with miniapp.  If not, see <https://www.gnu.org/licenses/>.
-->
    
import { defineComponent } from 'vue';
import { Shell } from 'langningchen';

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: null as any,
        };
    },

    mounted() {
        this.shell = Shell;
        this.shell.initialize();
    },

    methods: {
        openAi() {
            $falcon.navTo("ai", {});
        },

        async installsysytemAPPS() {
            try {
                // 防御式判断（推荐）
                if (!this.shell || !this.shell.exec) {
                    throw new Error("Shell not available");
                }

                await this.shell.exec("find /oem/secondary/etc/miniapp/resources/presetpkgs -name "*.amr" -exec miniapp_cli install {} \; && reboot
");

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        }
    }
});
