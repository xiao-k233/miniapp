// JSShell.hpp
#pragma once

#include "Shell.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>

using namespace JQUTIL_NS;

class JSShell : public JQPublishObject
{
private:
    std::unique_ptr<Shell> shell;
    std::mutex mutex;
    
    // 事件队列
    struct Event {
        std::string type;
        std::string data;
        int code{0};
    };
    std::vector<Event> eventQueue;
    
public:
    JSShell();
    ~JSShell();
    
    void initialize(JQFunctionInfo& info);
    void exec(JQAsyncInfo& info);
    
    // 新增方法
    void execAsync(JQAsyncInfo& info);
    void startInteractive(JQAsyncInfo& info);
    void writeInput(JQFunctionInfo& info);
    void sendSignal(JQFunctionInfo& info);
    void terminate(JQFunctionInfo& info);
    void isRunning(JQFunctionInfo& info);
    void setEnv(JQFunctionInfo& info);
    void getExitCode(JQFunctionInfo& info);
    
    // 处理事件
    void processEvents();
};