#include "Shell.hpp"
#include <cstdio>
#include <array>
#include <stdexcept>
#include <thread>
#include <utility>
#include <vector>
#include <fcntl.h>
#include <pty.h>
#include <utmp.h>
#include <signal.h>
#include <termios.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#include <poll.h>
#include <unistd.h>
#include <cstring>
#include <algorithm>

// 原有简单执行函数（保持不变）
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

// ==================== 交互式终端实现 ====================

struct Shell::InteractiveSession::Impl {
    pid_t pid = -1;
    int masterFd = -1;
    int slaveFd = -1;
    std::atomic<bool> running{false};
    std::thread readerThread;
    std::function<void(const std::string&)> outputCallback;
    std::mutex callbackMutex;
    std::vector<char> readBuffer;
    std::mutex bufferMutex;
    
    ~Impl() {
        terminate();
    }
    
    void setupTerminal(const PTYConfig& config) {
        struct termios tio;
        tcgetattr(masterFd, &tio);
        
        // 设置终端属性
        if (!config.canonical) {
            tio.c_lflag &= ~(ICANON | ECHO);
        } else {
            tio.c_lflag |= ICANON;
            if (config.echo) {
                tio.c_lflag |= ECHO;
            } else {
                tio.c_lflag &= ~ECHO;
            }
        }
        
        // 设置字符处理
        tio.c_iflag = ICRNL;     // 将CR转换为NL
        tio.c_oflag = OPOST | ONLCR; // 将NL转换为CR-NL
        
        tcsetattr(masterFd, TCSANOW, &tio);
    }
    
    void readerLoop() {
        char buffer[4096];
        struct pollfd pfd;
        pfd.fd = masterFd;
        pfd.events = POLLIN;
        
        while (running) {
            int ret = poll(&pfd, 1, 100); // 100ms超时
            if (ret > 0 && (pfd.revents & POLLIN)) {
                ssize_t n = read(masterFd, buffer, sizeof(buffer) - 1);
                if (n > 0) {
                    buffer[n] = '\0';
                    std::string output(buffer, n);
                    
                    // 添加到缓冲区
                    {
                        std::lock_guard<std::mutex> lock(bufferMutex);
                        readBuffer.insert(readBuffer.end(), buffer, buffer + n);
                    }
                    
                    // 调用回调
                    {
                        std::lock_guard<std::mutex> lock(callbackMutex);
                        if (outputCallback) {
                            outputCallback(output);
                        }
                    }
                } else if (n == 0) {
                    // EOF
                    running = false;
                    break;
                }
            } else if (ret < 0) {
                // 错误
                break;
            }
        }
    }
    
    void terminate() {
        running = false;
        
        // 杀死进程组
        if (pid > 0) {
            kill(-pid, SIGTERM);
            waitpid(pid, nullptr, 0);
            pid = -1;
        }
        
        // 关闭文件描述符
        if (masterFd >= 0) {
            close(masterFd);
            masterFd = -1;
        }
        
        if (slaveFd >= 0) {
            close(slaveFd);
            slaveFd = -1;
        }
        
        // 等待读取线程结束
        if (readerThread.joinable()) {
            readerThread.join();
        }
    }
};

Shell::InteractiveSession::InteractiveSession() : impl(std::make_unique<Impl>()) {}

Shell::InteractiveSession::~InteractiveSession() = default;

