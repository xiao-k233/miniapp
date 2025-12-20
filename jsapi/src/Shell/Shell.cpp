#include "Shell.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <stdexcept>
#include <thread>
#include <chrono>
#include <vector>
#include <queue>
#include <algorithm>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <atomic>
#include <memory>
#include <unistd.h>
#include <fcntl.h>
#include <pty.h>
#include <termios.h>
#include <signal.h>
#include <sys/wait.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/select.h>
#include <sys/types.h>
#include <dirent.h>
#include <grp.h>
#include <pwd.h>

// 内部实现类
class Shell::Impl {
public:
    Impl(const ShellConfig& config) 
        : config(config), 
          state(STATE_IDLE),
          shellPid(-1),
          masterFd(-1),
          slaveFd(-1),
          exitCode(-1),
          shouldStop(false) {
        
        // 设置默认环境变量
        defaultEnvVars["TERM"] = config.enableColor ? "xterm-256color" : "vt100";
        defaultEnvVars["COLORTERM"] = "truecolor";
        defaultEnvVars["SHELL"] = config.shellPath;
        
        // 合并用户自定义环境变量
        for (const auto& kv : config.envVars) {
            envVars[kv.first] = kv.second;
        }
    }
    
    ~Impl() {
        stop();
    }
    
    CommandResult exec(const std::string& cmd) {
        CommandResult result;
        auto startTime = std::chrono::steady_clock::now();
        
        if (config.type == SHELL_POPEN) {
            result = execWithPopen(cmd);
        } else if (config.type == SHELL_INTERACTIVE) {
            result = execInInteractive(cmd);
        } else {
            result.error = "Unsupported shell type";
        }
        
        auto endTime = std::chrono::steady_clock::now();
        std::chrono::duration<double> elapsed = endTime - startTime;
        result.executionTime = elapsed.count();
        
        return result;
    }
    
    CommandResult execWithPopen(const std::string& cmd) {
        CommandResult result;
        
        // 构建环境变量字符串
        std::string envStr;
        for (const auto& kv : envVars) {
            envStr += kv.first + "=" + kv.second + " ";
        }
        
        // 执行命令
        std::string fullCmd = envStr + cmd;
        FILE* pipe = popen(fullCmd.c_str(), "r");
        if (!pipe) {
            result.error = "popen failed: " + std::string(strerror(errno));
            return result;
        }
        
        // 读取输出
        char buffer[4096];
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result.output += buffer;
        }
        
        // 获取退出状态
        int status = pclose(pipe);
        if (WIFEXITED(status)) {
            result.exitCode = WEXITSTATUS(status);
            result.success = (result.exitCode == 0);
        } else {
            result.exitCode = -1;
            result.error = "Command terminated by signal";
        }
        
