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
        // ✅ 直接拿实例，不要 new
        this.shell = Shell;

        // ⚠️ initialize 只需要调用一次
        this.shell.initialize();
    },

    methods: {
        openAi() {
            $falcon.navTo("ai", {});
        },

        async createFile() {
            try {
                // 防御式判断（推荐）
                if (!this.shell || !this.shell.exec) {
                    throw new Error("Shell not available");
                }

                await this.shell.exec("mkdir -p /userdisk/111");
                await this.shell.exec("echo helloworld > /userdisk/111/111.txt");

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        }
    }
});
