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

public:
    JSShell();
    ~JSShell();

    void initialize(JQFunctionInfo& info);
    void exec(JQAsyncInfo& info);
};

JSValue createShell(JQModuleEnv* env);
