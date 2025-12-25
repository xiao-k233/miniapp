<template>
    <div class="container">
        <section>
            <text class="section-title">杂项</text>
        </section>

        <!-- 屏幕亮度 -->
        <section>
            <text class="label">屏幕亮度：{{ brightness }}%</text>
            <slider min="1" max="100" :value="brightness" @change="onBrightnessChange" />
        </section>

        <!-- 亮屏时间 -->
        <section>
            <text class="label">亮屏时间：{{ brightTimeText }}</text>
            <slider min="0" max="5" step="1" :value="brightTimeIndex" @change="onBrightTimeChange" />
        </section>

        <!-- 手电 -->
        <section>
            <text class="btn" @click="toggleTorch">
                {{ torchOn ? '关闭手电' : '打开手电' }}
            </text>
        </section>
    </div>
</template>

<style lang="less" scoped>
@import './misc.less';
</style>

<script>
import misc from './misc';
export default misc;
</script>
