<template>
  <div class="container">

    <!-- 可滚动区域：只放展示文本 -->
    <scroller class="scroll-area" scroll-direction="vertical">
      <div class="header">
        <text class="title">杂项</text>
      </div>

      <div class="info">
        <text class="info-text">本页面包含屏幕、亮度、电源等系统级功能。</text>
        <text class="info-text">滑块拖动后立即生效。</text>
      </div>

      <!-- 亮屏时间（可以放在 scroller 内，因为是纵向滑动） -->
      <div class="block">
        <text class="label">亮屏时间：{{ brightTimeText }}</text>
        <slider
          min="0"
          max="5"
          step="1"
          :value="brightTimeIndex"
          @change="onBrightTimeChange"
        />
      </div>
    </scroller>

    <!-- 固定操作区：放所有横向交互控件 -->
    <div class="control-area">
      <div class="block">
        <text class="label">屏幕亮度：{{ brightness }}%</text>
        <slider
          min="1"
          max="100"
          :value="brightness"
          @change="onBrightnessChange"
        />
      </div>

      <div class="block">
        <text class="btn" @click="toggleTorch">
          {{ torchOn ? '关闭手电' : '打开手电' }}
        </text>
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
