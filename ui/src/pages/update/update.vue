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
                
                <div class="item">
                    <text class="item-text">设备型号:</text>
                    <text class="item-text" style="color: #ffc107; flex: 1;">{{ deviceModel }}</text>
                </div>
                
                <div v-if="errorMessage" class="item">
                    <text class="item-text" style="color: #dc3545;">错误信息:</text>
                    <text class="item-text" style="color: #dc3545; flex: 1;">{{ errorMessage }}</text>
                </div>
            </div>

            <!-- 版本信息 -->
            <div class="section" v-if="latestRelease">
                <text class="section-title">版本信息</text>
                
                <div class="version-info">
                    <div class="version-line">
                        <text class="version-label">设备型号:</text>
                        <text class="version-value">{{ deviceModel }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">当前版本:</text>
                        <text class="version-value version-old">v{{ currentVersion }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">最新版本:</text>
                        <text class="version-value version-new">{{ latestRelease.tag_name }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">发布日期:</text>
                        <text class="version-value">{{ formatDate(latestRelease.published_at) }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">更新名称:</text>
                        <text class="version-value">{{ latestRelease.name }}</text>
                    </div>
                </div>
            </div>

            <!-- 更新说明 -->
            <div class="section" v-if="latestRelease && latestRelease.body">
                <text class="section-title">更新说明</text>
                <scroller class="release-notes" scroll-direction="vertical">
                    <text>{{ latestRelease.body }}</text>
                </scroller>
            </div>

            <!-- 下载信息 -->
            <div class="section" v-if="downloadFile">
                <text class="section-title">下载信息</text>
                
                <div class="item">
                    <text class="item-text">文件名称:</text>
                    <text class="item-input">{{ downloadFile.name }}</text>
                </div>
                
                <div class="item">
                    <text class="item-text">文件大小:</text>
                    <text class="item-input">{{ formattedFileSize }}</text>
                </div>
                
                <div class="item">
                    <text class="item-text">目标设备:</text>
                    <text class="item-input" :style="{color: downloadFile.name.includes(deviceModel) ? '#28a745' : '#dc3545'}">
                        {{ deviceModel }}
                        <text v-if="!downloadFile.name.includes(deviceModel)" style="color: #dc3545; font-size: 12px;">
                           (不匹配当前型号)
                        </text>
                    </text>
                </div>
            </div>

            <!-- 进度条 -->
            <div class="section" v-if="status === 'downloading'">
                <text class="section-title">下载进度</text>
                
                <div class="progress-container">
                    <text class="progress-text">{{ formattedDownloadedSize }} / {{ formattedFileSize }}</text>
                    
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: downloadProgress + '%' }"></div>
                    </div>
                    
                    <text class="file-info">正在下载 {{ deviceModel }} 型号的更新文件...</text>
                </div>
            </div>

            <!-- 操作按钮 -->
            <div class="section">
                <text class="section-title">操作</text>
                
                <div class="item">
                    <text v-if="hasUpdate && status === 'available'" @click="downloadUpdate" 
                          class="btn btn-success">下载并安装更新</text>
                    <text v-else-if="status === 'downloading' || status === 'installing'" 
                          class="btn btn-disabled" style="opacity: 0.5;">正在处理...</text>
                    <text v-else-if="status === 'updated'" class="btn btn-disabled" style="opacity: 0.5;">已是最新版本</text>
                    <text v-else class="btn btn-disabled" style="opacity: 0.5;">暂无更新</text>
                </div>
                
                <div class="operations-grid" style="margin-top: 10px;">
                    <text @click="openGitHub" class="operation-btn operation-btn-primary">GitHub页面</text>
                    <text @click="cleanup" class="operation-btn operation-btn-warning">清理临时文件</text>
                    <text @click="$page.finish()" class="operation-btn">返回</text>
                </div>
            </div>
            
            <!-- 使用说明 -->
            <div class="section">
                <text class="section-title">使用说明</text>
                <text style="font-size: 14px; color: #888888; line-height: 20px; padding: 10px;">
                    1. 点击"检查更新"按钮获取最新版本信息<br/>
                    2. 当前设备型号: {{ deviceModel }}<br/>
                    3. 如果有新版本，点击"下载并安装更新"按钮<br/>
                    4. 下载完成后会自动安装<br/>
                    5. 安装完成后请重启应用<br/>
                    6. 如果自动安装失败，可以手动执行安装命令
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