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

#include "Update.hpp"
#include "strUtils.hpp"
#include <Exceptions/NetworkError.hpp>
#include <Exceptions/AssertFailed.hpp>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <regex>
#include <thread>
#include <chrono>
#include <curl/curl.h>

#ifdef _WIN32
#include <windows.h>
#else
#include <unistd.h>
#include <sys/stat.h>
#endif

// 添加 OpenSSL 头文件用于 SHA256
#include <openssl/sha.h>

UpdateInfo UpdateInfo::fromJson(const nlohmann::json& json) {
    UpdateInfo info;
    info.version = json.value("version", "");
    info.name = json.value("name", "");
    info.description = json.value("description", "");
    info.release_date = json.value("release_date", "");
    info.download_url = json.value("download_url", "");
    info.checksum_sha256 = json.value("checksum_sha256", "");
    info.file_size = json.value("file_size", 0);
    info.min_system_version = json.value("min_system_version", "1.0.0");
    info.release_notes = json.value("release_notes", "");
    info.manifest_path = json.value("manifest_path", "");
    return info;
}

nlohmann::json UpdateInfo::toJson() const {
    return {
        {"version", version},
        {"name", name},
        {"description", description},
        {"release_date", release_date},
        {"download_url", download_url},
        {"checksum_sha256", checksum_sha256},
        {"file_size", file_size},
        {"min_system_version", min_system_version},
        {"release_notes", release_notes},
        {"manifest_path", manifest_path}
    };
}

bool UpdateInfo::isNewerThan(const std::string& other_version) const {
    auto parse = [](const std::string& v) -> std::vector<int> {
        std::vector<int> parts;
        std::stringstream ss(v);
        std::string part;
        
        while (std::getline(ss, part, '.')) {
            try {
                parts.push_back(std::stoi(part));
            } catch (...) {
                parts.push_back(0);
            }
        }
        
        // 确保至少有3个部分
        while (parts.size() < 3) {
            parts.push_back(0);
        }
        
        return parts;
    };
    
    auto v1 = parse(version);
    auto v2 = parse(other_version);
    
    // 比较每个部分
    for (size_t i = 0; i < std::max(v1.size(), v2.size()); i++) {
        int a = (i < v1.size()) ? v1[i] : 0;
        int b = (i < v2.size()) ? v2[i] : 0;
        
        if (a > b) return true;
        if (a < b) return false;
    }
    
    return false;  // 相等
}

Update::Update() 
    : download_directory("/userdisk/downloads")
    , manifest_directory("/userdisk/secondary/miniapp/data/mini_app/pkg/8001749644971193") {
    cancel_download = std::make_shared<std::atomic<bool>>(false);
    
    // 尝试查找正确的 manifest 目录 (a 或 b)
    if (fs::exists(manifest_directory + "/a/manifest.json")) {
        manifest_directory += "/a";
    } else if (fs::exists(manifest_directory + "/b/manifest.json")) {
        manifest_directory += "/b";
    }
}

Update::~Update() {
    cancelDownload();
}

void Update::setManifestDirectory(const std::string& directory) {
    std::lock_guard<std::mutex> lock(download_mutex);
    manifest_directory = directory;
}

std::string Update::getCurrentVersion() const {
    std::string manifest_path = manifest_directory + "/manifest.json";
    
    if (!fs::exists(manifest_path)) {
        // 尝试在父目录中查找
        if (fs::exists(manifest_directory + "/../a/manifest.json")) {
            manifest_path = manifest_directory + "/../a/manifest.json";
        } else if (fs::exists(manifest_directory + "/../b/manifest.json")) {
            manifest_path = manifest_directory + "/../b/manifest.json";
        } else {
            return "0.0.0";
        }
    }
    
    try {
        std::ifstream file(manifest_path);
        if (!file.is_open()) {
            return "0.0.0";
        }
        
        nlohmann::json manifest;
        file >> manifest;
        
        return manifest.value("version", "0.0.0");
    } catch (const std::exception& e) {
        return "0.0.0";
    }
}

