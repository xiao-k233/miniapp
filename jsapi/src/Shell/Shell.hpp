#pragma once

#include <string>
#include <functional>
#include <memory>
#include <vector>
#include <thread>
#include <atomic>
#include <mutex>

class Shell {
public:
    // 原有简单执行接口（保持兼容）
    static std::string exec(const std::string& cmd);
    static std::string exec(const std::string& cmd, const std::string& env);
    static std::pair<std::string, int> execWithStatus(const std::string& cmd);
    static void execAsync(const std::string& cmd, std::function<void(const std::string&)> onOutput);

    // 新增：交互式终端接口
    struct PTYConfig {
        int rows = 24;      // 终端行数
        int cols = 80;      // 终端列数
        bool echo = false;  // 是否回显
        bool canonical = true; // 是否规范模式
        std::string termType = "xterm-256color"; // 终端类型
    };

    // 交互式命令执行（阻塞式）
    static std::string execInteractive(const std::string& cmd, 
                                       const PTYConfig& config = PTYConfig());
    
    // 交互式命令执行（异步，带回调）
    class InteractiveSession {
    public:
        InteractiveSession();
        ~InteractiveSession();
        
        // 启动交互式会话
        bool start(const std::string& cmd, const PTYConfig& config = PTYConfig());
        
        // 向进程发送输入
        bool write(const std::string& data);
        
        // 读取进程输出
        std::string read();
        
        // 获取输出（非阻塞）
        std::string readNonBlocking();
        
        // 发送信号
        bool sendSignal(int sig);
        
        // 调整终端大小
        bool resize(int rows, int cols);
        
        // 等待进程结束
        int wait();
        
        // 检查是否运行中
        bool isRunning() const;
        
        // 结束会话
        void terminate();
        
        // 设置输出回调（异步模式）
        void setOutputCallback(std::function<void(const std::string&)> callback);
        
        // 获取进程ID
        pid_t getPid() const;
        
    private:
        struct Impl;
        std::unique_ptr<Impl> impl;
    };
    
    // 创建交互式会话
    static std::unique_ptr<InteractiveSession> createInteractiveSession();
};