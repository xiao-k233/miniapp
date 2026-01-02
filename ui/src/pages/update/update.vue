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
    <div>
        <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
            <!-- 状态栏 -->
            <div class="section">
                <text class="section-title">软件更新</text>
                
                <div class="item">
                    <text class="item-text">更新状态:</text>
                    <text :class="'update-status ' + statusClass">{{ statusText }}</text>
                </div>
                
                <div class="item">
                    <text class="item-text">设备型号:</text>
                    <text class="item-input">{{ deviceModel }}</text>
                </div>
                
                <div class="item">
                    <text class="item-text">当前版本:</text>
                    <text class="item-input">v{{ currentVersion }}</text>
                </div>
                
                <!-- 重要：简化最新版本显示逻辑 -->
                <div class="item">
                    <text class="item-text">最新版本:</text>
                    <text v-if="latestVersion" class="item-input" :style="{color: hasUpdate ? '#28a745' : '#ffc107'}">
                        {{ latestVersion }}
                    </text>
                    <text v-else class="item-input" style="color: #888888;">
                        未检查
                    </text>
                </div>
                
                <div v-if="errorMessage" class="item">
                    <text class="item-text" style="color: #dc3545;">错误信息:</text>
                    <text class="item-text" style="color: #dc3545; flex: 1;">{{ errorMessage }}</text>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="section">
                <text class="section-title">操作</text>
                
                <div class="item" style="justify-content: center; margin: 10px 0;">
                    <text @click="forceCheck" class="btn-check">检查更新</text>
                    
                    <text v-if="hasUpdate && status === 'available'" @click="downloadUpdate" 
                          class="btn-update">下载并安装更新</text>
                    <text v-else-if="status === 'downloading'" 
                          class="btn-disabled">正在下载...</text>
                    <text v-else-if="status === 'installing'" 
                          class="btn-disabled">正在安装...</text>
                    <text v-else-if="status === 'updated'" 
                          class="btn-disabled">已是最新版本</text>
                    <text v-else class="btn-disabled">暂无更新</text>
                </div>
            </div>
            
            <!-- 更新说明 -->
            <div class="section" v-if="releaseNotes">
                <text class="section-title">更新说明</text>
                <scroller class="release-notes" scroll-direction="vertical">
                    <text>{{ releaseNotes }}</text>
                </scroller>
            </div>
            
            <!-- 使用说明 -->
            <div class="section">
                <text class="section-title">使用说明</text>
                <text style="font-size: 14px; color: #888888; line-height: 20px; padding: 10px;">
                    1. 点击"检查更新"按钮获取最新版本信息<br/>
                    2. 当前设备型号: {{ deviceModel }}<br/>
                    3. 如果有新版本，点击"下载并安装更新"按钮<br/>
                    4. 下载完成后会自动安装<br/>
                    5. 安装完成后会自动清理临时文件<br/>
                    6. 安装完成后请重启应用
                </text>
            </div>
        </scroller>
        
        <Loading />
        <ToastMessage />
    </div>
</template>

<style lang="less" scoped>
@import url('update.less');
</style>

<script>
import update from './update';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';
export default {
    ...update,
    components: {
        Loading,
        ToastMessage
    }
};
</script>