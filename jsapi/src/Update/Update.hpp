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

#include <string>
#include <functional>
#include <memory>
#include <mutex>
#include <atomic>
#include <vector>
#include <filesystem>
#include "Fetch.hpp"
#include <nlohmann/json.hpp>

namespace fs = std::filesystem;

struct UpdateInfo {
    std::string version;
    std::string name;
    std::string description;
    std::string release_date;
    std::string download_url;
    std::string checksum_sha256;
    size_t file_size;
    std::string min_system_version;
    std::string release_notes;
    std::string manifest_path;  // 新增：manifest.json 的下载路径
    
    static UpdateInfo fromJson(const nlohmann::json& json);
    nlohmann::json toJson() const;
    
    // 比较版本号
    bool isNewerThan(const std::string& other_version) const;
};

struct DownloadProgress {
    size_t downloaded_bytes;
    size_t total_bytes;
    double percentage;
    double speed_kbps;
    std::string status;
    std::string file_path;
};

using DownloadCallback = std::function<void(const DownloadProgress& progress)>;

class Update {
private:
    std::string current_release_url;
    std::string update_json_url;
    std::string download_directory;
    std::string manifest_directory;  // manifest.json 所在目录
    std::mutex download_mutex;
    std::atomic<bool> is_downloading{false};
    std::shared_ptr<std::atomic<bool>> cancel_download;
    
    // 从发布URL提取下载URL
    std::string extractDownloadUrl(const std::string& release_url);
    
    // 版本比较辅助函数
    static std::vector<int> parseVersion(const std::string& version_str);
    static bool compareVersions(const std::string& v1, const std::string& v2);
    
public:
    Update();
    ~Update();
    
    // 设置 manifest 目录路径
    void setManifestDirectory(const std::string& directory);
    
    // 从 manifest.json 读取当前版本
    std::string getCurrentVersion() const;
    std::string getAppName() const;
    
    // 设置 GitHub release URL
    void setReleaseUrl(const std::string& release_url);
    std::string getReleaseUrl() const;
    
    // 设置下载目录
    void setDownloadDirectory(const std::string& directory);
    std::string getDownloadDirectory() const;
    
    // 获取更新信息
    UpdateInfo checkForUpdates();
    UpdateInfo getUpdateInfo(const std::string& update_json_url);
    
    // 下载更新
    bool downloadUpdate(const UpdateInfo& update_info, 
                       DownloadCallback progress_callback = nullptr);
    
    // 安装更新（支持 AMR 文件）
    bool installUpdate(const std::string& file_path);
    
    // 下载并更新 manifest.json
    bool updateManifest(const UpdateInfo& update_info);
    
    // 取消下载
    void cancelDownload();
    
    // 检查是否正在下载
    bool isDownloading() const;
    
    // 验证文件完整性
    bool verifyFileIntegrity(const std::string& file_path, 
                            const std::string& expected_checksum);
    
    // 清理旧版本文件
    void cleanupOldVersions(const std::string& keep_version);
};
