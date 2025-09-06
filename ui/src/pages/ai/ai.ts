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
import { AI } from 'langningchen';
import { ROLE, ConversationNode, STOP_REASON } from '../../@types/langningchen';
import { showError } from '../../components/ToastMessage';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';

export type aiOptions = {};

const ai = defineComponent({
    data() {
        return {
            $page: {} as FalconPage<aiOptions>,
            aiInitialized: false,
            currentInput: '',
            streamingContent: '',
            isStreaming: false,
            messages: [] as ConversationNode[],
            jumpToMessageId: '',

            currentConversationId: '',
        };
    },

    created() {
        this.$page.on("show", this.onPageShow);
    },
    destroyed() {
        this.$page.off("show", this.onPageShow);
    },

    mounted() {
        try {
            AI.initialize();
            this.aiInitialized = true;
            this.refreshMessages();
            AI.on('ai_stream', (data: string) => {
                this.streamingContent += data;
                this.$forceUpdate();
            });
            $falcon.on<string>('jump', this.jumpHandler);
        } catch (e) {
            showError(e as string || 'AI 初始化失败');
        }
    },

    computed: {
        displayMessages(): ConversationNode[] {
            let messages = this.messages;
            if (this.jumpToMessageId) {
                const jumpIndex = messages.findIndex(msg => msg.id === this.jumpToMessageId);
                if (jumpIndex !== -1) {
                    messages = messages.slice(jumpIndex);
                }
            }

            if (this.isStreaming && this.streamingContent) {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === ROLE.ROLE_ASSISTANT) {
                    lastMessage.content = this.streamingContent;
                }
                else if (lastMessage) {
                    const streamingMessage: ConversationNode = {
                        role: ROLE.ROLE_ASSISTANT,
                        content: this.streamingContent,
                        timestamp: new Date().toISOString(),
                        id: `streaming_${Date.now()}`,
                        parentId: lastMessage.id,
                        childIds: [],
                        stopReason: STOP_REASON.STOP_REASON_NONE
                    };
                    messages.push(streamingMessage);
                }
            }
            return messages;
        },
        canSendMessage(): boolean {
            return this.aiInitialized && !this.isStreaming && this.currentInput.trim().length > 0;
        }
    },

    methods: {
        onPageShow() {
            this.refreshMessages();
        },

        jumpHandler(e: { data: string; }) {
            this.jumpToMessageId = e.data;
            this.$forceUpdate();
        },

        refreshMessages() {
            try {
                if (!this.aiInitialized) return;
                this.messages = AI.getCurrentPath().map((node: ConversationNode) => ({ ...node, childIds: [...node.childIds] }));
            } catch (e) {
                showError(e as string || '获取消息失败');
                this.messages = [];
            }
        },
        getMessage(messageId: string): ConversationNode | undefined {
            if (!messageId) return undefined;
            return this.displayMessages.find(m => m.id === messageId);
        },

        async sendMessage(userMessage: string) {
            if (!this.aiInitialized || this.isStreaming || !userMessage?.trim()) return;
            userMessage = userMessage.trim();

            this.streamingContent = '';

            try {
                await AI.addUserMessage(userMessage);
                this.refreshMessages();
                this.$forceUpdate();
                this.generateResponse();
            } catch (e) {
                showError(e as string || '添加用户消息失败');
            }
            this.currentInput = '';
        },

        async generateResponse() {
            if (!this.aiInitialized) return;
            this.isStreaming = true;
            try {
                await AI.generateResponse();
                this.refreshMessages();
                this.$forceUpdate();
            } catch (e) {
                showError(e as string || '生成响应失败');
            } finally {
                this.isStreaming = false;
                this.streamingContent = '';
            }
        },

        stopGeneration() {
            if (this.isStreaming && this.aiInitialized) {
                try {
                    AI.stopGeneration();
                } catch (e) {
                    showError(e as string || '停止生成失败');
                }
                setTimeout(() => {
                    this.isStreaming = false;
                    this.streamingContent = '';
                    this.refreshMessages();
                    this.$forceUpdate();
                }, 100);
            }
        },

        loadSoftKeyboard() {
            if (this.isStreaming) return;
            openSoftKeyboard(
                () => this.currentInput,
                (value) => { this.currentInput = value; this.$forceUpdate(); }
            );
        },

        openSettings() {
            if (this.isStreaming) return;
            $falcon.navTo('aiSettings', {});
        },

        openHistory() {
            if (this.isStreaming) return;
            $falcon.navTo('aiHistory', {});
        },

        openMessageNavigation() {
            if (this.isStreaming) return;
            $falcon.navTo('aiNav', {});
        },

        async regenerateMessage(messageId: string) {
            if (this.isStreaming || !this.aiInitialized || !messageId) return;
            try {
                const message = this.getMessage(messageId);
                if (!message || !message.parentId) return;
                AI.switchToNode(message.parentId);
                this.generateResponse();
            } catch (e) {
                showError(e as string || '切换消息失败');
            }
        },

        switchVariant(messageId: string, direction: number) {
            if (this.isStreaming || !this.aiInitialized || !messageId) return;
            const message = this.getMessage(messageId);
            if (!message || !message.parentId) return;

            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage || !parentMessage.childIds.length) return;

            const currentIndex = parentMessage.childIds.indexOf(messageId);
            const newIndex = currentIndex + direction;
            if (newIndex >= 0 && newIndex < parentMessage.childIds.length) {
                try {
                    let newId = parentMessage.childIds[newIndex];
                    while (AI.getChildNodes(newId).length > 0) {
                        newId = AI.getChildNodes(newId)[0];
                    }
                    AI.switchToNode(newId);
                    this.refreshMessages();
                    this.$forceUpdate();
                } catch (e) {
                    showError(e as string || '切换消息失败');
                }
            }
        },

        getCurrentVariantInfo(messageId: string): string {
            if (!messageId) return "1/1";
            return this.getVariantInfo(messageId);
        },

        canGoVariant(messageId: string, direction: number): boolean {
            if (this.isStreaming || !this.aiInitialized || !messageId) return false;
            const message = this.getMessage(messageId);
            if (!message || !message.parentId) return false;

            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage || !parentMessage.childIds.length) return false;

            const currentIndex = parentMessage.childIds.indexOf(messageId);
            if (direction < 0) {
                return currentIndex > 0;
            } else {
                return currentIndex < parentMessage.childIds.length - 1;
            }
        },

        editUserMessage(messageId: string) {
            if (this.isStreaming || !this.aiInitialized || !messageId) return;
            const message = this.getMessage(messageId);
            if (!message) return;

            openSoftKeyboard(
                () => message.content,
                (newContent) => {
                    if (newContent.trim() !== message.content.trim()) {
                        try {
                            AI.switchToNode(message.parentId);
                            this.sendMessage(newContent);
                        } catch (e) {
                            showError(e as string || '编辑消息失败');
                        }
                    }
                }
            );
        },

        getVariantInfo(messageId: string): string {
            if (!messageId) return "1/1";
            const message = this.getMessage(messageId);
            if (!message || !message.parentId) return "1/1";

            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage || !parentMessage.childIds.length) return "1/1";

            const currentIndex = parentMessage.childIds.indexOf(messageId);
            return `${currentIndex + 1}/${parentMessage.childIds.length}`;
        },

        getStopReasonText(stopReason: STOP_REASON): string {
            switch (stopReason) {
                case STOP_REASON.STOP_REASON_LENGTH:
                    return '超出最大长度限制';
                case STOP_REASON.STOP_REASON_ERROR:
                    return '生成时出现错误';
                case STOP_REASON.STOP_REASON_CONTENT_FILTER:
                    return '内容被过滤';
                case STOP_REASON.STOP_REASON_USER_STOPPED:
                    return '用户手动停止';
                case STOP_REASON.STOP_REASON_STOP:
                    return '模型主动停止';
                case STOP_REASON.STOP_REASON_DONE:
                    return '生成完成';
                case STOP_REASON.STOP_REASON_NONE:
                    return '无';
                default:
                    return '未知';
            }
        },
    }
});

export default ai;
