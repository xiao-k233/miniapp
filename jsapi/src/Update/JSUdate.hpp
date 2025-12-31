// Copyright (C) 2025 Langning Chen
//
// This file is part of miniapp.
//
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

#pragma once

#include "Update.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>

using namespace JQUTIL_NS;

class JSUdate : public JQPublishObject {
private:
    std::unique_ptr<Update> updateObject;
    mutable std::mutex updateMutex;

    Update* getUpdateObject() const {
        std::lock_guard<std::mutex> lock(updateMutex);
        return updateObject.get();
    }

public:
    JSUdate();
    ~JSUdate();

    // 初始化
    void initialize(JQFunctionInfo& info);
    
    // Manifest 相关
    void setManifestDirectory(JQFunctionInfo& info);
    void getCurrentVersion(JQFunctionInfo& info);
    void getAppName(JQFunctionInfo& info);
    
    // 发布源设置
    void setReleaseUrl(JQFunctionInfo& info);
    void getReleaseUrl(JQFunctionInfo& info);
    
    // 下载设置
    void setDownloadDirectory(JQFunctionInfo& info);
    void getDownloadDirectory(JQFunctionInfo& info);
    
    // 更新检查
    void checkForUpdates(JQAsyncInfo& info);
    void getUpdateInfo(JQAsyncInfo& info);
    
    // 下载和安装
    void downloadUpdate(JQAsyncInfo& info);
    void installUpdate(JQAsyncInfo& info);
    void updateManifest(JQAsyncInfo& info);
    
    // 控制
    void cancelDownload(JQFunctionInfo& info);
    void isDownloading(JQFunctionInfo& info);
    
    // 工具
    void verifyFileIntegrity(JQAsyncInfo& info);
    void cleanupOldVersions(JQFunctionInfo& info);
    
    // 事件发布
    void publishDownloadProgress(size_t downloaded, size_t total, 
                                double percentage, const std::string& file_path);
};

extern JSValue createUpdate(JQModuleEnv* env);