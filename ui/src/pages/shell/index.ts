import { defineComponent } from 'vue';
import { Shell } from 'langningchen'; // 使用正确的模块路径
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
        this.shell.initialize(this); // 传入当前 Vue 组件实例
        console.log('Shell initialized:', this.shell);
        console.log('Shell exec method exists:', typeof this.shell.exec === 'function');
    },

    methods: {
        openInput() {
            if (this.busy) return;
            
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
