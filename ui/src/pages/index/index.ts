import { defineComponent } from 'vue';
import * as api from "langningchen";

export default defineComponent({
    data() {
        return {
            $page: {} as FalconPage<any>,
            shell: null as any,
        };
    },

    methods: {
        openAi() {
            $falcon.navTo("ai", {});
        },

        async getShell() {
            if (!this.shell) {
                this.shell = new api.Shell();
                this.shell.initialize();
            }
            return this.shell;
        },

        async createFile() {
            try {
                const shell = await this.getShell();

                await shell.exec("mkdir -p /userdisk/111");
                await shell.exec("echo helloworld > /userdisk/111/111.txt");

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        }
    }
});
