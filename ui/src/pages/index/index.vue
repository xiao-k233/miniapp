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
