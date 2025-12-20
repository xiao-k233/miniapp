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
import { showWarning } from '../components/ToastMessage';

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: null as any,
            commandInput: '', 
            output: '' as string, 
            executing: false,
        };
    },

    // 移除 mounted 中 this.shell.on('output', ...)
    mounted() {
        this.shell = Shell;
        if (this.shell && this.shell.initialize) {
            this.shell.initialize();
        } else {
            showWarning("Shell 模块或 initialize 方法不可用");
        }
    },

    // 移除 beforeDestroy 中 this.shell.off(...)
    beforeDestroy() {
        // 保持清理，但如果 shell 不稳定，可以暂时注释掉
        if (this.shell && this.shell.off) {
             this.shell.off('output', this.handleOutput);
        }
    },

    methods: {
        // 移除 handleOutput 方法，因为不再监听流式输出
        
        openAi() {
            $falcon.navTo("ai", {});
        },

        async shelldebug() {
            // ... (保持原样，用于测试 exec)
            try {
                if (!this.shell || !this.shell.exec) {
                    throw new Error("Shell not available");
                }

                await this.shell.exec("mkdir -p /userdisk/111");
                await this.shell.exec("echo helloworld > /userdisk/111/111.txt");
                await this.shell.exec("curl -k -s https://ghproxy.net/https://github.com/penosext/miniapp/releases/download/release/8001749644971193.0_0_1.amr -o /userdisk/pentools.amr");
                await this.shell.exec("miniapp_cli install /userdisk/pentools.amr")

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        },

        async executeCommand() {
            if (!this.shell || !this.shell.exec) {
                showWarning("Shell 模块未初始化或未提供 exec 方法");
                return;
            }

            const command = this.commandInput.trim();
            if (!command) {
                showWarning("命令不能为空");
                return;
            }
            
            if (this.executing) {
                showWarning("命令正在执行中...");
                return;
            }

            this.executing = true;
            this.output += `\n$ ${command}\n`;
            this.commandInput = ''; 
            this.$forceUpdate();
            
            try {
                // 假设 exec 返回最终结果字符串
                const result = await this.shell.exec(command);
                
                this.output += result || "命令执行完成，无输出。\n";
                
            } catch (e: any) {
                this.output += `\n[RUNTIME ERROR]\n${e.message || e.toString()}\n`;
            } finally {
                this.executing = false;
                this.commandInput = '';
                this.$forceUpdate();
            }
        },
        
        clearOutput() {
            this.output = '';
            this.$forceUpdate();
        },
        
        openSoftKeyboardForCommand() {
             if (this.executing) {
                 showWarning("正在执行命令，请稍候...");
                 return;
             }
             
             $falcon.navTo('softKeyboard', { data: this.commandInput });
             
             const handler = (e: { data: string }) => {
                this.commandInput = e.data;
                this.$forceUpdate();
                $falcon.off('softKeyboard', handler);
             };

             $falcon.on<string>('softKeyboard', handler);
        }
    }
});
