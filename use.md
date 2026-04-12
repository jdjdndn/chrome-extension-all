# USE

## chrome devtools mcp

启动命令（以后使用）：

### 先清理锁文件

  rm -rf "C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data\SingletonLock"
  rm -rf "C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data\DevToolsActivePort"

### 启动 Chrome

  "C:\Program Files\Google\Chrome Dev\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=*
  --user-data-dir="C:\Users\26673\AppData\Local\Google\Chrome Dev\User Data"