        return result;
    }
    
    CommandResult execInInteractive(const std::string& cmd) {
        CommandResult result;
        
        if (!ensureRunning()) {
            result.error = "Failed to start interactive shell";
            return result;
        }
        
        // 清空输出缓冲区
        {
            std::lock_guard<std::mutex> lock(outputMutex);
            outputBuffer.clear();
        }
        
        // 写入命令并添加换行
        std::string fullCmd = cmd + "\n";
        if (!writeToShell(fullCmd)) {
            result.error = "Failed to write command to shell";
            return result;
        }
        
        // 等待命令执行完成（超时机制）
        auto startTime = std::chrono::steady_clock::now();
        bool gotPrompt = false;
        
        while (true) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            
            // 检查超时（5秒）
            auto now = std::chrono::steady_clock::now();
            std::chrono::duration<double> elapsed = now - startTime;
            if (elapsed.count() > 5.0) {
                result.error = "Command execution timeout";
                break;
            }
            
            // 检查是否有新输出
            std::string newOutput;
            {
                std::lock_guard<std::mutex> lock(outputMutex);
                if (!outputBuffer.empty()) {
                    newOutput = outputBuffer;
                    outputBuffer.clear();
                }
            }
            
            if (!newOutput.empty()) {
                result.output += newOutput;
                
                // 简单检测命令是否执行完成（检测到提示符）
                if (newOutput.find("$ ") != std::string::npos ||
                    newOutput.find("# ") != std::string::npos ||
                    newOutput.find("> ") != std::string::npos) {
                    gotPrompt = true;
                    break;
                }
            }
        }
        
        if (gotPrompt) {
            result.success = true;
            result.exitCode = 0;
        }
        
        return result;
    }
    
    bool start() {
        if (state != STATE_IDLE && state != STATE_EXITED) {
            return false;
        }
        
        if (config.type != SHELL_INTERACTIVE) {
            // 非交互式Shell不需要特殊启动
            state = STATE_IDLE;
            return true;
        }
        
        return startInteractive();
    }
    
    bool startInteractive() {
        struct termios termp;
        struct winsize win;
        
        // 获取当前终端设置
        if (tcgetattr(STDIN_FILENO, &termp) == -1) {
            perror("tcgetattr");
            return false;
        }
        
        // 设置原始模式
        cfmakeraw(&termp);
        termp.c_oflag |= OPOST;
        termp.c_lflag |= ECHO;
        
        // 设置窗口大小
        win.ws_row = config.initialRows;
        win.ws_col = config.initialCols;
        win.ws_xpixel = 0;
        win.ws_ypixel = 0;
        
        // 创建伪终端
        if (openpty(&masterFd, &slaveFd, nullptr, &termp, &win) == -1) {
            perror("openpty");
            return false;
        }
        
        // 设置非阻塞
        int flags = fcntl(masterFd, F_GETFL, 0);
        fcntl(masterFd, F_SETFL, flags | O_NONBLOCK);
        
        // Fork子进程
        shellPid = fork();
        if (shellPid == -1) {
            perror("fork");
            close(masterFd);
            close(slaveFd);
            return false;
        }
        
        if (shellPid == 0) { // 子进程
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
            
            // 关闭slaveFd
            if (slaveFd > STDERR_FILENO) {
                close(slaveFd);
            }
            
            // 设置环境变量
            for (const auto& kv : envVars) {
                setenv(kv.first.c_str(), kv.second.c_str(), 1);
            }
            
            // 设置工作目录
            if (!config.workingDirectory.empty()) {
                if (chdir(config.workingDirectory.c_str()) != 0) {
                    perror("chdir");
                }
            }
            
            // 执行shell
            const char* shell = config.shellPath.c_str();
            execlp(shell, shell, nullptr);
            
            // 如果执行失败
            perror("execlp");
            _exit(EXIT_FAILURE);
        } else { // 父进程
            close(slaveFd);
            
            // 启动读取线程
            shouldStop = false;
            readThread = std::thread(&Shell::Impl::readOutputLoop, this);
            
            state = STATE_RUNNING;
            if (stateCallback) {
                stateCallback(state);
            }
            
            return true;
        }
    }
    
    void stop() {
        shouldStop = true;
        
        if (readThread.joinable()) {
            readThread.join();
        }
        
        if (shellPid > 0) {
            // 发送SIGTERM信号
            kill(shellPid, SIGTERM);
            
            // 等待子进程退出
            int status;
            for (int i = 0; i < 10; i++) {
                pid_t result = waitpid(shellPid, &status, WNOHANG);
                if (result == shellPid) {
                    exitCode = WEXITSTATUS(status);
                    shellPid = -1;
                    break;
                }
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
            }
            
            // 如果还没退出，发送SIGKILL
            if (shellPid > 0) {
                kill(shellPid, SIGKILL);
                waitpid(shellPid, &status, 0);
                shellPid = -1;
            }
        }
        
        if (masterFd >= 0) {
            close(masterFd);
            masterFd = -1;
        }
        
        state = STATE_EXITED;
        if (stateCallback) {
            stateCallback(state);
        }
    }
    
    void readOutputLoop() {
        fd_set readfds;
        char buffer[4096];
        
        while (!shouldStop) {
            FD_ZERO(&readfds);
            FD_SET(masterFd, &readfds);
            
            struct timeval timeout;
            timeout.tv_sec = 0;
            timeout.tv_usec = 50000; // 50ms
            
            int ret = select(masterFd + 1, &readfds, nullptr, nullptr, &timeout);
            
            if (ret > 0 && FD_ISSET(masterFd, &readfds)) {
                ssize_t n = read(masterFd, buffer, sizeof(buffer) - 1);
                if (n > 0) {
                    buffer[n] = '\0';
                    
                    // 添加到输出缓冲区
                    {
                        std::lock_guard<std::mutex> lock(outputMutex);
                        outputBuffer.append(buffer, n);
                    }
                    
                    // 回调通知
                    if (outputCallback) {
                        outputCallback(std::string(buffer, n), false);
                    }
                    
                    // 添加到历史记录
                    commandHistory.push_back(std::string(buffer, n));
                } else if (n == 0) {
                    // EOF - 子进程结束
                    break;
                }
            } else if (ret < 0 && errno != EINTR) {
                break;
            }
            
            // 检查子进程状态
            if (shellPid > 0) {
                int status;
                pid_t result = waitpid(shellPid, &status, WNOHANG);
                if (result == shellPid) {
                    // 子进程已退出
                    exitCode = WEXITSTATUS(status);
                    shellPid = -1;
                    break;
                }
            }
        }
    }
    
    bool writeToShell(const std::string& data) {
        if (masterFd < 0) {
            return false;
        }
        
        ssize_t totalWritten = 0;
        const char* ptr = data.c_str();
        size_t remaining = data.size();
        
        while (remaining > 0 && !shouldStop) {
            ssize_t written = write(masterFd, ptr, remaining);
            if (written <= 0) {
                if (errno == EAGAIN || errno == EWOULDBLOCK) {
                    std::this_thread::sleep_for(std::chrono::milliseconds(10));
                    continue;
                }
                return false;
            }
            totalWritten += written;
            ptr += written;
            remaining -= written;
        }
        
        return true;
    }
    
    bool ensureRunning() {
        if (state != STATE_RUNNING) {
            return start();
        }
        return true;
    }
    
    // 成员变量
    ShellConfig config;
    std::atomic<ShellState> state;
    std::atomic<int> shellPid;
    std::atomic<int> masterFd;
    std::atomic<int> slaveFd;
    std::atomic<int> exitCode;
    std::atomic<bool> shouldStop;
    
    std::thread readThread;
    std::mutex outputMutex;
    std::string outputBuffer;
    
    std::map<std::string, std::string> envVars;
    std::map<std::string, std::string> defaultEnvVars;
    std::vector<std::string> commandHistory;
    
    std::function<void(const std::string&, bool)> outputCallback;
    std::function<void(ShellState)> stateCallback;
};

