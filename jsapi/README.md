# JSAPI 模块文档

本文档详细介绍了 `jsapi` 目录的结构、功能模块以及 API 接口。该项目基于 QuickJS 和 C++ 开发，为 IoT 小程序 SDK 提供原生能力扩展。

## 目录结构

*   `CMakeLists.txt`: 项目构建脚本，定义了依赖和编译选项。
*   `include/`: 第三方库头文件 (curl, sqlite3)。
*   `lib/`: 第三方库动态链接库。
*   `iot-miniapp-sdk/`: 核心 SDK，封装了 QuickJS 绑定、线程池、消息循环等基础组件。
*   `src/`: JSAPI 模块的具体实现代码。
    *   `AI/`: 人工智能对话模块。
    *   `IME/`: 输入法模块。
    *   `ScanInput/`: 扫码输入模块。
    *   `Shell/`: 系统命令执行模块。
    *   `Update/`: 应用更新模块。
    *   `Database/`: SQLite 数据库封装 (内部使用)。
    *   `Fetch.cpp/hpp`: HTTP 网络请求封装 (内部使用)。

## 模块注册

模块统一在 `src/JSAPI.cpp` 中注册，模块名为 `langningchen`。
加载后，通过 `require('langningchen')` 或全局对象访问（取决于 SDK 加载策略）。

## 核心 JSAPI 模块

### 1. AI (人工智能)
提供与 LLM (大语言模型) 对话的能力，支持多分支对话树管理。

**主要接口:**
*   `initialize()`: 初始化 AI 引擎。
*   `setSettings(apiKey, baseUrl, modelName, maxTokens, temperature, topP, systemPrompt)`: 设置 API 配置。
*   `addUserMessage(content)`: 添加用户消息。
*   `generateResponse()`: 触发模型生成回复（流式）。
*   `stopGeneration()`: 停止生成。
*   `getCurrentPath()`: 获取当前对话完整路径。
*   `switchToNode(nodeId)`: 切换到指定的对话分支节点。
*   `getConversationList()`: 获取会话列表。
*   `createConversation(title)`: 创建新会话。
*   `loadConversation(id)`: 加载指定会话。
*   `deleteConversation(id)`: 删除会话。

### 2. IME (输入法)
提供拼音输入法候选词检索功能。

**主要接口:**
*   `initialize()`: 加载词库。
*   `getCandidates(pinyin)`: 根据拼音获取候选词列表。
*   `splitPinyin(input)`: 分割拼音字符串。
*   `updateWordFrequency(word)`: 更新词频。

### 3. ScanInput (扫码输入)
处理扫码设备的输入事件。

**主要接口:**
*   `initialize()`: 初始化扫码监听。
*   `deinitialize()`: 停止监听。

### 4. Shell (系统命令)
允许执行宿主系统的 Shell 命令。

**主要接口:**
*   `exec(command)`: 异步执行 Shell 命令并返回结果。

### 5. Update (更新)
提供应用自动更新功能，支持从 GitHub Releases 下载。

**主要接口:**
*   `setRepo(config)`: 配置仓库信息 (owner, repo, path 等)。
*   `check()`: 检查是否有新版本。
*   `download()`: 下载更新包。
*   `cleanup()`: 清理临时文件。

## 基础设施 (C++ Internal)

### Fetch
位于 `src/Fetch.hpp`，基于 `libcurl` 实现的 HTTP 客户端。
*   支持 HTTPS。
*   支持流式响应 (Stream Callback)，用于 AI 打字机效果。
*   支持超时和取消操作。

### Database
位于 `src/Database`，基于 `sqlite3` 实现的轻量级 ORM。
*   支持链式调用: `db.table("users").select().where("id", 1).execute()`。
*   用于 AI 模块存储对话历史和设置。

### iot-miniapp-sdk
位于 `jsapi/iot-miniapp-sdk`，核心基础库。
*   **QuickJS 封装**: `JQPublishObject`, `JQFunctionInfo`, `JQAsyncInfo` 等类简化了 C++ 与 JS 的交互。
*   **线程模型**: 提供 `Looper`, `Handler`, `Thread` 等 Android 风格的消息循环机制，确保 JS 回调在正确线程执行。
*   **工具类**: `jqutil_v2` 提供了大量辅助函数。

## 构建指南

项目使用 CMake 构建。

```bash
mkdir build && cd build
cmake ..
make
```

依赖项 `curl` 和 `sqlite3` 库文件需位于 `jsapi/lib` 目录下。
