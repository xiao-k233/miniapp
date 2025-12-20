#include "JSShell.hpp"
#include <Exceptions/AssertFailed.hpp>
#include <map>

using namespace JQUTIL_NS;

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

void JSShell::execDetailed(JQAsyncInfo& info)
{
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());

        std::lock_guard<std::mutex> lock(mutex);
        std::string cmd = info[0].string_value();
        std::string output = shell->exec(cmd);
        
        // 使用 std::map 创建 Bson 对象
        std::map<std::string, Bson> resultMap;
        resultMap["success"] = Bson(true);
        resultMap["output"] = Bson(output);
        resultMap["exitCode"] = Bson(0);
        resultMap["error"] = Bson("");
        
        Bson resultObj(resultMap);
        info.post(resultObj);
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
    tpl->SetProtoMethodPromise("execDetailed", &JSShell::execDetailed);

    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}