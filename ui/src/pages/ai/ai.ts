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
            streamId: '', // 添加streamId用于跟踪流式消息
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
            // 修复流式输出监听
            AI.on('ai_stream', (data: any) => {
                // 检查data是否为字符串，如果是对象则提取content
                if (typeof data === 'string') {
                    this.streamingContent += data;
                } else if (data && typeof data === 'object') {
                    if (data.content) {
                        this.streamingContent += data.content;
                    } else if (data.data) {
                        this.streamingContent += data.data;
                    }
                }
                // 确保UI更新
                this.$forceUpdate();
                // 滚动到底部
                this.scrollToBottom();
            });
            $falcon.on<string>('jump', this.jumpHandler);
        } catch (e) {
            showError(e as string || 'AI 初始化失败');
        }
    },

    computed: {
        displayMessages(): ConversationNode[] {
            let messages = [...this.messages]; // 创建副本
            
            // 处理跳转逻辑
            if (this.jumpToMessageId) {
                const jumpIndex = messages.findIndex(msg => msg.id === this.jumpToMessageId);
                if (jumpIndex !== -1) {
                    messages = messages.slice(jumpIndex);
                }
            }

            // 处理流式消息
            if (this.isStreaming && this.streamingContent) {
                const lastMessage = messages[messages.length - 1];
                
                if (lastMessage && lastMessage.role === ROLE.ROLE_ASSISTANT) {
                    // 更新最后一条助手消息的内容
                    messages[messages.length - 1] = {
                        ...lastMessage,
                        content: this.streamingContent
                    };
                } else if (lastMessage) {
                    // 如果最后一条消息不是助手消息，添加新的流式消息
                    const streamingMessage: ConversationNode = {
                        role: ROLE.ROLE_ASSISTANT,
                        content: this.streamingContent,
                        timestamp: new Date().toISOString(),
                        id: this.streamId || `streaming_${Date.now()}`,
                        parentId: lastMessage.id || '',
                        childIds: [],
                        stopReason: STOP_REASON.STOP_REASON_NONE
                    };
                    messages.push(streamingMessage);
                } else {
                    // 如果没有消息，创建第一条流式消息
                    const streamingMessage: ConversationNode = {
                        role: ROLE.ROLE_ASSISTANT,
                        content: this.streamingContent,
                        timestamp: new Date().toISOString(),
                        id: this.streamId || `streaming_${Date.now()}`,
                        parentId: '',
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
                const currentPath = AI.getCurrentPath();
                if (currentPath && Array.isArray(currentPath)) {
                    this.messages = currentPath.map((node: ConversationNode) => ({
                        ...node,
                        childIds: [...(node.childIds || [])]
                    }));
                } else {
                    this.messages = [];
                }
            } catch (e) {
                console.error('获取消息失败:', e);
                showError(e as string || '获取消息失败');
                this.messages = [];
            }
        },
        
        getMessage(messageId: string): ConversationNode | undefined { 
            return this.displayMessages.find(m => m.id === messageId); 
        },

        async sendMessage(userMessage: string) {
            if (!this.aiInitialized || this.isStreaming || !userMessage?.trim()) return;
            userMessage = userMessage.trim();

            // 重置流式状态
            this.streamingContent = '';
            this.isStreaming = false;
            this.streamId = `stream_${Date.now()}`;

            try {
                // 添加用户消息
                await AI.addUserMessage(userMessage);
                this.refreshMessages();
                this.$forceUpdate();
                
                // 生成响应
                await this.generateResponse();
                
            } catch (e) {
                console.error('发送消息失败:', e);
                showError(e as string || '发送消息失败');
            } finally {
                this.currentInput = '';
                this.$forceUpdate();
            }
        },

        async generateResponse() {
            this.isStreaming = true;
            this.streamingContent = '';
            this.streamId = `stream_${Date.now()}`;
            
            try {
                await AI.generateResponse();
                this.refreshMessages();
                this.$forceUpdate();
            } catch (e) {
                console.error('生成响应失败:', e);
                showError(e as string || '生成响应失败');
            } finally {
                this.isStreaming = false;
                this.streamingContent = '';
                this.streamId = '';
                this.$forceUpdate();
            }
        },

        stopGeneration() {
            if (this.isStreaming) {
                AI.stopGeneration();
                this.isStreaming = false;
                this.streamingContent = '';
                this.streamId = '';
                setTimeout(() => {
                    this.refreshMessages();
                    this.$forceUpdate();
                }, 100);
            }
        },

        loadSoftKeyboard() {
            if (this.isStreaming) return;
            openSoftKeyboard(
                () => this.currentInput,
                (value) => { 
                    this.currentInput = value; 
                    this.$forceUpdate(); 
                }
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
            if (this.isStreaming) return;
            
            const message = this.getMessage(messageId);
            if (!message || !message.parentId) {
                showError('无法重新生成消息');
                return;
            }
            
            try {
                await AI.switchToNode(message.parentId);
                await this.generateResponse();
            } catch (e) {
                console.error('重新生成消息失败:', e);
                showError(e as string || '重新生成消息失败');
            }
        },

        async switchVariant(messageId: string, direction: number) {
            if (this.isStreaming) return;
            
            const message = this.getMessage(messageId);
            if (!message) {
                showError('消息不存在');
                return;
            }
            
            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage) {
                showError('父消息不存在');
                return;
            }
            
            const currentIndex = parentMessage.childIds.indexOf(messageId);
            if (currentIndex === -1) {
                showError('消息不在子列表中');
                return;
            }
            
            const newIndex = currentIndex + direction;
            if (newIndex >= 0 && newIndex < parentMessage.childIds.length) {
                try {
                    let newId = parentMessage.childIds[newIndex];
                    
                    // 找到当前分支的叶子节点
                    const getLeafNode = (id: string): string => {
                        const childNodes = AI.getChildNodes(id);
                        if (childNodes && childNodes.length > 0) {
                            return getLeafNode(childNodes[0]);
                        }
                        return id;
                    };
                    
                    const leafId = getLeafNode(newId);
                    await AI.switchToNode(leafId);
                    this.refreshMessages();
                    this.$forceUpdate();
                } catch (e) {
                    console.error('切换消息变体失败:', e);
                    showError(e as string || '切换消息变体失败');
                }
            }
        },

        canGoVariant(messageId: string, direction: number): boolean {
            if (this.isStreaming) return false;
            
            const message = this.getMessage(messageId);
            if (!message) return false;
            
            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage) return false;

            const currentIndex = parentMessage.childIds.indexOf(messageId);
            if (direction < 0) {
                return currentIndex > 0;
            } else {
                return currentIndex < parentMessage.childIds.length - 1;
            }
        },

        editUserMessage(messageId: string) {
            if (this.isStreaming) return;
            
            const message = this.getMessage(messageId);
            if (!message) return;
            
            openSoftKeyboard(
                () => message.content,
                (newContent) => {
                    if (newContent.trim() !== message.content.trim()) {
                        try {
                            // 切换到父节点，然后发送新消息
                            AI.switchToNode(message.parentId);
                            this.sendMessage(newContent);
                        } catch (e) {
                            console.error('编辑消息失败:', e);
                            showError(e as string || '编辑消息失败');
                        }
                    }
                }
            );
        },

        getVariantInfo(messageId: string): string {
            const message = this.getMessage(messageId);
            if (!message) return "1/1";
            
            const parentMessage = this.getMessage(message.parentId);
            if (!parentMessage) return "1/1";

            const currentIndex = parentMessage.childIds.indexOf(messageId);
            if (currentIndex === -1) return "1/1";
            
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
        
        // 滚动到底部
        scrollToBottom() {
            setTimeout(() => {
                const scroller = this.$refs.messageScroller as any;
                if (scroller && scroller.scrollTo) {
                    scroller.scrollTo({
                        x: 0,
                        y: 10000, // 滚动到底部
                        animated: true
                    });
                }
            }, 100);
        },
        
        // 清空对话
        clearConversation() {
            if (this.isStreaming) return;
            
            try {
                // 这里应该调用AI模块的方法来清空对话
                // 由于不清楚具体API，这里先清空本地状态
                this.messages = [];
                this.currentInput = '';
                this.streamingContent = '';
                this.$forceUpdate();
            } catch (e) {
                console.error('清空对话失败:', e);
                showError(e as string || '清空对话失败');
            }
        }
    }
});

export default ai;