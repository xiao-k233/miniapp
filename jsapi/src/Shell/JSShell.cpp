#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <nlohmann/json.hpp>
#include <sstream>

JSShell::JSShell() {}
JSShell::~JSShell() {
    sessions.clear();
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

int JSShell::createSession() {
    int sessionId = nextSessionId++;
    sessions[sessionId] = Shell::createInteractiveSession();
    return sessionId;
}

Shell::InteractiveSession* JSShell::getSession(int sessionId) {
    auto it = sessions.find(sessionId);
    return (it != sessions.end()) ? it->second.get() : nullptr;
}

void JSShell::removeSession(int sessionId) {
    sessions.erase(sessionId);
}

void JSShell::createInteractiveSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 0);
        int sessionId = createSession();
        info.GetReturnValue().Set(sessionId);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::startInteractive(JQAsyncInfo& info) {
    try {
        ASSERT(info.Length() >= 1 && info.Length() <= 2);
        
        int sessionId = info[0].int32_value();
        std::string command = info[1].string_value();
        
        Shell::PTYConfig config;
        if (info.Length() == 3 && info[2].is_object()) {
            JSContext* ctx = info.GetContext();
            JQObject obj(ctx, info[2]);
            
            if (obj.has("rows")) {
                config.rows = JQNumber(ctx, obj.get("rows")).getInt32();
            }
            if (obj.has("cols")) {
                config.cols = JQNumber(ctx, obj.get("cols")).getInt32();
            }
            if (obj.has("echo")) {
                config.echo = JQBoolean(ctx, obj.get("echo")).getBoolean();
            }
            if (obj.has("canonical")) {
                config.canonical = JQBoolean(ctx, obj.get("canonical")).getBoolean();
            }
            if (obj.has("termType")) {
                config.termType = JQString(ctx, obj.get("termType")).getString();
            }
        }
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        // 设置输出回调，将输出发布为事件
        session->setOutputCallback([this, sessionId](const std::string& output) {
            Bson::object eventData = {
                {"sessionId", sessionId},
                {"output", output},
                {"type", "data"}
            };
            publish("session_output", eventData);
        });
        
        bool started = session->start(command, config);
        
        Bson::object result = {
            {"sessionId", sessionId},
            {"started", started},
            {"pid", static_cast<int>(session->getPid())}
        };
        
        info.post(result);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

void JSShell::writeToSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 2);
        
        int sessionId = info[0].int32_value();
        std::string data = info[1].string_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        bool success = session->write(data);
        info.GetReturnValue().Set(success);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::readFromSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 1);
        
        int sessionId = info[0].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        std::string output = session->read();
        info.GetReturnValue().Set(output);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::resizeSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 3);
        
        int sessionId = info[0].int32_value();
        int rows = info[1].int32_value();
        int cols = info[2].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        bool success = session->resize(rows, cols);
        info.GetReturnValue().Set(success);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::sendSignalToSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 2);
        
        int sessionId = info[0].int32_value();
        int signal = info[1].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        bool success = session->sendSignal(signal);
        info.GetReturnValue().Set(success);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::terminateSession(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 1);
        
        int sessionId = info[0].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        session->terminate();
        removeSession(sessionId);
        
        info.GetReturnValue().Set(true);
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::isSessionRunning(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 1);
        
        int sessionId = info[0].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        info.GetReturnValue().Set(session->isRunning());
    } catch (const std::exception& e) {
        info.GetReturnValue().ThrowInternalError(e.what());
    }
}

void JSShell::getSessionPid(JQFunctionInfo& info) {
    try {
        ASSERT(info.Length() == 1);
        
        int sessionId = info[0].int32_value();
        
        auto* session = getSession(sessionId);
        ASSERT(session != nullptr);
        
        info.GetReturnValue().Set(static_cast<int>(session->getPid()));
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
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);
    
    // 新增交互式接口
    tpl->SetProtoMethod("createInteractiveSession", &JSShell::createInteractiveSession);
    tpl->SetProtoMethodPromise("startInteractive", &JSShell::startInteractive);
    tpl->SetProtoMethod("writeToSession", &JSShell::writeToSession);
    tpl->SetProtoMethod("readFromSession", &JSShell::readFromSession);
    tpl->SetProtoMethod("resizeSession", &JSShell::resizeSession);
    tpl->SetProtoMethod("sendSignalToSession", &JSShell::sendSignalToSession);
    tpl->SetProtoMethod("terminateSession", &JSShell::terminateSession);
    tpl->SetProtoMethod("isSessionRunning", &JSShell::isSessionRunning);
    tpl->SetProtoMethod("getSessionPid", &JSShell::getSessionPid);

    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}