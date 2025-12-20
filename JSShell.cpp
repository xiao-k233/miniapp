#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <jqutil_v2/jqutil.h>
#include <queue>

JSShell::JSShell() {}
JSShell::~JSShell() {}

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

void JSShell::exec(JQAsyncInfo& info)
{
    try {
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

void JSShell::execAsync(JQAsyncInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() >= 1);
        ASSERT(info[0].is_string());
        
        std::string cmd = info[0].string_value();
        
        JQFunctionContextRef callback;
        if (info.Length() > 1 && info[1].is_function()) {
            callback = info[1].GetFunction();
        }
        
        shell->execAsync(
            cmd,
            [this, callback](const std::string& output) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"output", output, 0});
                
                // 如果注册了回调，直接调用
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(output));
                    cbInfo.AddArg(JQVAL("stdout"));
                    cbInfo.Call();
                }
            },
            [this, callback](int exitCode) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"exit", "", exitCode});
                
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(exitCode));
                    cbInfo.AddArg(JQVAL("exit"));
                    cbInfo.Call();
                }
            },
            [this, callback](const std::string& error) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"error", error, 0});
                
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(error));
                    cbInfo.AddArg(JQVAL("stderr"));
                    cbInfo.Call();
                }
            }
        );
        
        info.post(true);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::startInteractive(JQAsyncInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() >= 1);
        ASSERT(info[0].is_function());
        
        JQFunctionContextRef callback = info[0].GetFunction();
        
        shell->startInteractive(
            [this, callback](const std::string& output) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"output", output, 0});
                
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(output));
                    cbInfo.AddArg(JQVAL("stdout"));
                    cbInfo.Call();
                }
            },
            [this, callback](int exitCode) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"exit", "", exitCode});
                
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(exitCode));
                    cbInfo.AddArg(JQVAL("exit"));
                    cbInfo.Call();
                }
            },
            [this, callback](const std::string& error) {
                std::lock_guard<std::mutex> lock(mutex);
                eventQueue.push_back({"error", error, 0});
                
                if (callback) {
                    JQFunctionInfo cbInfo = callback->NewCall();
                    cbInfo.AddArg(JQVAL(error));
                    cbInfo.AddArg(JQVAL("stderr"));
                    cbInfo.Call();
                }
            }
        );
        
        info.post(true);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::writeInput(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());
        
        std::string input = info[0].string_value();
        shell->writeToInteractive(input);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendSignal(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_int32());
        
        int signal = info[0].int32_value();
        shell->sendSignal(signal);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::terminate(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        shell->terminate();
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::isRunning(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        bool running = shell->isRunning();
        info.GetReturnValue().Set(running);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::setEnv(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 2);
        ASSERT(info[0].is_string());
        ASSERT(info[1].is_string());
        
        std::string key = info[0].string_value();
        std::string value = info[1].string_value();
        
        shell->setEnv(key, value);
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::getExitCode(JQFunctionInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        int exitCode = shell->getLastExitCode();
        info.GetReturnValue().Set(exitCode);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::processEvents()
{
    std::vector<Event> events;
    {
        std::lock_guard<std::mutex> lock(mutex);
        events.swap(eventQueue);
    }
    
    // 处理事件队列 - 暂时留空，避免未使用变量警告
    // 未来可以在这里分发事件到JavaScript事件系统
    (void)events; // 标记为已使用，避免警告
}

JSValue createShell(JQModuleEnv* env)
{
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Shell");
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSShell();
    });

    tpl->SetProtoMethod("initialize", &JSShell::initialize);
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);
    
    // 新增方法
    tpl->SetProtoMethodPromise("execAsync", &JSShell::execAsync);
    tpl->SetProtoMethodPromise("startInteractive", &JSShell::startInteractive);
    tpl->SetProtoMethod("writeInput", &JSShell::writeInput);
    tpl->SetProtoMethod("sendSignal", &JSShell::sendSignal);
    tpl->SetProtoMethod("terminate", &JSShell::terminate);
    tpl->SetProtoMethod("isRunning", &JSShell::isRunning);
    tpl->SetProtoMethod("setEnv", &JSShell::setEnv);
    tpl->SetProtoMethod("getExitCode", &JSShell::getExitCode);

    // 如果有基类初始化方法
    // JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}