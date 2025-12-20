#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <unordered_map>
#include <iostream>

// 全局Shell会话管理器
namespace {
    std::unordered_map<std::string, std::shared_ptr<Shell>> shellSessions;
    std::mutex sessionsMutex;
    std::unordered_map<std::string, JSShell*> sessionCallbacks;
}

JSShell::JSShell() : isPersistent(false) {}

JSShell::~JSShell() {
    std::lock_guard<std::mutex> lock(sessionsMutex);
    if (!shellId.empty()) {
        auto it = sessionCallbacks.find(shellId);
        if (it != sessionCallbacks.end()) {
            sessionCallbacks.erase(it);
        }
    }
}

void JSShell::onShellOutput(const std::string& sessionId, const std::string& output) {
    // 触发JavaScript事件
    JQPublishObject::publish("shellOutput", {
        JQValue(sessionId),
        JQValue(output)
    });
}

void JSShell::initialize(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        std::lock_guard<std::mutex> lock(mutex);
        shell = std::make_unique<Shell>();
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::createSession(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 0);
        
        std::lock_guard<std::mutex> lock(sessionsMutex);
        
        // 生成唯一的会话ID
        static int sessionCounter = 0;
        shellId = "shell_" + std::to_string(++sessionCounter);
        
        // 创建新的Shell会话
        auto newShell = std::make_shared<Shell>();
        
        // 启动交互式Shell
        if (newShell->startInteractive("/bin/sh")) {
            shellSessions[shellId] = newShell;
            sessionCallbacks[shellId] = this;
            isPersistent = true;
            
            // 设置输出回调
            newShell->setOutputCallback([this, id = shellId](const std::string& output) {
                this->onShellOutput(id, output);
            });
            
            info.GetReturnValue().Set(shellId);
        } else {
            info.GetReturnValue().Set(false);
        }
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::exec(JQAsyncInfo& info)
{
    try {
        if (isPersistent && !shellId.empty()) {
            // 持久化Shell模式
            std::lock_guard<std::mutex> lock(sessionsMutex);
            auto it = shellSessions.find(shellId);
            if (it != shellSessions.end()) {
                std::string cmd = info[0].string_value();
                it->second->writeToShell(cmd + "\n");
                info.post("Command sent to shell session: " + shellId);
                return;
            }
        }
        
        // 传统的一次性执行模式
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());

        std::string cmd = info[0].string_value();
        std::string output = shell->exec(cmd);
        info.post(output);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::write(JQFunctionInfo& info)
{
    try {
        ASSERT(info.Length() == 1 || info.Length() == 2);
        ASSERT(info[0].is_string());
        
        std::string data = info[0].string_value();
        std::string sessionId = shellId;
        
        // 如果传入了第二个参数，使用指定的sessionId
        if (info.Length() == 2 && info[1].is_string()) {
            sessionId = info[1].string_value();
        }
        
        if (sessionId.empty()) {
            info.GetReturnValue().ThrowInternalError("No active shell session");
            return;
        }
        
        std::lock_guard<std::mutex> lock(sessionsMutex);
        auto it = shellSessions.find(sessionId);
        if (it != shellSessions.end()) {
            it->second->writeToShell(data);
            info.GetReturnValue().Set(true);
        } else {
            info.GetReturnValue().Set(false);
        }
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::close(JQFunctionInfo& info)
{
    try {
        std::string sessionId = shellId;
        
        if (info.Length() > 0 && info[0].is_string()) {
            sessionId = info[0].string_value();
        }
        
        if (sessionId.empty()) {
            info.GetReturnValue().Set(false);
            return;
        }
        
        std::lock_guard<std::mutex> lock(sessionsMutex);
        auto it = shellSessions.find(sessionId);
        if (it != shellSessions.end()) {
            it->second->close();
            shellSessions.erase(it);
            
            auto cbIt = sessionCallbacks.find(sessionId);
            if (cbIt != sessionCallbacks.end()) {
                sessionCallbacks.erase(cbIt);
            }
            
            // 如果是当前会话
            if (sessionId == shellId) {
                shellId.clear();
                isPersistent = false;
            }
            
            info.GetReturnValue().Set(true);
        } else {
            info.GetReturnValue().Set(false);
        }
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::listSessions(JQFunctionInfo& info)
{
    try {
        std::lock_guard<std::mutex> lock(sessionsMutex);
        auto result = JQValue::createArray();
        int index = 0;
        
        for (const auto& pair : shellSessions) {
            result.setProperty(index++, JQValue(pair.first));
        }
        
        info.GetReturnValue().Set(result);
        
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

JSValue createShell(JQModuleEnv* env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Shell");
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSShell();
    });

    tpl->SetProtoMethod("initialize", &JSShell::initialize);
    tpl->SetProtoMethod("createSession", &JSShell::createSession);
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);
    tpl->SetProtoMethod("write", &JSShell::write);
    tpl->SetProtoMethod("close", &JSShell::close);
    tpl->SetProtoMethod("listSessions", &JSShell::listSessions);

    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}