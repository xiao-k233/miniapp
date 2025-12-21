#pragma once

#include "Shell.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>
#include <unordered_map>
#include <atomic>

using namespace JQUTIL_NS;

class JSShell : public JQPublishObject
{
private:
    std::unique_ptr<Shell> shell;
    std::mutex mutex;
    std::unordered_map<int, std::unique_ptr<Shell::InteractiveSession>> sessions;
    std::atomic<int> nextSessionId{0};
    
    int createSession();
    Shell::InteractiveSession* getSession(int sessionId);
    void removeSession(int sessionId);

public:
    JSShell();
    ~JSShell();

    void initialize(JQFunctionInfo& info);
    void exec(JQAsyncInfo& info);
    
    // 新增交互式接口
    void createInteractiveSession(JQFunctionInfo& info);
    void startInteractive(JQAsyncInfo& info);
    void writeToSession(JQFunctionInfo& info);
    void readFromSession(JQFunctionInfo& info);
    void resizeSession(JQFunctionInfo& info);
    void sendSignalToSession(JQFunctionInfo& info);
    void terminateSession(JQFunctionInfo& info);
    void isSessionRunning(JQFunctionInfo& info);
    void getSessionPid(JQFunctionInfo& info);
};

JSValue createShell(JQModuleEnv* env);