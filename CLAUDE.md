# Chrome Extension - 减少资源使用

## 项目概述

Chrome 扩展，用于减少接口信息使用。包含 DevTools 面板，支持 Mock 功能。

## 前置条件

1. **中文优先**：能用中文的地方用中文（注释、日志、变量名酌情）
2. **深度思考重复执行**：多次思考确保问题全部解决
3. **不确定就问**：不确定的问题通过选择方式询问用户
4. **提取/使用公共能力**：避免多次出现问题

## 注意事项

1. 时刻注意检查语法错误
2. 本插件下所有脚本添加的自定义属性全部用统一前缀，方便统一处理

## 技术栈

- Manifest V3
- Chrome DevTools API
- Content Script + Inject Script 分离架构

## 3. DevTools 通信模式

### Port 持久连接

```javascript
// DevTools 面板中
let port;

function connect() {
  if (port) return port;

  port = chrome.runtime.connect({ name: "devtools" });

  port.onMessage.addListener((message) => {
    if (message.type.endsWith(".respond")) {
      handleMessage(message);
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(() => connect(), 100); // 自动重连
  });

  return port;
}

function send(type, payload) {
  if (port) {
    port.postMessage({ type, ...payload });
  }
}
```
