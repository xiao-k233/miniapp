#pragma once

#include "Shell.hpp"
#include <jqutil_v2/jqutil.h>
#include <memory>
#include <mutex>
#include <string>
#include <functional>

using namespace JQUTIL_NS;

class JSShell : public JQPublishObject
{
private:
    std::unique_ptr<Shell> shell;
    std::mutex mutex;
    std::string shellId;  // 用于标识Shell会话
    bool isPersistent;    // 是否是持久化Shell

public:
    JSShell();
    ~JSShell();

    void initialize(JQFunctionInfo& info);
    void createSession(JQFunctionInfo& info);  // 创建新的Shell会话
    void exec(JQAsyncInfo& info);
    void write(JQFunctionInfo& info);          // 向Shell会话写入数据
    void close(JQFunctionInfo& info);          // 关闭Shell会话
    void listSessions(JQFunctionInfo& info);   // 列出所有会话

    // 内部方法
    void onShellOutput(const std::string& sessionId, const std::string& output);
};

JSValue createShell(JQModuleEnv* env);