std::string Update::getAppName() const {
    std::string manifest_path = manifest_directory + "/manifest.json";
    
    if (!fs::exists(manifest_path)) {
        return "Unknown";
    }
    
    try {
        std::ifstream file(manifest_path);
        if (!file.is_open()) {
            return "Unknown";
        }
        
        nlohmann::json manifest;
        file >> manifest;
        
        return manifest.value("appName", "Unknown");
    } catch (const std::exception& e) {
        return "Unknown";
    }
}

void Update::setReleaseUrl(const std::string& release_url) {
    std::lock_guard<std::mutex> lock(download_mutex);
    current_release_url = release_url;
    
    // 解析发布URL
    if (release_url.find("github.com") != std::string::npos) {
        // GitHub release
        std::regex regex("https://github.com/([^/]+)/([^/]+)/releases(/download)?(/[^/]+)?");
        std::smatch match;
        
        if (std::regex_search(release_url, match, regex)) {
            std::string owner = match[1];
            std::string repo = match[2];
            
            if (release_url.find("/latest") != std::string::npos) {
                // 最新版本
                update_json_url = "https://github.com/" + owner + "/" + repo + 
                                 "/releases/latest/download/update.json";
            } else if (release_url.find("/tag/") != std::string::npos) {
                // 特定版本
                size_t tag_pos = release_url.find("/tag/");
                std::string tag = release_url.substr(tag_pos + 5);
                update_json_url = "https://github.com/" + owner + "/" + repo + 
                                 "/releases/download/" + tag + "/update.json";
            } else if (release_url.find("/download/") != std::string::npos) {
                // 直接下载链接
                update_json_url = release_url;
                if (update_json_url.find("update.json") == std::string::npos) {
                    update_json_url += "/update.json";
                }
            }
        }
    } else {
        // 自定义 URL
        update_json_url = release_url;
        if (update_json_url.find("update.json") == std::string::npos) {
            update_json_url += "/update.json";
        }
    }
}

std::string Update::getReleaseUrl() const {
    std::lock_guard<std::mutex> lock(download_mutex);
    return current_release_url;
}

void Update::setDownloadDirectory(const std::string& directory) {
    std::lock_guard<std::mutex> lock(download_mutex);
    download_directory = directory;
    
    // 创建目录如果不存在
    if (!fs::exists(directory)) {
        fs::create_directories(directory);
    }
}

std::string Update::getDownloadDirectory() const {
    std::lock_guard<std::mutex> lock(download_mutex);
    return download_directory;
}

UpdateInfo Update::checkForUpdates() {
    if (update_json_url.empty()) {
        THROW_EXCEPTION("Release URL not set");
    }
    
    UpdateInfo remote_info = getUpdateInfo(update_json_url);
    
    // 添加 manifest 路径
    if (!remote_info.manifest_path.empty()) {
        std::string manifest_url = remote_info.download_url.substr(
            0, remote_info.download_url.find_last_of('/') + 1) + "manifest.json";
        remote_info.manifest_path = manifest_url;
    }
    
    return remote_info;
}

UpdateInfo Update::getUpdateInfo(const std::string& update_json_url) {
    Response response = Fetch::fetch(update_json_url);
    
    if (!response.isOk()) {
        THROW_NETWORK_ERROR(response.status);
    }
    
    try {
        nlohmann::json update_json = response.json();
        return UpdateInfo::fromJson(update_json);
    } catch (const std::exception& e) {
        THROW_EXCEPTION("Failed to parse update.json: " + std::string(e.what()));
    }
}