// Shell类实现
Shell::Shell() : impl(std::make_unique<Impl>(ShellConfig())) {}

Shell::Shell(const ShellConfig& config) : impl(std::make_unique<Impl>(config)) {}

Shell::~Shell() = default;

Shell::CommandResult Shell::exec(const std::string& cmd) {
    return impl->exec(cmd);
}

Shell::CommandResult Shell::exec(const std::string& cmd, const std::map<std::string, std::string>& env) {
    auto oldEnv = impl->envVars;
    for (const auto& kv : env) {
        impl->envVars[kv.first] = kv.second;
    }
    
    auto result = impl->exec(cmd);
    
    impl->envVars = oldEnv;
    return result;
}

bool Shell::start() {
    return impl->start();
}

bool Shell::start(const std::string& shellPath) {
    impl->config.shellPath = shellPath;
    return impl->start();
}

bool Shell::restart() {
    impl->stop();
    return impl->start();
}

void Shell::stop() {
    impl->stop();
}

bool Shell::writeInput(const std::string& input) {
    return impl->writeToShell(input);
}

bool Shell::writeInputLine(const std::string& line) {
    return impl->writeToShell(line + "\n");
}

void Shell::setOutputCallback(std::function<void(const std::string&, bool)> callback) {
    impl->outputCallback = callback;
}

