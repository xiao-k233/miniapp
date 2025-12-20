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
#include <sys/ioctl.h>
#include <cstring>
#include <iostream>
#include <atomic>
#include <vector>

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

    int status = pclose(pipe);
    return result;
}

std::string Shell::exec(const std::string& cmd, const std::string& env) {
    std::string fullCmd;
    if (!env.empty()) {
        fullCmd = env + " " + cmd;
    } else {
        fullCmd = cmd;
    }
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
    return {result, WEXITSTATUS(status)};
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
    if (tcgetattr(STDIN_FILENO, &termp) == -1) {
        perror("tcgetattr");
        return false;
    }
    
    // 设置终端属性 - 原始模式
    cfmakeraw(&termp);
    termp.c_oflag |= OPOST; // 启用输出处理
    
    // 设置窗口大小
    if (ioctl(STDIN_FILENO, TIOCGWINSZ, &win) == -1) {
        win.ws_row = 24;
        win.ws_col = 80;
        win.ws_xpixel = 0;
        win.ws_ypixel = 0;
    }
    
    // 创建伪终端
    if (openpty(&masterFd, &slaveFd, nullptr, &termp, &win) == -1) {
        perror("openpty");
        return false;
    }
    
    // 设置slave端的窗口大小
    ioctl(slaveFd, TIOCSWINSZ, &win);
    
    childPid = fork();
    if (childPid == -1) {
        perror("fork");
        close(masterFd);
        close(slaveFd);
        return false;
    }
    
    if (childPid == 0) { // 子进程
        close(masterFd);
        
        // 创建新会话
        setsid();
        
        // 设置伪终端为控制终端
        if (ioctl(slaveFd, TIOCSCTTY, 0) == -1) {
            perror("ioctl TIOCSCTTY");
        }
        
        // 复制文件描述符
        dup2(slaveFd, STDIN_FILENO);
        dup2(slaveFd, STDOUT_FILENO);
        dup2(slaveFd, STDERR_FILENO);
        
        // 关闭slaveFd（如果大于STDERR_FILENO）
        if (slaveFd > STDERR_FILENO) {
            close(slaveFd);
        }
        
        // 设置环境变量
        setenv("TERM", "xterm-256color", 1);
        setenv("COLORTERM", "truecolor", 1);
        
        // 设置工作目录为用户目录
        const char* home = getenv("HOME");
        if (home) {
            chdir(home);
        }
        
        // 执行shell
        const char* shell = shellPath.c_str();
        const char* args[] = {shell, nullptr};
        execvp(shell, (char* const*)args);
        
        // 如果执行失败
        perror("execvp");
        _exit(EXIT_FAILURE);
    } else { // 父进程
        close(slaveFd);
        
        // 设置非阻塞
        int flags = fcntl(masterFd, F_GETFL, 0);
        if (flags == -1 || fcntl(masterFd, F_SETFL, flags | O_NONBLOCK) == -1) {
            perror("fcntl");
            close(masterFd);
            kill(childPid, SIGTERM);
            waitpid(childPid, nullptr, 0);
            return false;
        }
        
        // 启动读取线程
        interactiveMode = true;
        readThread = std::make_unique<std::thread>(&Shell::readOutputLoop, this);
        
        return true;
    }
}

