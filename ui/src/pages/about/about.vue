<!--
 Copyright (C) 2025 Langning Chen
 
 This file is part of miniapp.
 
 miniapp is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 miniapp is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with miniapp.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
    <div>
        <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
            <!-- 项目信息 -->
            <div class="section">
                <text class="section-title">关于应用</text>
                
                <div class="info-card">
                    <text class="project-title">{{ projectName }}</text>
                    <text class="project-description">{{ description }}</text>
                </div>
            </div>
            
            <!-- 鸣谢 -->
            <div class="section">
                <text class="section-title">开发团队</text>
                
                <div class="credits-section">
                    <text class="credit-title">核心开发者</text>
                    <text class="credit-names">{{ getCreditsText() }}</text>
                </div>
            </div>
            
            <!-- 项目链接 -->
            <div class="section">
                <text class="section-title">项目信息</text>
                
                <div class="link-item" @click="openGitHub">
                    <text class="link-icon">🌐</text>
                    <text class="link-text">GitHub: {{ githubRepo }}</text>
                </div>
                
                <div class="link-item" @click="goToUpdate">
                    <text class="link-icon">🔄</text>
                    <text class="link-text">Update页面入口</text>
                </div>
                
                <div class="link-item">
                    <text class="link-icon">📄</text>
                    <text class="link-text">许可证: GNU General Public License v3.0</text>
                </div>
            </div>
        </scroller>
    </div>
</template>

<style lang="less" scoped>
@import url('about.less');
</style>

<script>
import about from './about';
export default {
    ...about
};
</script>
