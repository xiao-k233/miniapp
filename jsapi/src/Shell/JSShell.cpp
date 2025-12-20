#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <sstream>
#include <iostream>
#include <algorithm>

std::map<int, JSShell*> JSShell::activeShells;
std::mutex JSShell::activeShellsMutex;

JSShell::JSShell() : isInitialized(false) {}

JSShell::~JSShell() {
    std::lock_guard<std::mutex> lock(shellMutex);
    if (shell) {
        shell->stop();
        
        // 从活动Shell列表中移除
        std::lock_guard<std::mutex> lock2(activeShellsMutex);
        for (auto it = activeShells.begin(); it != activeShells.end();) {
            if (it->second == this) {
                it = activeShells.erase(it);
            } else {
                ++it;
            }
        }
    }
}

Shell::ShellType JSShell::stringToShellType(const std::string& typeStr) {
    if (typeStr == "popen") return Shell::SHELL_POPEN;
    if (typeStr == "background") return Shell::SHELL_BACKGROUND;
    return Shell::SHELL_INTERACTIVE; // 默认为交互式
}

void JSShell::onShellOutput(const std::string& output, bool isError) {
    if (isError) {
        publish("error", JQValue(output));
    } else {
        publish("output", JQValue(output));
    }
}

void JSShell::onShellStateChange(Shell::ShellState state) {
    publish("state", JQValue(static_cast<int>(state)));
}