void Shell::readOutputLoop() {
    std::vector<char> buffer(4096);
    fd_set readfds;
    
    while (interactiveMode && masterFd >= 0) {
        FD_ZERO(&readfds);
        FD_SET(masterFd, &readfds);
        
        struct timeval timeout;
        timeout.tv_sec = 0;
        timeout.tv_usec = 50000; // 50ms（减少CPU使用）
        
        int ret = select(masterFd + 1, &readfds, nullptr, nullptr, &timeout);
        
        if (ret > 0 && FD_ISSET(masterFd, &readfds)) {
            ssize_t n = read(masterFd, buffer.data(), buffer.size() - 1);
            if (n > 0) {
                // 确保以null结尾
                buffer[n] = '\0';
                
                // 处理特殊字符（如退格、换行等）
                std::string output;
                for (ssize_t i = 0; i < n; i++) {
                    char c = buffer[i];
                    if (c == '\r') {
                        // 回车处理
                        output += '\n';
                    } else if (c >= 32 || c == '\n' || c == '\t') {
                        // 可打印字符
                        output += c;
                    } else if (c == 0x7f || c == 0x08) {
                        // 退格键
                        output += '\b';
                    } else {
                        // 其他控制字符，忽略或转换
                        output += c;
                    }
                }
                
                if (outputCallback) {
                    outputCallback(output);
                }
            } else if (n == 0) {
                // EOF - 子进程结束
                if (outputCallback) {
                    outputCallback("\n[Shell process exited]\n");
                }
                break;
            } else if (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK) {
                // 读取错误
                if (outputCallback) {
                    outputCallback("\n[Shell read error]\n");
                }
                break;
            }
        } else if (ret < 0 && errno != EINTR) {
            // select错误
            break;
        }
        
        // 检查子进程状态
        if (childPid > 0) {
            int status;
            pid_t result = waitpid(childPid, &status, WNOHANG);
            if (result == childPid) {
                // 子进程已退出
                interactiveMode = false;
                if (outputCallback) {
                    outputCallback("\n[Shell terminated]\n");
                }
                break;
            }
        }
    }
    
    // 清理
    interactiveMode = false;
}

bool Shell::writeToShell(const std::string& data) {
    if (!interactiveMode || masterFd < 0) {
        return false;
    }
    
    std::lock_guard<std::mutex> lock(ioMutex);
    
    // 处理特殊键的转换
    std::string processedData;
    for (size_t i = 0; i < data.size(); i++) {
        char c = data[i];
        
        // 处理转义序列
        if (c == '\\' && i + 1 < data.size()) {
            char next = data[++i];
            switch (next) {
                case 'n': processedData += '\n'; break;
                case 'r': processedData += '\r'; break;
                case 't': processedData += '\t'; break;
                case 'b': processedData += '\b'; break;
                case 'e': processedData += '\033'; break; // ESC
                default: processedData += c; processedData += next; break;
            }
        } else {
            processedData += c;
        }
    }
    
    ssize_t totalWritten = 0;
    const char* ptr = processedData.c_str();
    size_t remaining = processedData.size();
    
    while (remaining > 0) {
        ssize_t written = write(masterFd, ptr, remaining);
        if (written <= 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                // 重试
                std::this_thread::sleep_for(std::chrono::milliseconds(10));
                continue;
            }
            return false;
        }
        totalWritten += written;
        ptr += written;
        remaining -= written;
    }
    
    // 刷新输出
    tcdrain(masterFd);
    
    return totalWritten == static_cast<ssize_t>(processedData.size());
}

void Shell::close() {
    if (interactiveMode) {
        interactiveMode = false;
        
        // 停止读取线程
        if (readThread && readThread->joinable()) {
            readThread->join();
        }
        
        // 关闭master端
        if (masterFd >= 0) {
            ::close(masterFd);
            masterFd = -1;
        }
        
        // 终止子进程
        if (childPid > 0) {
            // 先尝试SIGTERM
            kill(childPid, SIGTERM);
            
            // 等待最多1秒
            int status;
            for (int i = 0; i < 10; i++) {
                pid_t result = waitpid(childPid, &status, WNOHANG);
                if (result == childPid) {
                    childPid = -1;
                    return;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            
            // 如果还没退出，发送SIGKILL
            kill(childPid, SIGKILL);
            waitpid(childPid, &status, 0);
            childPid = -1;
        }
    }
}

bool Shell::isRunning() const {
    if (!interactiveMode || childPid <= 0) {
        return false;
    }
    
    int status;
    pid_t result = waitpid(childPid, &status, WNOHANG);
    if (result == 0) {
        // 子进程还在运行
        return true;
    }
    
    return false;
}

void Shell::setOutputCallback(std::function<void(const std::string&)> callback) {
    outputCallback = callback;
}