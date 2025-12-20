#pragma once
#include <string>
#include <functional>
#include <memory>

class Shell {
public:
    // 回调函数类型定义
    using OutputCallback = std::function<void(const std::string& output)>;
    using ExitCallback = std::function<void(int exitCode)>;
    using ErrorCallback = std::function<void(const std::string& error)>;
    
    // 构造和析构
    Shell();
    ~Shell();
    
    // 同步执行命令
    std::string exec(const std::string& cmd);
    
    // 异步执行命令（支持回显）
    void execAsync(const std::string& cmd,
                  OutputCallback outputCallback = nullptr,
                  ExitCallback exitCallback = nullptr,
                  ErrorCallback errorCallback = nullptr);
    
    // 启动交互式shell会话（简化）
    void startInteractive(OutputCallback outputCallback,
                         ExitCallback exitCallback = nullptr,
                         ErrorCallback errorCallback = nullptr);
    
    // 向交互式会话写入输入
    void writeToInteractive(const std::string& input);
    
    // 发送信号
    void sendSignal(int signal);
    
    // 结束当前进程
    void terminate();
    
    // 获取运行状态
    bool isRunning() const;
    
    // 设置环境变量
    void setEnv(const std::string& key, const std::string& value);
    
    // 获取最后执行的命令的退出码
    int getLastExitCode() const;
    
private:
    class Impl;
    std::unique_ptr<Impl> pImpl;
};