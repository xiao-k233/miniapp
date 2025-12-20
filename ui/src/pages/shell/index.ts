import { defineComponent } from 'vue';
import { Shell } from 'langningchen';
// 【关键修复】从 utils 目录导入真正的工具函数
import { openSoftKeyboard } from '../../utils/softKeyboardUtils'; 

export default defineComponent({
    data() {
        return {
            shell: new Shell() as any,
            command: "",
            output: "--- Shell Ready ---\n",
            busy: false,
        };
    },

    mounted() {
        this.shell.initialize();
    },

    methods: {
        openInput() {
            if (this.busy) return;
            
            // 使用源码中定义的 openSoftKeyboard
            openSoftKeyboard(
                () => this.command, // 获取当前值
                (value: string) => { // 设置新值
                    this.command = value;
                    this.$forceUpdate();
                }
            );
        },

        async runCommand() {
            if (!this.command || this.busy) return;

            const cmd = this.command;
            this.command = ""; 
            this.busy = true;

            this.output += `\n$ ${cmd}\n`;

            try {
                // 调用 Shell API
                const res = await this.shell.exec(cmd);
                this.output += (res || "(no output)") + "\n";
            } catch (e: any) {
                this.output += `ERROR: ${String(e)}\n`;
            } finally {
                this.busy = false;
            }
        },

        clearOutput() {
            this.output = "--- Shell Cleared ---\n";
        }
    }
});
