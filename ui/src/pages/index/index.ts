import { defineComponent } from 'vue';

// ⚠️ 引入你的 JSAPI 模块
import * as api from "langningchen";

export type indexOptions = {};

const index = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<indexOptions>,
            shell: null as any,
        };
    },

    async mounted() {
        // 初始化 Shell
        this.shell = new api.Shell();
        this.shell.initialize();
    },

    methods: {
        openAi() {
            $falcon.navTo("ai", {});
        },

        // ✅ 新增：创建目录和文件
        async createFile() {
            try {
                // 1. 创建目录 /userdisk/111
                await this.shell.exec("mkdir -p /userdisk/111");

                // 2. 创建文件并写入内容
                await this.shell.exec(
                    "echo helloworld > /userdisk/111/111.txt"
                );

                $falcon.toast("创建成功");
            } catch (e) {
                console.error(e);
                $falcon.toast("创建失败");
            }
        }
    }
});

export default index;
