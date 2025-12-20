#include "Shell.hpp"
#include <cstdio>
#include <array>
#include <stdexcept>
#include <thread>
#include <utility>
#include <unistd.h>
#include <fcntl.h>
#include <pty.h>
#include <termios.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/select.h>
#include <cstring>
#include <iostream>

Shell::Shell() : masterFd(-1), slaveFd(-1), childPid(-1), interactiveMode(false) {}

Shell::~Shell() {
    close();
}

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

// 新的交互式Shell功能实现
bool Shell::startInteractive(const std::string& shellPath) {
    if (interactiveMode) {
        return false; // 已经运行
    }
    
    struct termios termp;
    struct winsize win;
    
    // 获取当前终端设置
    tcgetattr(STDIN_FILENO, &termp);
    win.ws_row = 24;
    win.ws_col = 80;
    win.ws_xpixel = 0;
    win.ws_ypixel = 0;
    
    // 创建伪终端
    if (openpty(&masterFd, &slaveFd, nullptr, &termp, &win) == -1) {
        return false;
    }
    
    childPid = fork();
    if (childPid == -1) {
        close(masterFd);
        close(slaveFd);
        return false;
    }
    
    if (childPid == 0) { // 子进程
        close(masterFd);
        
        // 设置会话
        setsid();
        
        // 设置伪终端为控制终端
        ioctl(slaveFd, TIOCSCTTY, 0);
        
        // 复制文件描述符
        dup2(slaveFd, STDIN_FILENO);
        dup2(slaveFd, STDOUT_FILENO);
        dup2(slaveFd, STDERR_FILENO);
        
        // 关闭slaveFd
        if (slaveFd > STDERR_FILENO)
            close(slaveFd);
        
        // 执行shell
        execlp(shellPath.c_str(), shellPath.c_str(), nullptr);
        
        // 如果执行失败
        _exit(EXIT_FAILURE);
    } else { // 父进程
        close(slaveFd);
        
        // 设置非阻塞
        int flags = fcntl(masterFd, F_GETFL, 0);
        fcntl(masterFd, F_SETFL, flags | O_NONBLOCK);
        
        // 启动读取线程
        interactiveMode = true;
        readThread = std::make_unique<std::thread>(&Shell::readOutputLoop, this);
        
        return true;
    }
}

void Shell::readOutputLoop() {
    char buffer[4096];
    fd_set readfds;
    
    while (interactiveMode && masterFd >= 0) {
        FD_ZERO(&readfds);
        FD_SET(masterFd, &readfds);
        
        struct timeval timeout;
        timeout.tv_sec = 0;
        timeout.tv_usec = 100000; // 100ms
        
        int ret = select(masterFd + 1, &readfds, nullptr, nullptr, &timeout);
        
        if (ret > 0 && FD_ISSET(masterFd, &readfds)) {
            ssize_t n = read(masterFd, buffer, sizeof(buffer) - 1);
            if (n > 0) {
                buffer[n] = '\0';
                if (outputCallback) {
                    outputCallback(std::string(buffer, n));
                }
            } else if (n == 0) {
                // EOF
                break;
            }
        } else if (ret < 0) {
            if (errno != EINTR) {
                break;
            }
        }
    }
}

bool Shell::writeToShell(const std::string& data) {
    if (!interactiveMode || masterFd < 0) {
        return false;
    }
    
    std::lock_guard<std::mutex> lock(ioMutex);
    ssize_t written = write(masterFd, data.c_str(), data.size());
    return written == static_cast<ssize_t>(data.size());
}

void Shell::close() {
    if (interactiveMode) {
        interactiveMode = false;
        
        if (readThread && readThread->joinable()) {
            readThread->join();
        }
        
        if (childPid > 0) {
            // 发送SIGTERM信号
            kill(childPid, SIGTERM);
            
            // 等待子进程退出
            int status;
            waitpid(childPid, &status, 0);
            childPid = -1;
        }
        
        if (masterFd >= 0) {
            ::close(masterFd);
            masterFd = -1;
        }
    }
}

bool Shell::isRunning() const {
    return interactiveMode;
}

void Shell::setOutputCallback(std::function<void(const std::string&)> callback) {
    outputCallback = callback;
}