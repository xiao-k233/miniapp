// Shell.cpp
#include "Shell.hpp"
#include <cstdio>
#include <memory>
#include <array>
#include <stdexcept>
#include <vector>
#include <cstring>

ShellResult Shell::exec(const std::string& cmd) {
    ShellResult result;
    std::array<char, 256> buffer;
    
    // 使用 popen 执行命令
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) {
        result.exitCode = -1;
        result.error = "popen failed";
        return result;
    }
    
    // 读取输出
    std::string output;
    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
        output += buffer.data();
    }
    
    // 获取退出码
    int status = pclose(pipe);
    if (WIFEXITED(status)) {
        result.exitCode = WEXITSTATUS(status);
    } else {
        result.exitCode = -1;
    }
    
    result.output = output;
    return result;
}

ShellResult Shell::exec(const std::string& cmd, const std::vector<std::string>& args) {
    // 构建带参数的命令
    std::string fullCmd = cmd;
    for (const auto& arg : args) {
        fullCmd += " " + arg;
    }
    return exec(fullCmd);
}