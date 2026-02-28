<template>
  <div class="camera-container">
    <div class="preview-area" ref="previewArea">
      <hole class="camera-hole"></hole>
    </div>
    <div class="controls-area">
      <div :class="['btn', 'btn-shutter', isCapturing ? 'btn-disabled' : '']" @click="takePhoto">
        <text class="btn-text text-dark">{{ isCapturing ? '拍照中' : '拍照' }}</text>
      </div>
    </div>
    <ToastMessage />
  </div>
</template>

<style lang="less" scoped>
@import url('camera.less');
</style>

<script>
import ToastMessage from '../../components/ToastMessage.vue';
import camera from './camera';
export default {
    ...camera,
    components: {
        ToastMessage
    }
}
</script>
