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
                    <text @click="forceCheck" class="btn btn-primary">检查更新</text>
                </div>
                
                <div v-if="errorMessage" class="item">
                    <text class="item-text" style="color: #dc3545;">错误:</text>
                    <text class="item-text" style="color: #dc3545; flex: 1;">{{ errorMessage }}</text>
                </div>
            </div>

            <!-- 版本信息 -->
            <div v-if="latestVersion" class="section">
                <text class="section-title">版本信息</text>
                
                <div class="version-info">
                    <div class="version-line">
                        <text class="version-label">当前版本:</text>
                        <text class="version-value version-old">{{ currentVersion }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">最新版本:</text>
                        <text class="version-value version-new">{{ latestVersion }}</text>
                    </div>
                    
                    <div v-if="fileSize > 0" class="version-line">
                        <text class="version-label">文件大小:</text>
                        <text class="version-value">{{ formattedFileSize }}</text>
                    </div>
                </div>
            </div>

            <!-- 更新说明 -->
            <div v-if="releaseNotes" class="section">
                <text class="section-title">更新说明</text>
                <scroller class="release-notes" scroll-direction="vertical">
                    <text style="color: #ffffff;">{{ releaseNotes }}</text>
                </scroller>
            </div>

            <!-- 操作按钮 -->
            <div class="section">
                <text class="section-title">操作</text>
                
                <div class="item">
                    <text v-if="hasUpdate && status === 'available'" @click="downloadUpdate" 
                          class="btn btn-success">下载并安装更新</text>
                    <text v-else-if="status === 'downloading' || status === 'installing'" 
                          class="btn btn-disabled" style="opacity: 0.5;">正在处理...</text>
                    <text v-else class="btn btn-disabled" style="opacity: 0.5;">暂无更新</text>
                </div>
                
                <div class="operations-grid">
                    <text @click="openGitHub" class="operation-btn operation-btn-info">GitHub页面</text>
                    <text @click="testNetwork" class="operation-btn operation-btn-info">测试网络</text>
                    <text @click="cleanup" class="operation-btn operation-btn-warning">清理临时文件</text>
                    <text @click="$page.finish()" class="operation-btn">返回</text>
                </div>
            </div>
            
            <!-- 使用说明 -->
            <div class="section">
                <text class="section-title">使用说明</text>
                <text style="font-size: 14px; color: #888888; line-height: 20px; padding: 5px;">
                    1. 点击"检查更新"按钮获取最新版本信息
                    2. 如果有新版本，点击"下载并安装更新"按钮
                    3. 下载完成后会自动安装
                    4. 安装完成后请重启应用
                    5. 如果自动更新失败，可以手动下载安装
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