<template>
  <div class="container">
    <scroller class="scroll-area" scroll-direction="vertical">

      <div class="header">
        <text class="title">杂项</text>
      </div>

      <!-- 亮屏时间 -->
      <div class="block">
        <text class="label">亮屏时间</text>
        <div class="btn-row">
          <text class="btn" @click="setBrightTime(30, '30 秒')">30秒</text>
          <text class="btn" @click="setBrightTime(1800, '30 分钟')">30分钟</text>
          <text class="btn" @click="setBrightTime(3600, '1 小时')">1小时</text>
        </div>
        <div class="btn-row">
          <text class="btn" @click="setBrightTime(7200, '2 小时')">2小时</text>
          <text class="btn" @click="setBrightTime(10800, '3 小时')">3小时</text>
          <text class="btn" @click="setBrightTime(2147483647, '无限')">无限</text>
        </div>
      </div>

      <!-- 屏幕亮度 -->
      <div class="block">
        <text class="label">屏幕亮度</text>
        <div class="btn-row">
          <text class="btn" @click="setBrightness(30)">低</text>
          <text class="btn" @click="setBrightness(60)">中</text>
          <text class="btn" @click="setBrightness(100)">高</text>
        </div>
      </div>

      <!-- 手电筒 -->
      <div class="block">
        <text class="label">手电筒</text>
        <text class="btn wide" @click="toggleTorch">
          {{ torchOn ? '关闭手电' : '打开手电' }}
        </text>
      </div>

    </scroller>
  </div>
</template>

<style lang="less" scoped>
@import './misc.less';
</style>

<script>
import misc from './misc';
export default misc;
</script>