void Shell::setStateCallback(std::function<void(ShellState)> callback) {
    impl->stateCallback = callback;
}

bool Shell::resizeTerminal(int rows, int cols) {
    if (impl->masterFd < 0) {
        return false;
    }
    
    struct winsize ws;
    ws.ws_row = rows;
    ws.ws_col = cols;
    ws.ws_xpixel = 0;
    ws.ws_ypixel = 0;
    
    return ioctl(impl->masterFd, TIOCSWINSZ, &ws) == 0;
}

void Shell::sendSignal(int signal) {
    if (impl->shellPid > 0) {
        kill(impl->shellPid, signal);
    }
}

void Shell::sendCtrlC() {
    if (impl->masterFd >= 0) {
        char ctrlC = 0x03;
        write(impl->masterFd, &ctrlC, 1);
    }
}

void Shell::sendCtrlD() {
    if (impl->masterFd >= 0) {
        char ctrlD = 0x04;
        write(impl->masterFd, &ctrlD, 1);
    }
}

void Shell::sendCtrlZ() {
    if (impl->masterFd >= 0) {
        char ctrlZ = 0x1A;
        write(impl->masterFd, &ctrlZ, 1);
    }
}

Shell::ShellState Shell::getState() const {
    return impl->state;
}

int Shell::getPid() const {
    return impl->shellPid;
}

Shell::ShellType Shell::getType() const {
    return impl->config.type;
}

std::string Shell::getShellPath() const {
    return impl->config.shellPath;
}

std::vector<std::string> Shell::getCommandHistory() const {
    return impl->commandHistory;
}

void Shell::clearCommandHistory() {
    impl->commandHistory.clear();
}

Shell::CommandResult Shell::execScript(const std::vector<std::string>& commands) {
    CommandResult result;
    std::string script;
    
    for (const auto& cmd : commands) {
        script += cmd + "\n";
    }
    
    // 将脚本写入临时文件
    char tempFile[] = "/tmp/shell_script_XXXXXX";
    int fd = mkstemp(tempFile);
    if (fd == -1) {
        result.error = "Failed to create temp file";
        return result;
    }
    
    write(fd, script.c_str(), script.size());
    close(fd);
    
    // 执行脚本
    result = exec("bash " + std::string(tempFile));
    
    // 删除临时文件
    unlink(tempFile);
    
    return result;
}

Shell::CommandResult Shell::execScriptFile(const std::string& filePath) {
    CommandResult result;
    
    std::ifstream file(filePath);
    if (!file.is_open()) {
        result.error = "Failed to open script file: " + filePath;
        return result;
    }
    
    std::string script((std::istreambuf_iterator<char>(file)),
                       std::istreambuf_iterator<char>());
    
    // 根据文件扩展名选择解释器
    std::string interpreter;
    if (filePath.find(".sh") != std::string::npos) {
        interpreter = "bash";
    } else if (filePath.find(".py") != std::string::npos) {
        interpreter = "python";
    } else if (filePath.find(".js") != std::string::npos) {
        interpreter = "node";
    } else {
        interpreter = "bash";
    }
    
    result = exec(interpreter + " " + filePath);
    return result;
}

void Shell::execAsync(const std::string& cmd, 
                       std::function<void(const CommandResult&)> callback) {
    std::thread([this, cmd, callback]() {
        auto result = this->exec(cmd);
        callback(result);
    }).detach();
}

void Shell::execStream(const std::string& cmd,
                        std::function<void(const std::string&, bool)> onOutput) {
    std::thread([this, cmd, onOutput]() {
        CommandResult result;
        auto oldCallback = impl->outputCallback;
        
        // 临时设置回调
        impl->outputCallback = onOutput;
        result = this->exec(cmd);
        
        // 恢复原回调
        impl->outputCallback = oldCallback;
    }).detach();
}