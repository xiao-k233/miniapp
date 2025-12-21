<template>
  <div class="container">
    <!-- 设备信息显示区域 -->
    <div class="info-content">
      <scroller 
        class="info-scroller"
        scroll-direction="vertical"
        :show-scrollbar="true"
      >
        <!-- 标题区域 - 现在是滚动内容的一部分 -->
        <div class="header-section">
          <div class="title-row">
            <text class="title">设备信息</text>
            <div 
              class="refresh-btn" 
              @click="refreshInfo"
            >
              <text class="refresh-icon">{{ isRefreshing ? '⟳' : '↻' }}</text>
            </div>
          </div>
        </div>
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-container">
          <text class="loading-text">正在加载设备信息...</text>
        </div>
        
        <!-- 错误信息 -->
        <div v-else-if="deviceInfo.error">
          <div class="info-item">
            <text class="item-label">错误信息</text>
            <text class="item-value error-value">{{ deviceInfo.error }}</text>
          </div>
        </div>
        
        <!-- 正常显示设备信息 -->
        <div v-else>
          <!-- IP地址信息 -->
          <div class="info-item">
            <text class="item-label">IP地址</text>
            <text class="item-value">{{ formatIP(deviceInfo.ipAddress) }}</text>
          </div>
          
          <!-- 设备标识 -->
          <div class="info-item">
            <text class="item-label">设备ID</text>
            <text class="item-value">{{ deviceInfo.deviceId || '未知' }}</text>
          </div>
          
          <!-- 系统信息 -->
          <div class="info-item">
            <text class="item-label">设备型号</text>
            <text class="item-value">{{ deviceInfo.systemInfo && deviceInfo.systemInfo.model ? deviceInfo.systemInfo.model : '未知' }}</text>
          </div>
          <div class="info-item">
            <text class="item-label">内核版本</text>
            <text class="item-value">{{ deviceInfo.systemInfo && deviceInfo.systemInfo.kernel ? deviceInfo.systemInfo.kernel : '未知' }}</text>
          </div>
          <div class="info-item">
            <text class="item-label">系统版本</text>
            <text class="item-value">{{ deviceInfo.systemInfo && deviceInfo.systemInfo.version ? deviceInfo.systemInfo.version : '未知' }}</text>
          </div>
          
          <!-- 存储信息 -->
          <div class="info-item">
            <text class="item-label">总空间</text>
            <text class="item-value">{{ deviceInfo.storageInfo && deviceInfo.storageInfo.total ? deviceInfo.storageInfo.total : '未知' }}</text>
          </div>
          <div class="info-item">
            <text class="item-label">已使用</text>
            <text class="item-value">{{ deviceInfo.storageInfo && deviceInfo.storageInfo.used ? deviceInfo.storageInfo.used : '未知' }}</text>
          </div>
          <div class="info-item">
            <text class="item-label">可用空间</text>
            <text class="item-value">{{ deviceInfo.storageInfo && deviceInfo.storageInfo.free ? deviceInfo.storageInfo.free : '未知' }}</text>
          </div>
          
          <!-- 网络接口详情 -->
          <div v-if="deviceInfo.networkInfo && deviceInfo.networkInfo.interfaces && deviceInfo.networkInfo.interfaces !== '获取失败'">
            <div class="info-item">
              <text class="item-label">网络接口</text>
              <text class="item-value">{{ deviceInfo.networkInfo.interfaces || '无网络接口信息' }}</text>
            </div>
          </div>
          
          <!-- 时间戳 -->
          <div class="info-item">
            <text class="item-label">最后更新</text>
            <text class="item-value">{{ deviceInfo.timestamp ? new Date(deviceInfo.timestamp).toLocaleString() : new Date().toLocaleString() }}</text>
          </div>
        </div>
      </scroller>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('deviceinfo.less');
</style>

<script>
import deviceinfo from './deviceinfo';
export default deviceinfo;
</script>