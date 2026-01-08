<template>
    <div>
        <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
            <!-- 更新状态 -->
            <div class="section">
                <text class="section-title">更新状态</text>
                
                <div class="info-card">
                    <div class="status-line">
                        <text class="status-label">状态:</text>
                        <text :class="'status-value ' + statusClass">{{ statusText }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">设备型号:</text>
                        <text class="version-text">{{ deviceModel }}</text>
                    </div>
                    
                    <div class="version-line">
                        <text class="version-label">当前版本:</text>
                        <text class="version-text version-old">v{{ currentVersion }}</text>
                    </div>
                    
                    <div v-if="latestVersion" class="version-line">
                        <text class="version-label">最新版本:</text>
                        <text class="version-text version-new">v{{ latestVersion }}</text>
                    </div>
                    
                    <div class="action-line">
                        <text @click="forceCheck" class="action-btn">
                            <image class="image-icon" resize="contain" :src="require('./images/refresh.png')" />
                            <text class="btn-text">检查更新</text>
                        </text>
                    </div>
                </div>
            </div>
            
            <!-- 镜像源设置 -->
            <div class="section">
                <text class="section-title">镜像源设置</text>
                
                <div class="info-card">
                    <text class="card-subtitle">选择镜像源加速下载</text>
                    
                    <div class="mirror-slider-container">
                        <scroller class="mirror-slider-scroller" scroll-direction="horizontal" :show-scrollbar="false">
                            <div class="mirror-slider-content">
                                <text v-for="mirror in mirrors"
                                      :key="mirror.id"
                                      :class="'mirror-slider-item ' + (selectedMirror===mirror.id?'mirror-slider-item-selected':'')"
                                      @click="selectMirror(mirror.id)">
                                    {{ mirror.buttonName }}
                                </text>
                            </div>
                        </scroller>
                    </div>
                    
                    <div class="mirror-status-info">
                        <text class="mirror-current">{{ currentMirror.name }}</text>
                        <text :class="'mirror-status ' + (useMirror?'mirror-status-active':'mirror-status-disabled')">
                            {{ useMirror?'已启用':'未启用' }}
                        </text>
                    </div>
                </div>
            </div>
            
            <!-- 更新说明 -->
            <div v-if="releaseNotes" class="section">
                <text class="section-title">更新说明</text>
                
                <div class="info-card">
                    <scroller class="release-notes" scroll-direction="vertical" :show-scrollbar="true">
                        <text class="release-content">{{ releaseNotes }}</text>
                    </scroller>
                </div>
            </div>
            
            <!-- 文件信息 -->
            <div v-if="latestVersion && fileSize > 0" class="section">
                <text class="section-title">文件信息</text>
                
                <div class="info-card">
                    <div class="file-info-line">
                        <text class="file-label">文件大小:</text>
                        <text class="file-value">{{ formattedFileSize }}</text>
                    </div>
                    
                    <div class="file-info-line">
                        <text class="file-label">文件名:</text>
                        <text class="file-value">{{ currentDeviceFilename }}</text>
                    </div>
                </div>
            </div>
            
            <!-- 操作按钮 -->
            <div class="section">
                <text class="section-title">操作</text>
                
                <div class="operations-card">
                    <div v-if="hasUpdate && status==='available'" class="link-item" @click="downloadUpdate">
                        <image class="image-icon" resize="contain" :src="require('./images/download.png')" />
                        <text class="link-text">下载并安装更新</text>
                    </div>
                    
                    <div v-else class="text-item">
                        <image class="image-icon" resize="contain" :src="require('./images/info.png')" />
                        <text class="text-content">{{ status === 'downloading' || status === 'installing' ? '正在处理...' : '暂无更新' }}</text>
                    </div>
                    
                    <div class="link-item" @click="openGitHub">
                        <image class="image-icon" resize="contain" :src="require('./images/repo.png')" />
                        <text class="link-text">GitHub 页面</text>
                    </div>
                    
                    <div class="text-item">
                        <image class="image-icon" resize="contain" :src="require('./images/device.png')" />
                        <text class="text-content">设备: {{ deviceModel }}</text>
                    </div>
                </div>
            </div>
            
            <!-- 使用说明 -->
            <div class="section">
                <text class="section-title">使用说明</text>
                
                <div class="info-card">
                    <text class="instruction-text">
                        1. 点击"检查更新"按钮获取最新版本信息
                        2. 左右滑动选择镜像源，点击按钮切换
                        3. 如果有新版本，点击"下载并安装更新"按钮
                        4. 下载完成后会自动安装
                        5. 安装完成后请重启应用
                        6. 如果自动更新失败，可以手动下载安装
                    </text>
                </div>
            </div>
        </scroller>
        <Loading />
        <ToastMessage />
    </div>
</template>