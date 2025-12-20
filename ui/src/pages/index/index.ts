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

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: Shell,

            file1: "",
            file2: "",
            file3: "",
        };
    },

    mounted() {
        this.shell.initialize();
    },

    methods: {
        async shelldebug() {
            try {
                // 文件 1：文本
                await this.shell.exec("mkdir -p /userdisk/111");
                await this.shell.exec("echo helloworld > /userdisk/111/111.txt");
                this.file1 = await this.shell.exec(
                    "cat /userdisk/111/111.txt"
                );

                // 文件 2：下载并展示信息
                await this.shell.exec(
                    "curl -k -s https://ghproxy.net/https://github.com/penosext/miniapp/releases/download/release/8001749644971193.0_0_1.amr -o /userdisk/pentools.amr"
                );
                this.file2 = await this.shell.exec(
                    "ls -lh /userdisk/pentools.amr"
                );

                // 文件 3：系统信息示例
                this.file3 = await this.shell.exec(
                    "df -h /userdisk"
                );

                $falcon.toast("执行完成");
            } catch (e) {
                console.error(e);
                $falcon.toast("执行失败");
            }
        }
    }
});
