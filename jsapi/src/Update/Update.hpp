#pragma once
#include <string>
#include "jqutil_v2/JQBaseObject.h"
#include "jqutil_v2/JQFuncDef.h"

namespace JSAPI {

class Update : public jqutil_dist::JQBaseObject {
public:
    Update();

    void setRepo(jqutil_dist::JQFunctionInfo& info);
    void check(jqutil_dist::JQAsyncInfo& info);

private:
    std::string owner = "default_owner";
    std::string repo  = "default_repo";

    static bool versionGreater(const std::string& a, const std::string& b);
};

}