// 自定义写入回调，支持进度报告
static size_t WriteFileCallback(void* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* data = static_cast<std::pair<std::ofstream*, DownloadProgress*>*>(userdata);
    std::ofstream* file = data->first;
    DownloadProgress* progress = data->second;
    
    size_t total_size = size * nmemb;
    file->write(static_cast<char*>(ptr), total_size);
    
    progress->downloaded_bytes += total_size;
    if (progress->total_bytes > 0) {
        progress->percentage = (static_cast<double>(progress->downloaded_bytes) / 
                               progress->total_bytes) * 100.0;
    }
    
    return file->fail() ? 0 : total_size;
}

// 进度回调
static int ProgressCallback(void* clientp, 
                          curl_off_t dltotal, 
                          curl_off_t dlnow, 
                          curl_off_t ultotal, 
                          curl_off_t ulnow) {
    auto* progress = static_cast<DownloadProgress*>(clientp);
    auto* cancel_flag = progress ? 
        static_cast<std::atomic<bool>*>(
            reinterpret_cast<void*>(const_cast<char*>(progress->status.data()))) : 
        nullptr;
    
    if (cancel_flag && cancel_flag->load()) {
        return 1;  // 取消下载
    }
    
    if (progress) {
        progress->downloaded_bytes = dlnow;
        progress->total_bytes = dltotal;
        
        if (dltotal > 0) {
            progress->percentage = (static_cast<double>(dlnow) / dltotal) * 100.0;
        }
    }
    
    return 0;
}

bool Update::downloadUpdate(const UpdateInfo& update_info, DownloadCallback progress_callback) {
    std::lock_guard<std::mutex> lock(download_mutex);
    
    if (is_downloading) {
        return false;
    }
    
    is_downloading = true;
    cancel_download->store(false);
    
    try {
        // 确保下载目录存在
        if (!fs::exists(download_directory)) {
            fs::create_directories(download_directory);
        }
        
        // 从 URL 中提取文件名
        std::string filename = update_info.download_url.substr(
            update_info.download_url.find_last_of('/') + 1);
        
        std::string filepath = download_directory + "/" + filename;
        
        // 打开文件
        std::ofstream file(filepath, std::ios::binary);
        if (!file.is_open()) {
            throw std::runtime_error("Cannot open file for writing: " + filepath);
        }
        
        // 设置下载进度
        DownloadProgress progress;
        progress.total_bytes = update_info.file_size;
        progress.downloaded_bytes = 0;
        progress.percentage = 0.0;
        progress.speed_kbps = 0.0;
        progress.status = "downloading";
        progress.file_path = filepath;
        
        // 准备回调数据
        auto callback_data = std::make_pair(&file, &progress);
        
        // 使用 libcurl 进行下载（为了更好的进度控制）
        CURL* curl = curl_easy_init();
        if (!curl) {
            throw std::runtime_error("Failed to initialize curl");
        }
        
        // 设置 curl 选项
        curl_easy_setopt(curl, CURLOPT_URL, update_info.download_url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteFileCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &callback_data);
        curl_easy_setopt(curl, CURLOPT_NOPROGRESS, 0L);
        curl_easy_setopt(curl, CURLOPT_XFERINFOFUNCTION, ProgressCallback);
        curl_easy_setopt(curl, CURLOPT_XFERINFODATA, &progress);
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
        
        // 设置超时
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 300L);  // 5分钟
        
        // 设置取消标志
        progress.status = std::string(reinterpret_cast<char*>(&cancel_download), 
                                     sizeof(cancel_download));
        
        // 执行下载
        CURLcode res = curl_easy_perform(curl);
        
        // 获取下载速度
        double speed = 0;
        curl_easy_getinfo(curl, CURLINFO_SPEED_DOWNLOAD, &speed);
        progress.speed_kbps = speed / 1024.0;
        
        curl_easy_cleanup(curl);
        file.close();
        
        if (res != CURLE_OK) {
            if (cancel_download->load()) {
                // 用户取消，删除部分下载的文件
                fs::remove(filepath);
                progress.status = "cancelled";
                if (progress_callback) {
                    progress_callback(progress);
                }
                return false;
            }
            throw std::runtime_error("Download failed: " + 
                                   std::string(curl_easy_strerror(res)));
        }
        
        // 验证文件大小
        uintmax_t file_size = fs::file_size(filepath);
        if (file_size != update_info.file_size) {
            throw std::runtime_error("Downloaded file size mismatch. Expected: " + 
                                   std::to_string(update_info.file_size) + 
                                   ", Got: " + std::to_string(file_size));
        }
        
        // 验证校验和
        if (!update_info.checksum_sha256.empty()) {
            if (!verifyFileIntegrity(filepath, update_info.checksum_sha256)) {
                throw std::runtime_error("File integrity check failed");
            }
        }
        
        progress.status = "completed";
        progress.percentage = 100.0;
        if (progress_callback) {
            progress_callback(progress);
        }
        
        return true;
        
    } catch (const std::exception& e) {
        is_downloading = false;
        throw;
    }
    
    is_downloading = false;
    return true;
}

