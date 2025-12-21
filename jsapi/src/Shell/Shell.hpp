#pragma once
#include <string>
#include <functional>

class Shell {
public:
    // 执行命令，返回输出
    std::string exec(const std::string& cmd);

    // 执行命令，带环境变量
    std::string exec(const std::string& cmd, const std::string& env);

    // 执行命令，返回输出和状态码
    std::pair<std::string, int> execWithStatus(const std::string& cmd);

    // 异步执行命令，输出通过回调返回
    void execAsync(const std::string& cmd, std::function<void(const std::string&)> onOutput);
};