void JSShell::initialize(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        if (shell) {
            shell->stop();
        }
        
        // 创建默认配置的Shell
        Shell::ShellConfig shellConfig;
        shellConfig.type = Shell::SHELL_POPEN;
        shell = std::make_unique<Shell>(shellConfig);
        
        isInitialized = true;
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::create(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_object());
        
        JQObjectRef configObj = info[0].toObject();
        
        // 解析配置
        if (configObj.has("type")) {
            config.shellType = configObj.get("type").string_value();
        }
        if (configObj.has("shellPath")) {
            config.shellPath = configObj.get("shellPath").string_value();
        }
        if (configObj.has("enableColor")) {
            config.enableColor = configObj.get("enableColor").bool_value();
        }
        if (configObj.has("rows")) {
            config.rows = configObj.get("rows").int_value();
        }
        if (configObj.has("cols")) {
            config.cols = configObj.get("cols").int_value();
        }
        if (configObj.has("env")) {
            config.env = configObj.get("env");
        }
        
        std::lock_guard<std::mutex> lock(shellMutex);
        if (shell) {
            shell->stop();
        }
        
        // 创建Shell配置
        Shell::ShellConfig shellConfig;
        shellConfig.type = stringToShellType(config.shellType);
        shellConfig.shellPath = config.shellPath;
        shellConfig.enableColor = config.enableColor;
        shellConfig.initialRows = config.rows;
        shellConfig.initialCols = config.cols;
        
        // 设置环境变量
        if (config.env.is_object()) {
            JQObjectRef envObj = config.env.toObject();
            auto envKeys = envObj.getPropertyNames();
            for (size_t i = 0; i < envKeys.size(); i++) {
                std::string key = envKeys[i].string_value();
                std::string value = envObj.get(envKeys[i]).string_value();
                shellConfig.envVars[key] = value;
            }
        }
        
        // 创建Shell实例
        shell = std::make_unique<Shell>(shellConfig);
        
        // 设置回调
        shell->setOutputCallback([this](const std::string& output, bool isError) {
            this->onShellOutput(output, isError);
        });
        
        shell->setStateCallback([this](Shell::ShellState state) {
            this->onShellStateChange(state);
        });
        
        // 添加到活动Shell列表
        std::lock_guard<std::mutex> lock2(activeShellsMutex);
        activeShells[shell->getPid()] = this;
        
        isInitialized = true;
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::exec(JQAsyncInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string cmd = info[0].string_value();
        
        // 普通命令执行
        auto result = shell->exec(cmd);
        
        // 构建结果对象
        JQObjectRef resultObj = JQObjectRef::New(info.env());
        resultObj.set("success", JQValue(result.success));
        resultObj.set("exitCode", JQValue(result.exitCode));
        resultObj.set("output", JQValue(result.output));
        resultObj.set("error", JQValue(result.error));
        resultObj.set("executionTime", JQValue(result.executionTime));
        
        info.post(resultObj);
        
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::execScript(JQAsyncInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_array());
        
        JQArrayRef commands = info[0].toArray();
        std::vector<std::string> cmdList;
        
        for (size_t i = 0; i < commands.size(); i++) {
            cmdList.push_back(commands.get(i).string_value());
        }
        
        auto result = shell->execScript(cmdList);
        
        JQObjectRef resultObj = JQObjectRef::New(info.env());
        resultObj.set("success", JQValue(result.success));
        resultObj.set("exitCode", JQValue(result.exitCode));
        resultObj.set("output", JQValue(result.output));
        resultObj.set("error", JQValue(result.error));
        
        info.post(resultObj);
        
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::execFile(JQAsyncInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string filePath = info[0].string_value();
        auto result = shell->execScriptFile(filePath);
        
        JQObjectRef resultObj = JQObjectRef::New(info.env());
        resultObj.set("success", JQValue(result.success));
        resultObj.set("exitCode", JQValue(result.exitCode));
        resultObj.set("output", JQValue(result.output));
        resultObj.set("error", JQValue(result.error));
        
        info.post(resultObj);
        
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::start(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        bool success = shell->start();
        
        info.GetReturnValue().Set(success);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::stop(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->stop();
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::restart(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        bool success = shell->restart();
        
        info.GetReturnValue().Set(success);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::write(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string input = info[0].string_value();
        
        std::lock_guard<std::mutex> lock(shellMutex);
        bool success = shell->writeInputLine(input);
        
        info.GetReturnValue().Set(success);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendSignal(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_number());
        
        int signal = info[0].int_value();
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->sendSignal(signal);
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendCtrlC(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->sendCtrlC();
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendCtrlD(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->sendCtrlD();
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendCtrlZ(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->sendCtrlZ();
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::resize(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 2);
        ASSERT(info[0].is_number());
        ASSERT(info[1].is_number());
        
        int rows = info[0].int_value();
        int cols = info[1].int_value();
        
        std::lock_guard<std::mutex> lock(shellMutex);
        bool success = shell->resizeTerminal(rows, cols);
        
        info.GetReturnValue().Set(success);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::getState(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        auto state = shell->getState();
        
        info.GetReturnValue().Set(static_cast<int>(state));
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::getPid(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        int pid = shell->getPid();
        
        info.GetReturnValue().Set(pid);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::getHistory(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        auto history = shell->getCommandHistory();
        
        JQArrayRef historyArr = JQArrayRef::New(info.env(), history.size());
        for (size_t i = 0; i < history.size(); i++) {
            historyArr.set(i, JQValue(history[i].c_str()));
        }
        
        info.GetReturnValue().Set(historyArr);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::clearHistory(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(shellMutex);
        shell->clearCommandHistory();
        
        info.GetReturnValue().Set(true);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::execInteractive(JQAsyncInfo& info)
{
    try {
        ASSERT(info.Length() >= 1);
        ASSERT(info[0].is_string());
        
        std::string program = info[0].string_value();
        std::vector<std::string> args;
        
        // 解析参数
        for (size_t i = 1; i < info.Length(); i++) {
            if (info[i].is_string()) {
                args.push_back(info[i].string_value());
            }
        }
        
        // 创建一个简单的shell对象来检查是否是交互式程序
        bool isInteractive = false;
        static const std::vector<std::string> interactivePrograms = {
            "vi", "vim", "nano", "emacs",
            "top", "htop", "less", "more",
            "neofetch", "screenfetch",
            "mc", "ranger", "nnn",
            "ssh", "telnet", "ftp"
        };
        
        for (const auto& prog : interactivePrograms) {
            if (program.find(prog) == 0) {
                isInteractive = true;
                break;
            }
        }
        
        if (isInteractive) {
            // 构建命令
            std::string cmd = program;
            for (const auto& arg : args) {
                cmd += " " + arg;
            }
            
            // 启动交互式程序
            if (shell->getType() != Shell::SHELL_INTERACTIVE) {
                info.postError("Interactive programs require interactive shell mode");
                return;
            }
            
            std::lock_guard<std::mutex> lock(shellMutex);
            bool written = shell->writeInputLine(cmd);
            
            if (written) {
                info.post("Interactive program started: " + program);
            } else {
                info.postError("Failed to start interactive program");
            }
        } else {
            info.postError("Program is not recognized as interactive: " + program);
        }
        
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

JSValue createShell(JQModuleEnv* env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Shell");
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSShell();
    });

    // Shell配置和创建
    tpl->SetProtoMethod("initialize", &JSShell::initialize);
    tpl->SetProtoMethod("create", &JSShell::create);
    
    // 命令执行
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);
    tpl->SetProtoMethodPromise("execScript", &JSShell::execScript);
    tpl->SetProtoMethodPromise("execFile", &JSShell::execFile);
    tpl->SetProtoMethodPromise("execInteractive", &JSShell::execInteractive);
    
    // 交互式控制
    tpl->SetProtoMethod("start", &JSShell::start);
    tpl->SetProtoMethod("stop", &JSShell::stop);
    tpl->SetProtoMethod("restart", &JSShell::restart);
    tpl->SetProtoMethod("write", &JSShell::write);
    
    // 信号控制
    tpl->SetProtoMethod("sendSignal", &JSShell::sendSignal);
    tpl->SetProtoMethod("sendCtrlC", &JSShell::sendCtrlC);
    tpl->SetProtoMethod("sendCtrlD", &JSShell::sendCtrlD);
    tpl->SetProtoMethod("sendCtrlZ", &JSShell::sendCtrlZ);
    
    // 终端控制
    tpl->SetProtoMethod("resize", &JSShell::resize);
    
    // 信息查询
    tpl->SetProtoMethod("getState", &JSShell::getState);
    tpl->SetProtoMethod("getPid", &JSShell::getPid);
    tpl->SetProtoMethod("getHistory", &JSShell::getHistory);
    tpl->SetProtoMethod("clearHistory", &JSShell::clearHistory);
    
    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}