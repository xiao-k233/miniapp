// JSShell.cpp
void JSShell::exec(JQAsyncInfo& info) {
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() == 1);
        ASSERT(info[0].is_string());

        std::lock_guard<std::mutex> lock(mutex);
        std::string cmd = info[0].string_value();
        ShellResult result = shell->exec(cmd);
        
        // 创建返回对象
        JSValue obj = JSValue::Object();
        obj.setProperty("output", result.output);
        obj.setProperty("exitCode", result.exitCode);
        obj.setProperty("error", result.error);
        
        info.post(obj);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

// 新增方法：执行命令并获取详细结果
void JSShell::execDetailed(JQAsyncInfo& info) {
    try {
        ASSERT(shell != nullptr);
        ASSERT(info.Length() >= 1);
        ASSERT(info[0].is_string());

        std::lock_guard<std::mutex> lock(mutex);
        std::string cmd = info[0].string_value();
        
        // 如果有参数
        std::vector<std::string> args;
        if (info.Length() > 1 && info[1].is_array()) {
            auto argArray = info[1].array_value();
            for (size_t i = 0; i < argArray.size(); ++i) {
                if (argArray[i].is_string()) {
                    args.push_back(argArray[i].string_value());
                }
            }
        }
        
        ShellResult result;
        if (args.empty()) {
            result = shell->exec(cmd);
        } else {
            result = shell->exec(cmd, args);
        }
        
        // 返回详细结果
        JSValue obj = JSValue::Object();
        obj.setProperty("success", result.exitCode == 0);
        obj.setProperty("output", result.output);
        obj.setProperty("exitCode", result.exitCode);
        obj.setProperty("error", result.error);
        
        info.post(obj);
    } catch (const std::exception& e) {
        info.postError(e.what());
    }
}

// 在 createShell 中添加新方法
JSValue createShell(JQModuleEnv* env) {
    JQFunctionTemplateRef tpl = JQFunctionTemplate::New(env, "Shell");
    tpl->InstanceTemplate()->setObjectCreator([]() {
        return new JSShell();
    });

    tpl->SetProtoMethod("initialize", &JSShell::initialize);
    tpl->SetProtoMethodPromise("exec", &JSShell::exec);
    tpl->SetProtoMethodPromise("execDetailed", &JSShell::execDetailed); // 新增

    JSShell::InitTpl(tpl);
    return tpl->CallConstructor();
}