<!-- /sdcard/Download/miniapp-main/ui/src/pages/shell/index.vue (更新后) -->
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

<template>
    <div class="container">
        <!-- 输出区域 -->
        <scroller ref="outputScroller" class="output-area" scroll-direction="vertical" :show-scrollbar="true"
            @ready="scrollToBottom">
            <text class="output-text">{{ output || '$ 正在初始化 Shell...' }}</text>
        </scroller>

        <!-- 输入栏 -->
        <div class="input-bar">
            <text class="prompt">$</text>
            <!-- 模拟输入框，点击打开软键盘 -->
            <text class="item-input" @click="openSoftKeyboardForCommand">{{ 
                commandInput.length > 0 ? commandInput : '请输入 Shell 命令...' 
            }}</text>
            
            <div class="btn-group">
                <!-- 执行按钮：修复点击问题在此处 -->
                <text @click="executeCommand" 
                      :class="'btn run-btn' + (executing ? ' square-btn-disabled' : '')">执行</text>
                
                <text @click="clearOutput" class="btn clear-btn">清空</text>
            </div>
        </div>
        
        <!-- 导航按钮（如原始内容所示） -->
        <div class="section" style="background-color: #1a1a1a; padding: 5px;">
            <div class="item">
                <text class="item-text" @click="openAi">AI 助手</text>
            </div>
            <div class="item">
                <text class="item-text" @click="shelldebug">调试更新</text>
            </div>
        </div>
    </div>
    <ToastMessage />
</template>

<style lang="less" scoped>
@import url('index.less');
</style>

<script>
import index from './index';
import ToastMessage from '../../components/ToastMessage.vue';

export default {
    ...index,
    components: {
        ToastMessage
    },
    
    // 关键：在数据更新后尝试滚动到底部
    updated() {
        const scroller = this.$refs.outputScroller;
        if (scroller && scroller.scrollToEnd) {
            // 确保在 SCROLL_DIRECTION 为 vertical 且组件已经准备好时调用
            this.$nextTick(() => {
                scroller.scrollToEnd();
            });
        }
    },
    
    methods: {
        // 确保所有方法都被正确地暴露
        ...index.methods, 
        
        // 适配调用
        executeCommand() {
            index.methods.executeCommand.call(this);
        },
        
        clearOutput() {
            index.methods.clearOutput.call(this);
        },
        
        openSoftKeyboardForCommand() {
            index.methods.openSoftKeyboardForCommand.call(this);
        }
    }
};
</script>
