#pragma once

#include <string>
#include <functional>
#include <memory>
#include <mutex>

class Shell {
public:
    Shell();
    ~Shell();
    
    // 传统的一次性执行
    std::string exec(const std::string& cmd);
    std::string exec(const std::string& cmd, const std::string& env);
    std::pair<std::string, int> execWithStatus(const std::string& cmd);
    void execAsync(const std::string& cmd, std::function<void(const std::string&)> onOutput);
    
    // 新的交互式Shell功能
    bool startInteractive(const std::string& shellPath = "/bin/bash");
    bool writeToShell(const std::string& data);
    void close();
    bool isRunning() const;
    
    // 设置输出回调
    void setOutputCallback(std::function<void(const std::string&)> callback);
    
    // 新增：设置终端大小
    bool setTerminalSize(int rows, int cols);
    
    // 新增：获取进程ID
    pid_t getPid() const { return childPid; }
    
private:
    // 交互式Shell相关
    int masterFd = -1;
    int slaveFd = -1;
    pid_t childPid = -1;
    bool interactiveMode = false;
    std::function<void(const std::string&)> outputCallback;
    
    // 线程管理
    std::unique_ptr<std::thread> readThread;
    std::mutex ioMutex;
    
    void readOutputLoop();
};