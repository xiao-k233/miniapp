<template>
<div>
<scroller class="container" scroll-direction="vertical" :show-scrollbar="true">

<div class="section">
<text class="section-title">软件更新</text>
<div class="item">
<text class="item-text">更新状态:</text>
<text :class="'update-status '+statusClass">{{statusText}}</text>
<text @click="forceCheck" class="btn btn-primary">检查更新</text>
</div>

<div v-if="errorMessage" class="item">
<text class="item-text" style="color:#dc3545;">错误:</text>
<text class="item-text" style="color:#dc3545;flex:1;">{{errorMessage}}</text>
</div>
</div>

<div class="section">
<text class="section-title">下载设置</text>

<div class="mirror-settings">
<div class="mirror-slider-container">
<text class="mirror-slider-label">镜像源:</text>
<scroller class="mirror-slider-scroller" scroll-direction="horizontal" :show-scrollbar="false">
<div class="mirror-slider-content">
<text v-for="mirror in mirrors"
:key="mirror.id"
:class="'mirror-slider-item '+(selectedMirror===mirror.id?'mirror-slider-item-selected':'')"
@click="selectMirror(mirror.id)">{{mirror.buttonName}}</text>
</div>
</scroller>
</div>

<div class="mirror-status-info">
<text class="mirror-current">{{currentMirror.name}}</text>
<text :class="'mirror-status '+(useMirror?'mirror-status-active':'mirror-status-disabled')">{{useMirror?'镜像加速已启用':'镜像加速未启用'}}</text>
</div>
</div>
</div>

<div v-if="latestVersion" class="section">
<text class="section-title">版本信息</text>
<div class="version-info">
<div class="version-line">
<text class="version-label">当前版本:</text>
<text class="version-value version-old">{{currentVersion}}</text>
</div>
<div class="version-line">
<text class="version-label">最新版本:</text>
<text class="version-value version-new">{{latestVersion}}</text>
</div>
<div v-if="fileSize>0" class="version-line">
<text class="version-label">文件大小:</text>
<text class="version-value">{{formattedFileSize}}</text>
</div>
</div>
</div>

<div v-if="releaseNotes" class="section">
<text class="section-title">更新说明</text>
<scroller class="release-notes" scroll-direction="vertical">
<text style="color:#ffffff;">{{releaseNotes}}</text>
</scroller>
</div>

<div class="section">
<text class="section-title">操作</text>
<div class="item">
<text v-if="hasUpdate&&status==='available'" @click="downloadUpdate" class="btn btn-success">下载并安装更新</text>
<text v-else-if="status==='downloading'||status==='installing'" class="btn btn-disabled" style="opacity:0.5;">正在处理...</text>
<text v-else class="btn btn-disabled" style="opacity:0.5;">暂无更新</text>
</div>

<div class="operations-grid">
<text @click="openGitHub" class="operation-btn operation-btn-info">GitHub页面</text>
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
