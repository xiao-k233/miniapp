// Shell.cpp - 简化版本，避免复杂的功能导致编译问题
#include "Shell.hpp"
#include <cstdio>
#include <memory>
#include <array>
#include <stdexcept>
#include <thread>
#include <atomic>
#include <mutex>
#include <unistd.h>
#include <sys/wait.h>
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <vector>
#include <cstring>

class Shell::Impl {
private:
    std::atomic<bool> running{false};
    std::atomic<int> lastExitCode{0};
    pid_t childPid{-1};
    std::mutex mtx;
    
    OutputCallback outputCallback;
    ExitCallback exitCallback;
    ErrorCallback errorCallback;
    
public:
    Impl() = default;
    
    ~Impl() {
        terminate();
    }
    
    // 同步执行
    std::string exec(const std::string& cmd) {
        std::array<char, 256> buffer;
        std::string result;
        
        FILE* pipe = popen(cmd.c_str(), "r");
        if (!pipe) {
            throw std::runtime_error("popen failed: " + std::string(strerror(errno)));
        }
        
        // 读取输出
        while (fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
            result += buffer.data();
        }
        
        int status = pclose(pipe);
        lastExitCode = WEXITSTATUS(status);
        return result;
    }
    
    // 异步执行命令
    void execAsync(const std::string& cmd,
                  OutputCallback outputCb,
                  ExitCallback exitCb,
                  ErrorCallback errorCb) {
        terminate(); // 确保之前的进程已结束
        
        outputCallback = std::move(outputCb);
        exitCallback = std::move(exitCb);
        errorCallback = std::move(errorCb);
        
        running = true;
        
        // 启动新线程执行命令
        std::thread([this, cmd]() {
            try {
                std::array<char, 256> buffer;
                std::string result;
                
                FILE* pipe = popen(cmd.c_str(), "r");
                if (!pipe) {
                    throw std::runtime_error("popen failed: " + std::string(strerror(errno)));
                }
                
                // 读取输出并实时回调
                while (running && fgets(buffer.data(), buffer.size(), pipe) != nullptr) {
                    std::string output = buffer.data();
                    result += output;
                    
                    if (outputCallback) {
                        outputCallback(output);
                    }
                }
                
                int status = pclose(pipe);
                lastExitCode = WEXITSTATUS(status);
                
                if (exitCallback) {
                    exitCallback(lastExitCode);
                }
                
                running = false;
            } catch (const std::exception& e) {
                running = false;
                if (errorCallback) {
                    errorCallback(e.what());
                }
            }
        }).detach();
    }
    
    // 启动交互式shell会话（简化版本）
    void startInteractive(OutputCallback outputCb,
                         ExitCallback exitCb,
                         ErrorCallback errorCb) {
        terminate();
        
        outputCallback = std::move(outputCb);
        exitCallback = std::move(exitCb);
        errorCallback = std::move(errorCb);
        
        if (outputCallback) {
            outputCallback("Interactive shell mode not implemented in this version.\n");
            outputCallback("Use execAsync for real-time output.\n");
        }
        
        if (exitCallback) {
            exitCallback(0);
        }
    }
    
    // 向交互式shell写入输入
    void writeToInteractive(const std::string& input) {
        // 交互式模式未实现
        if (errorCallback) {
            errorCallback("Interactive shell not available");
        }
    }
    
    // 发送信号
    void sendSignal(int signal) {
        if (childPid > 0) {
            kill(childPid, signal);
        }
    }
    
    // 终止进程
    void terminate() {
        running = false;
        
        if (childPid > 0) {
            kill(childPid, SIGTERM);
            int status;
            waitpid(childPid, &status, 0);
            childPid = -1;
        }
    }
    
    bool isRunning() const {
        return running;
    }
    
    void setEnv(const std::string& key, const std::string& value) {
        // 简单实现：设置环境变量
        setenv(key.c_str(), value.c_str(), 1);
    }
    
    int getLastExitCode() const {
        return lastExitCode;
    }
};

// Shell类实现
Shell::Shell() : pImpl(std::make_unique<Impl>()) {}
Shell::~Shell() = default;

std::string Shell::exec(const std::string& cmd) {
    return pImpl->exec(cmd);
}

void Shell::execAsync(const std::string& cmd,
                     OutputCallback outputCallback,
                     ExitCallback exitCallback,
                     ErrorCallback errorCallback) {
    pImpl->execAsync(cmd, std::move(outputCallback), 
                     std::move(exitCallback), std::move(errorCallback));
}

void Shell::startInteractive(OutputCallback outputCallback,
                           ExitCallback exitCallback,
                           ErrorCallback errorCallback) {
    pImpl->startInteractive(std::move(outputCallback),
                          std::move(exitCallback),
                          std::move(errorCallback));
}

void Shell::writeToInteractive(const std::string& input) {
    pImpl->writeToInteractive(input);
}

void Shell::sendSignal(int signal) {
    pImpl->sendSignal(signal);
}

void Shell::terminate() {
    pImpl->terminate();
}

bool Shell::isRunning() const {
    return pImpl->isRunning();
}

void Shell::setEnv(const std::string& key, const std::string& value) {
    pImpl->setEnv(key, value);
}

int Shell::getLastExitCode() const {
    return pImpl->getLastExitCode();
}