bool Update::installUpdate(const std::string& file_path) {
    if (!fs::exists(file_path)) {
        return false;
    }
    
    // 检查文件扩展名
    std::string ext = fs::path(file_path).extension().string();
    if (ext != ".amr" && ext != ".AMR") {
        return false;
    }
    
    // 构建安装命令
    std::string command = "miniapp_cli install \"" + file_path + "\"";
    
    // 执行命令
    int result = system(command.c_str());
    
    return (result == 0);
}

bool Update::updateManifest(const UpdateInfo& update_info) {
    if (update_info.manifest_path.empty()) {
        return false;
    }
    
    try {
        // 下载 manifest.json
        Response response = Fetch::fetch(update_info.manifest_path);
        
        if (!response.isOk()) {
            return false;
        }
        
        // 保存到临时位置
        std::string temp_path = download_directory + "/manifest_temp.json";
        std::ofstream file(temp_path);
        file << response.text();
        file.close();
        
        // 验证 JSON 格式
        nlohmann::json manifest = nlohmann::json::parse(response.text());
        
        // 复制到应用目录
        std::string dest_path = manifest_directory + "/manifest.json";
        fs::copy_file(temp_path, dest_path, fs::copy_options::overwrite_existing);
        
        // 删除临时文件
        fs::remove(temp_path);
        
        return true;
        
    } catch (const std::exception& e) {
        return false;
    }
}

void Update::cancelDownload() {
    cancel_download->store(true);
}

bool Update::isDownloading() const {
    return is_downloading;
}

bool Update::verifyFileIntegrity(const std::string& file_path, 
                               const std::string& expected_checksum) {
    if (expected_checksum.empty()) {
        return true;  // 没有提供校验和，跳过验证
    }
    
    std::ifstream file(file_path, std::ios::binary);
    if (!file.is_open()) {
        return false;
    }
    
    // 计算 SHA256
    SHA256_CTX sha256;
    SHA256_Init(&sha256);
    
    char buffer[4096];
    while (file.read(buffer, sizeof(buffer))) {
        SHA256_Update(&sha256, buffer, file.gcount());
    }
    SHA256_Update(&sha256, buffer, file.gcount());
    
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_Final(hash, &sha256);
    
    // 转换为十六进制字符串
    std::ostringstream oss;
    oss << std::hex << std::setfill('0');
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        oss << std::setw(2) << static_cast<int>(hash[i]);
    }
    
    return (oss.str() == expected_checksum);
}

void Update::cleanupOldVersions(const std::string& keep_version) {
    try {
        // 遍历下载目录，删除旧版本的 AMR 文件
        for (const auto& entry : fs::directory_iterator(download_directory)) {
            if (entry.path().extension() == ".amr" || 
                entry.path().extension() == ".AMR") {
                
                std::string filename = entry.path().filename().string();
                
                // 检查是否包含版本号，如果不是当前版本则删除
                if (filename.find(keep_version) == std::string::npos) {
                    fs::remove(entry.path());
                }
            }
        }
    } catch (const std::exception& e) {
        // 忽略清理错误
    }
}