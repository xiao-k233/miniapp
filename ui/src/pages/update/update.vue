<template>
<div>
<scroller class="container" scroll-direction="vertical" :show-scrollbar="true">

<div class="section">
<text class="section-title">软件更新</text>
<div class="item">
<text class="item-text">更新状态:</text>
<text :class="'update-status ' + statusClass">{{statusText}}</text>
<text @click="forceCheck" class="btn btn-primary">检查更新</text>
</div>

<div class="item">
<text class="item-text">系统状态:</text>
<text :class="'update-status ' + apiStatusClass">{{apiStatusText}}</text>
<text @click="showConfigInfo" class="btn btn-info">查看配置</text>
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
:class="'mirror-slider-item ' + (selectedMirror===mirror.id?'mirror-slider-item-selected':'')"
@click="selectMirror(mirror.id)">{{mirror.buttonName}}</text>
</div>
</scroller>
</div>

<div class="mirror-status-info">
<text class="mirror-current">当前: {{currentMirror.name}}</text>
<text :class="'mirror-status ' + (useMirror?'mirror-status-active':'mirror-status-disabled')">{{useMirror?'镜像加速已启用':'镜像加速未启用'}}</text>
</div>

<div style="flex-direction:row;gap:5px;margin-top:5px;">
<text @click="testMirrorConnection" class="operation-btn operation-btn-info">测试连接</text>
<text @click="showCurrentUrl" class="operation-btn operation-btn-info">查看URL</text>
<text @click="showDeviceInfo" class="operation-btn operation-btn-info">设备信息</text>
</div>

<!-- 下载按钮和GitHub页面按钮放在这里 -->
<div style="flex-direction:row;gap:5px;margin-top:10px;">
<text v-if="hasUpdate && status==='available'" 
      @click="downloadUpdate" 
      class="btn btn-success" style="flex:1;text-align:center;">下载并安装</text>
<text v-else-if="status==='downloading'||status==='installing'" 
      class="btn btn-disabled" 
      style="flex:1;text-align:center;opacity:0.5;">正在处理...</text>
<text v-else class="btn btn-disabled" style="flex:1;text-align:center;opacity:0.5;">暂无更新</text>
</div>

<div style="flex-direction:row;gap:5px;margin-top:5px;">
<text @click="openGitHub" class="operation-btn operation-btn-primary" style="flex:1;text-align:center;">GitHub页面</text>
</div>
</div>
</div>

<div v-if="latestVersion" class="section">
<text class="section-title">版本信息</text>
<div class="version-info">
<div class="version-line">
<text class="version-label">设备型号:</text>
<text class="version-value">{{deviceModel}}</text>
</div>
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
<div v-if="publishedAt" class="version-line">
<text class="version-label">发布时间:</text>
<text class="version-value">{{formattedPublishedDate}}</text>
</div>
<div v-if="assetName" class="version-line">
<text class="version-label">更新文件:</text>
<text class="version-value">{{assetName}}</text>
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
<text class="section-title">使用说明</text>
<text style="font-size:14px;color:#888888;line-height:20px;padding:5px;">
1. 点击"检查更新"按钮获取最新版本信息
2. 左右滑动选择镜像源，点击按钮切换
3. 点击"测试连接"检查镜像源是否可用
4. 系统会自动匹配您的设备型号: {{deviceModel}}
5. 如果有新版本，点击"下载并安装更新"按钮
6. 下载完成后会自动安装
7. 安装完成后请重启应用
8. 如果自动更新失败，可以手动下载安装
</text>
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
