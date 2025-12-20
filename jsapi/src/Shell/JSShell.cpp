#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <jqutil_v2/bson.h>  // 使用 Bson 构造 JS 对象

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

        std::lock_guard<std::mutex> lock(mutex);
        auto [output, code] = shell->exec(cmd);

        // 使用 Bson 构造 JS 对象
        Bson result;
        result["stdout"] = output;
        result["code"] = code;

        info.post(result); // 直接返回给 JS
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

    tpl->SetProtoMethod("initialize", &JSShell::initialize);
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);

    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}
