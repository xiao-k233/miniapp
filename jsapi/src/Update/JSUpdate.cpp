#include "JSUpdate.hpp"
#include "jqutil_v2/JQFunctionTemplate.h"
#include "Fetch.hpp"
#include "nlohmann/json.hpp"
#include <string>
#include <sstream>

using namespace JQUTIL_NS;
using json = nlohmann::json;

static std::string g_owner = "octocat";
static std::string g_repo  = "Hello-World";

static bool versionGreater(const std::string& a, const std::string& b)
{
    std::stringstream sa(a), sb(b);
    char dot;
    int va = 0, vb = 0;

    while (sa.good() || sb.good()) {
        sa >> va;
        sb >> vb;
        if (va != vb) return va > vb;
        sa >> dot;
        sb >> dot;
    }
    return false;
}

static void js_setRepo(JQFunctionInfo& info)
{
    if (info.Length() < 1) return;

    auto ctx = info.GetContext();
    JSValue obj = info[0];

    JSValue o = JS_GetPropertyStr(ctx, obj, "owner");
    JSValue r = JS_GetPropertyStr(ctx, obj, "repo");

    if (!JS_IsUndefined(o)) g_owner = JS_ToCString(ctx, o);
    if (!JS_IsUndefined(r)) g_repo  = JS_ToCString(ctx, r);

    JS_FreeValue(ctx, o);
    JS_FreeValue(ctx, r);
}

static void js_check(JQAsyncInfo& info)
{
    if (info.Length() < 1) {
        info.postError("currentVersion required");
        return;
    }

    std::string currentVersion = info[0].stringValue();

    std::string url =
        "https://api.github.com/repos/" + g_owner + "/" + g_repo + "/releases/latest";

    Fetch::get(
        url,
        [info, currentVersion](const std::string& body) mutable {
            json j = json::parse(body);

            std::string tag = j["tag_name"];
            bool hasUpdate = versionGreater(tag, currentVersion);

            json res = {
                {"hasUpdate", hasUpdate},
                {"latestVersion", tag},
                {"name", j["name"]},
                {"body", j["body"]},
                {"url", j["html_url"]}
            };

            info.postJSON(res.dump());
        },
        [info](const std::string& err) mutable {
            info.postError(err);
        }
    );
}

JSValue createUpdate(JQModuleEnv* env)
{
    auto tpl = JQFunctionTemplate::New(env->tplEnv(), "Update");

    tpl->SetStaticMethod("setRepo", js_setRepo);
    tpl->SetStaticMethodPromise("check", js_check);

    return tpl->GetFunction();
}
