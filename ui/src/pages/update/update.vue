<template>
<div>
<scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
<!-- 更新状态 -->
<div class="section">
<text class="section-title">更新状态</text>
<div class="info-card">
<div class="status-line">
<text class="status-label">状态:</text>
<text :class="'status-value ' + statusClass">{{statusText}}</text>
</div>
<div class="version-line">
<text class="version-label">设备型号:</text>
<text class="version-text">{{deviceModel}}</text>
</div>
<div class="version-line">
<text class="version-label">当前版本:</text>
<text class="version-text version-old">v{{currentVersion}}</text>
</div>
<div v-if="latestVersion" class="version-line">
<text class="version-label">最新版本:</text>
<text class="version-text version-new">v{{latestVersion}}</text>
</div>
<div v-if="latestVersion" class="version-line">
<text class="version-label">版本比较:</text>
<text :class="'version-text ' + versionCompareClass">{{versionCompareText}}</text>
</div>
<div class="version-line">
<text class="version-label">当前仓库:</text>
<text class="version-text">{{currentRepoFullName}}</text>
</div>
<div class="version-line">
<text class="version-label">仓库类型:</text>
<text :class="'version-text ' + (currentRepo === 'release' ? 'repo-type-release' : 'repo-type-dev')">{{currentRepo === 'release' ? '发布版' : '开发版'}}</text>
</div>

<!-- 按钮组 -->
<div class="button-row">
<div @click="switchRepo" :class="'action-btn repo-btn ' + (repoButtonDisabled?'disabled':'')">
<text class="btn-text">{{repoButtonText}}</text>
</div>
<div @click="handleCheckUpdate" :class="'action-btn main-btn ' + (downloadButtonDisabled?'disabled':'')">
<text class="btn-text">{{downloadButtonText}}</text>
</div>
</div>

<div class="button-row">
<div @click="toggleUnlock" :class="['action-btn', unlockButtonClass, repoButtonDisabled?'disabled':'']">
<text class="btn-text">{{unlockButtonText}}</text>
</div>
<!-- 安装按钮：根据canInstall状态动态切换类 -->
<div @click="downloadUpdate" :class="['action-btn', installButtonClass, installButtonDisabled?'disabled':'']">
<text class="btn-text">{{installButtonText}}</text>
</div>
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
@click="selectMirror(mirror.id)">{{mirror.buttonName}}</text>
</div>
</scroller>
</div>
<div class="mirror-status-info">
<text class="mirror-current">{{currentMirror.name}}</text>
<text :class="'mirror-status ' + (useMirror?'mirror-status-active':'mirror-status-disabled')">{{useMirror?'已启用':'未启用'}}</text>
</div>
</div>
</div>

<!-- 更新说明 -->
<div v-if="releaseNotes" class="section">
<text class="section-title">更新说明</text>
<div class="info-card">
<scroller class="release-notes" scroll-direction="vertical" :show-scrollbar="true">
<text class="release-content">{{releaseNotes}}</text>
</scroller>
</div>
</div>

<!-- 文件信息 -->
<div v-if="latestVersion && fileSize > 0" class="section">
<text class="section-title">文件信息</text>
<div class="info-card">
<div class="file-info-line">
<text class="file-label">文件大小:</text>
<text class="file-value">{{formattedFileSize}}</text>
</div>
<div class="file-info-line">
<text class="file-label">文件名:</text>
<text class="file-value">{{currentDeviceFilename}}</text>
</div>
<div v-if="unlockInstall" class="file-info-line unlock-notice">
<text class="file-label">注意:</text>
<text class="file-value">解锁模式下可安装任意版本（需设备匹配）</text>
</div>
</div>
</div>

<!-- 操作按钮 -->
<div class="section">
<text class="section-title">操作</text>
<div class="operations-card">
<div class="link-item" @click="openGitHub">
<text class="link-text">GitHub 页面 ({{currentRepo}})</text>
</div>
<div class="link-item" @click="toggleUnlock">
<text class="link-text">{{unlockInstall ? '锁定安装限制' : '解锁安装限制'}}</text>
</div>
<div class="text-item">
<text class="text-content">设备: {{deviceModel}} | 仓库: {{currentRepo}} | 解锁: {{unlockInstall ? '是' : '否'}}</text>
</div>
</div>
</div>

<!-- 使用说明 -->
<div class="section">
<text class="section-title">使用说明</text>
<div class="info-card">
<text class="instruction-text">1. 点击"检查更新"按钮获取最新版本信息
2. 左右滑动选择镜像源，点击按钮切换
3. 点击"切换到开发版/发布版"切换更新源
4. 点击"解锁安装"可安装任意版本（需设备匹配）
5. 右侧按钮显示当前可用的安装选项：
   - 解锁前：只有新版本显示"安装"，否则显示"暂无更新"
   - 解锁后：新版本显示"安装"，旧版本显示"回退"，相同版本显示"安装"
6. 下载完成后会自动安装
7. 安装完成后请重启应用
8. 如果自动更新失败，可以手动下载安装</text>
</div>
</div>
</scroller>
<Loading/>
<ToastMessage/>
</div>
</template>

<style lang="less" scoped>
@import url('update.less');
</style>

<script>
import update from './update';
import Loading from '../../components/Loading.vue';
import ToastMessage from '../../components/ToastMessage.vue';
export default{...update,components:{Loading,ToastMessage}};
</script>