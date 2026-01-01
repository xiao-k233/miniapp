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
#include <Exceptions/AssertFailed.hpp>  // 添加 ASSERT 宏
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

    void initialize(JQFunctionInfo& info);
    
    void setManifestDirectory(JQFunctionInfo& info);
    void getCurrentVersion(JQFunctionInfo& info);
    void getAppName(JQFunctionInfo& info);
    
    void setReleaseUrl(JQFunctionInfo& info);
    void getReleaseUrl(JQFunctionInfo& info);
    
    void setDownloadDirectory(JQFunctionInfo& info);
    void getDownloadDirectory(JQFunctionInfo& info);
    
    void checkForUpdates(JQAsyncInfo& info);
    void getUpdateInfo(JQAsyncInfo& info);
    
    void downloadUpdate(JQAsyncInfo& info);
    void installUpdate(JQAsyncInfo& info);
    void updateManifest(JQAsyncInfo& info);
    
    void cancelDownload(JQFunctionInfo& info);
    void isDownloading(JQFunctionInfo& info);
    
    void verifyFileIntegrity(JQAsyncInfo& info);
    void cleanupOldVersions(JQFunctionInfo& info);
    void verifyFileSize(JQAsyncInfo& info);
    
    void publishDownloadProgress(size_t downloaded, size_t total, 
                                double percentage, const std::string& file_path);
};

extern JSValue createUpdate(JQModuleEnv* env);
