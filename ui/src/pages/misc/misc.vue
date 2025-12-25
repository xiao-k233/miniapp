<template>
  <div class="container">

    <!-- 标题 -->
    <div class="header">
      <text class="title">杂项</text>
    </div>

    <!-- 屏幕亮度 -->
    <div class="control-card">
      <text class="control-title">屏幕亮度</text>
      <div class="value">{{ brightness }}%</div>
      <slider
        min="1"
        max="100"
        :value="brightness"
        @changing="onBrightnessChange"
      />
    </div>

    <!-- 亮屏时间 -->
    <div class="control-card">
      <text class="control-title">亮屏时间</text>
      <div class="value">{{ screenTimeText }}</div>
      <slider
        min="0"
        max="5"
        step="1"
        :value="screenTimeIndex"
        @change="onScreenTimeChange"
      />
    </div>

    <!-- 手电 -->
    <div class="control-card">
      <text class="control-title">手电筒</text>
      <div
        class="toggle-btn"
        :class="{ on: torchOn }"
        @click="toggleTorch"
      >
        {{ torchOn ? '已开启' : '已关闭' }}
      </div>
    </div>

  </div>
</template>

<style lang="less" scoped>
@import './misc.less';
</style>

<script>
import misc from './misc';
export default misc;
</script>
