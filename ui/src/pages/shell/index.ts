<template>
    <div class="container">
        <!-- 输出内容区 -->
        <scroller class="output-area" scroll-direction="vertical" :show-scrollbar="true">
            <text class="output-text">{{ output }}</text>
        </scroller>

        <!-- 输入控制区 -->
        <div class="input-bar">
            <text class="prompt">></text>
            <div class="input-trigger" @click="openInput">
                <text class="input-placeholder">{{ command || '点击输入命令...' }}</text>
            </div>
            <div class="btn-group">
                <text class="btn run-btn" @click="runCommand">{{ busy ? '...' : '执行' }}</text>
                <text class="btn clear-btn" @click="clearOutput">清屏</text>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
@import url('index.less');
</style>

<script>
import index from './index';
export default index;
</script>
