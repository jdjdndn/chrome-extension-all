# USE

## chrome devtools mcp

启动命令（以后使用）：

### 先清理锁文件

rm -rf "C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data\SingletonLock"
rm -rf "C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data\DevToolsActivePort"

### 启动 Chrome

"C:\Program Files\Google\Chrome Dev\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=\*
--user-data-dir="C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data"

## glm-4.7

<!-- "ANTHROPIC_AUTH_TOKEN": "29fd5a8c43464df988783965b93f93f0.gDbffKeFBrDLV7CJ",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_MODEL": "glm-4.7" -->

## 讯飞

<!-- "env": {
    "ANTHROPIC_AUTH_TOKEN": "1b0c92eca4cceb6d0acc9240d5dd83e7:ZTFlYzRlNWE3NDNlZTUyMjNhZWJhYzRj",
    "ANTHROPIC_BASE_URL": "https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "astron-code-latest",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "astron-code-latest",
    "ANTHROPIC_MODEL": "astron-code-latest",
    "DISABLE_AUTOUPDATER": "1",
    "ENABLE_TOOL_SEARCH": "true"
  }, -->

使用方式：

- npm run dev - 启动开发模式（热重载 + Vite watch）
- npm run format - 格式化代码
- npm run lint - ESLint检查
- npm run typecheck - TypeScript类型检查
- git commit - 自动执行格式化 + 检查
