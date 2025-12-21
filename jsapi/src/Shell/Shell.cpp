#include "Shell.hpp"
#include <cstdio>
#include <array>
#include <stdexcept>
#include <thread>
#include <utility>

std::string Shell::exec(const std::string& cmd) {
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe)
        throw std::runtime_error("popen failed");

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
        result += buffer.data();

    pclose(pipe);
    return result;
}

std::string Shell::exec(const std::string& cmd, const std::string& env) {
    // 支持临时环境变量执行
    std::string fullCmd = env + " " + cmd;
    return exec(fullCmd);
}

std::pair<std::string, int> Shell::execWithStatus(const std::string& cmd) {
    std::array<char, 256> buffer;
    std::string result;

    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe)
        throw std::runtime_error("popen failed");

    while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
        result += buffer.data();

    int status = pclose(pipe);
    return {result, status};
}

void Shell::execAsync(const std::string& cmd, std::function<void(const std::string&)> onOutput) {
    std::thread([cmd, onOutput]() {
        std::array<char, 256> buffer;
        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) {
            onOutput("popen failed");
            return;
        }

        while (fgets(buffer.data(), buffer.size(), pipe) != nullptr)
            onOutput(buffer.data());

        pclose(pipe);
    }).detach();
}