bool Shell::InteractiveSession::start(const std::string& cmd, const PTYConfig& config) {
    if (impl->running) {
        return false;
    }
    
    // 创建PTY
    char slaveName[256];
    if (openpty(&impl->masterFd, &impl->slaveFd, slaveName, nullptr, nullptr) == -1) {
        return false;
    }
    
    // 设置终端大小
    struct winsize ws;
    ws.ws_row = config.rows;
    ws.ws_col = config.cols;
    ws.ws_xpixel = 0;
    ws.ws_ypixel = 0;
    ioctl(impl->masterFd, TIOCSWINSZ, &ws);
    
    // 设置终端属性
    impl->setupTerminal(config);
    
    // 设置非阻塞读取
    int flags = fcntl(impl->masterFd, F_GETFL, 0);
    fcntl(impl->masterFd, F_SETFL, flags | O_NONBLOCK);
    
    // fork子进程
    impl->pid = fork();
    if (impl->pid == 0) {
        // 子进程
        close(impl->masterFd);
        
        // 创建新会话
        setsid();
        
        // 设置控制终端
        ioctl(impl->slaveFd, TIOCSCTTY, 0);
        
        // 重定向标准输入输出错误
        dup2(impl->slaveFd, STDIN_FILENO);
        dup2(impl->slaveFd, STDOUT_FILENO);
        dup2(impl->slaveFd, STDERR_FILENO);
        
        // 关闭所有其他文件描述符
        for (int i = 3; i < 1024; i++) {
            close(i);
        }
        
        // 设置终端类型
        setenv("TERM", config.termType.c_str(), 1);
        
        // 执行命令
        execl("/bin/sh", "sh", "-c", cmd.c_str(), (char*)nullptr);
        
        // 如果execl失败
        _exit(127);
    } else if (impl->pid > 0) {
        // 父进程
        close(impl->slaveFd);
        impl->slaveFd = -1;
        
        impl->running = true;
        impl->readerThread = std::thread([this]() { impl->readerLoop(); });
        
        return true;
    }
    
    return false;
}

bool Shell::InteractiveSession::write(const std::string& data) {
    if (!impl->running || impl->masterFd < 0) {
        return false;
    }
    
    ssize_t written = ::write(impl->masterFd, data.c_str(), data.size());
    return written == static_cast<ssize_t>(data.size());
}

std::string Shell::InteractiveSession::read() {
    std::lock_guard<std::mutex> lock(impl->bufferMutex);
    std::string result(impl->readBuffer.begin(), impl->readBuffer.end());
    impl->readBuffer.clear();
    return result;
}

std::string Shell::InteractiveSession::readNonBlocking() {
    std::lock_guard<std::mutex> lock(impl->bufferMutex);
    std::string result(impl->readBuffer.begin(), impl->readBuffer.end());
    impl->readBuffer.clear();
    return result;
}

bool Shell::InteractiveSession::sendSignal(int sig) {
    if (!impl->running || impl->pid <= 0) {
        return false;
    }
    
    return kill(-impl->pid, sig) == 0;
}

bool Shell::InteractiveSession::resize(int rows, int cols) {
    if (!impl->running || impl->masterFd < 0) {
        return false;
    }
    
    struct winsize ws;
    ws.ws_row = rows;
    ws.ws_col = cols;
    ws.ws_xpixel = 0;
    ws.ws_ypixel = 0;
    
    return ioctl(impl->masterFd, TIOCSWINSZ, &ws) == 0;
}

int Shell::InteractiveSession::wait() {
    if (impl->pid <= 0) {
        return -1;
    }
    
    int status = 0;
    waitpid(impl->pid, &status, 0);
    impl->running = false;
    impl->pid = -1;
    
    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    } else if (WIFSIGNALED(status)) {
        return -WTERMSIG(status);
    }
    
    return -1;
}

bool Shell::InteractiveSession::isRunning() const {
    return impl->running;
}

void Shell::InteractiveSession::terminate() {
    impl->terminate();
}

void Shell::InteractiveSession::setOutputCallback(std::function<void(const std::string&)> callback) {
    std::lock_guard<std::mutex> lock(impl->callbackMutex);
    impl->outputCallback = callback;
}

pid_t Shell::InteractiveSession::getPid() const {
    return impl->pid;
}

std::unique_ptr<Shell::InteractiveSession> Shell::createInteractiveSession() {
    return std::make_unique<InteractiveSession>();
}

// 阻塞式交互执行
std::string Shell::execInteractive(const std::string& cmd, const PTYConfig& config) {
    auto session = createInteractiveSession();
    if (!session->start(cmd, config)) {
        throw std::runtime_error("Failed to start interactive session");
    }
    
    std::string output;
    while (session->isRunning()) {
        output += session->readNonBlocking();
        usleep(10000); // 10ms
    }
    
    output += session->read(); // 获取剩余输出
    return output;
}