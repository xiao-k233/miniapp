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
    <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
        <div class="section">

            <text class="section-title">调试工具</text>

            <!-- 按钮 -->
            <div class="item btn-area">
                <text class="btn btn-primary" @click="shelldebug">
                    执行并输出文件
                </text>
            </div>

            <!-- 文件 1 -->
            <div class="item">
                <text class="item-text">/userdisk/111/111.txt</text>
            </div>
            <div class="item">
                <textarea
                    class="item-textarea item-input-disabled"
                    :value="file1"
                    disabled
                />
            </div>

            <!-- 文件 2 -->
            <div class="item">
                <text class="item-text">/userdisk/pentools.amr</text>
            </div>
            <div class="item">
                <textarea
                    class="item-textarea item-input-disabled"
                    :value="file2"
                    disabled
                />
            </div>

            <!-- 文件 3 -->
            <div class="item">
                <text class="item-text">/userdisk 使用情况</text>
            </div>
            <div class="item">
                <textarea
                    class="item-textarea item-input-disabled"
                    :value="file3"
                    disabled
                />
            </div>

        </div>
    </scroller>
</template>

<script>
import index from './index';
export default index;
</script>
