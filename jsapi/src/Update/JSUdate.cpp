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

#include "JSUdate.hpp"
#include <iostream>
#include <nlohmann/json.hpp>

JSUdate::JSUdate() : updateObject(nullptr) {}

JSUdate::~JSUdate() {}

void JSUdate::initialize(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 0);
        std::lock_guard<std::mutex> lock(updateMutex);
        updateObject = std::make_unique<Update>();
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::setManifestDirectory(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        JSContext* ctx = info.GetContext();
        std::string directory = JQString(ctx, info[0]).getString();
        
        update->setManifestDirectory(directory);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::getCurrentVersion(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        info.GetReturnValue().Set(update->getCurrentVersion());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::getAppName(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        info.GetReturnValue().Set(update->getAppName());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::setReleaseUrl(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        JSContext* ctx = info.GetContext();
        std::string release_url = JQString(ctx, info[0]).getString();
        
        update->setReleaseUrl(release_url);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::getReleaseUrl(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        info.GetReturnValue().Set(update->getReleaseUrl());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::setDownloadDirectory(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        JSContext* ctx = info.GetContext();
        std::string directory = JQString(ctx, info[0]).getString();
        
        update->setDownloadDirectory(directory);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::getDownloadDirectory(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        info.GetReturnValue().Set(update->getDownloadDirectory());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::checkForUpdates(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        UpdateInfo update_info = update->checkForUpdates();
        std::string current_version = update->getCurrentVersion();
        
        Bson::object result = {
            {"version", update_info.version},
            {"name", update_info.name},
            {"description", update_info.description},
            {"release_date", update_info.release_date},
            {"download_url", update_info.download_url},
            {"checksum_sha256", update_info.checksum_sha256},
            {"file_size", static_cast<int64_t>(update_info.file_size)},
            {"min_system_version", update_info.min_system_version},
            {"release_notes", update_info.release_notes},
            {"manifest_path", update_info.manifest_path},
            {"current_version", current_version},
            {"has_update", update_info.isNewerThan(current_version)}
        };
        
        info.post(result);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::getUpdateInfo(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string update_json_url = info[0].string_value();
        UpdateInfo update_info = update->getUpdateInfo(update_json_url);
        
        Bson::object result = {
            {"version", update_info.version},
            {"name", update_info.name},
            {"description", update_info.description},
            {"release_date", update_info.release_date},
            {"download_url", update_info.download_url},
            {"checksum_sha256", update_info.checksum_sha256},
            {"file_size", static_cast<int64_t>(update_info.file_size)},
            {"min_system_version", update_info.min_system_version},
            {"release_notes", update_info.release_notes},
            {"manifest_path", update_info.manifest_path}
        };
        
        info.post(result);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::downloadUpdate(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        
        // 解析 UpdateInfo 对象
        JSContext* ctx = info.GetContext();
        JQObject js_obj(ctx, info[0]);
        
        UpdateInfo update_info;
        update_info.version = js_obj.getString("version");
        update_info.name = js_obj.getString("name");
        update_info.description = js_obj.getString("description");
        update_info.release_date = js_obj.getString("release_date");
        update_info.download_url = js_obj.getString("download_url");
        update_info.checksum_sha256 = js_obj.getString("checksum_sha256");
        update_info.file_size = js_obj.getInt("file_size");
        update_info.min_system_version = js_obj.getString("min_system_version");
        update_info.release_notes = js_obj.getString("release_notes");
        update_info.manifest_path = js_obj.getString("manifest_path");
        
        // 创建进度回调
        DownloadCallback progress_callback = [this](const DownloadProgress& progress) {
            publishDownloadProgress(progress.downloaded_bytes, 
                                  progress.total_bytes, 
                                  progress.percentage,
                                  progress.file_path);
        };
        
        bool success = update->downloadUpdate(update_info, progress_callback);
        info.post(success);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::installUpdate(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string file_path = info[0].string_value();
        bool success = update->installUpdate(file_path);
        info.post(success);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::updateManifest(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        
        // 解析 UpdateInfo 对象
        JSContext* ctx = info.GetContext();
        JQObject js_obj(ctx, info[0]);
        
        UpdateInfo update_info;
        update_info.version = js_obj.getString("version");
        update_info.name = js_obj.getString("name");
        update_info.manifest_path = js_obj.getString("manifest_path");
        
        bool success = update->updateManifest(update_info);
        info.post(success);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::cancelDownload(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        update->cancelDownload();
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::isDownloading(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 0);
        
        info.GetReturnValue().Set(update->isDownloading());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::verifyFileIntegrity(JQAsyncInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 2);
        ASSERT(info[0].is_string());
        ASSERT(info[1].is_string());
        
        std::string file_path = info[0].string_value();
        std::string expected_checksum = info[1].string_value();
        
        bool valid = update->verifyFileIntegrity(file_path, expected_checksum);
        info.post(valid);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSUdate::cleanupOldVersions(JQFunctionInfo& info) {
    try {
        Update* update = getUpdateObject();
        ASSERT(update != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string keep_version = info[0].string_value();
        update->cleanupOldVersions(keep_version);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSUdate::publishDownloadProgress(size_t downloaded, size_t total, 
                                     double percentage, const std::string& file_path) {
    Bson::object progress = {
        {"downloaded", static_cast<int64_t>(downloaded)},
        {"total", static_cast<int64_t>(total)},
        {"percentage", percentage},
        {"file_path", file_path},
        {"status", "downloading"}
    };
    publish("update_download_progress", progress);
}

JSValue createUpdate(JQModuleEnv* env) {
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Update");
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSUdate();
    });

    tpl->SetProtoMethod("initialize", &JSUdate::initialize);
    
    // Manifest 相关
    tpl->SetProtoMethod("setManifestDirectory", &JSUdate::setManifestDirectory);
    tpl->SetProtoMethod("getCurrentVersion", &JSUdate::getCurrentVersion);
    tpl->SetProtoMethod("getAppName", &JSUdate::getAppName);
    
    // 发布源设置
    tpl->SetProtoMethod("setReleaseUrl", &JSUdate::setReleaseUrl);
    tpl->SetProtoMethod("getReleaseUrl", &JSUdate::getReleaseUrl);
    
    // 下载设置
    tpl->SetProtoMethod("setDownloadDirectory", &JSUdate::setDownloadDirectory);
    tpl->SetProtoMethod("getDownloadDirectory", &JSUdate::getDownloadDirectory);
    
    // 更新检查
    tpl->SetProtoMethodPromise("checkForUpdates", &JSUdate::checkForUpdates);
    tpl->SetProtoMethodPromise("getUpdateInfo", &JSUdate::getUpdateInfo);
    
    // 下载和安装
    tpl->SetProtoMethodPromise("downloadUpdate", &JSUdate::downloadUpdate);
    tpl->SetProtoMethodPromise("installUpdate", &JSUdate::installUpdate);
    tpl->SetProtoMethodPromise("updateManifest", &JSUdate::updateManifest);
    
    // 控制
    tpl->SetProtoMethod("cancelDownload", &JSUdate::cancelDownload);
    tpl->SetProtoMethod("isDownloading", &JSUdate::isDownloading);
    
    // 工具
    tpl->SetProtoMethodPromise("verifyFileIntegrity", &JSUdate::verifyFileIntegrity);
    tpl->SetProtoMethod("cleanupOldVersions", &JSUdate::cleanupOldVersions);

    JSUdate::InitTpl(tpl);
    return tpl->CallConstructor();
}