// 页面上下文注入脚本 - 拦截 fetch/XHR 并实现 mock

// ========== Mock 数据存储 ==========
window.__mockData = {};

// Mock 总开关（默认关闭）
window.__mockEnabled = false;

// 获取 mock 数据
window.getMockData = function (method, url) {
  // 检查总开关
  if (window.__mockEnabled !== true) return null;
  if (!window.__mockData) return null;

  // 精确匹配
  const key = `${method}:${url}`;
  if (window.__mockData[key]) {
    const rule = window.__mockData[key];
    if (rule.enabled !== false) {
      return rule.data;
    }
  }

  // 尝试不带 query params
  try {
    const urlObj = new URL(url, window.location.href);
    const urlWithoutQuery = urlObj.origin + urlObj.pathname;
    const keyWithoutQuery = `${method}:${urlWithoutQuery}`;
    if (window.__mockData[keyWithoutQuery]) {
      const rule = window.__mockData[keyWithoutQuery];
      if (rule.enabled !== false) {
        return rule.data;
      }
    }
  } catch (e) {}

  return null;
};

// 设置 mock 数据
window.setMockData = function (method, url, data) {
  if (!window.__mockData) window.__mockData = {};
  const key = `${method}:${url}`;
  window.__mockData[key] = { data, enabled: true };
  console.log('[Inject] Mock 规则已设置:', key);
};

// 切换 mock 总开关
window.toggleMockGlobal = function (enabled) {
  window.__mockEnabled = enabled;
  console.log('[Inject] Mock 总开关:', enabled ? '已启用' : '已禁用');
};

// 获取 mock 总开关状态
window.getMockGlobalEnabled = function () {
  return window.__mockEnabled === true;
};

// 切换单个 mock 开关
window.toggleMockRule = function (method, url, enabled) {
  if (!window.__mockData) return;
  const key = `${method}:${url}`;
  if (window.__mockData[key]) {
    window.__mockData[key].enabled = enabled;
    console.log('[Inject] Mock 开关已切换:', key, 'enabled:', enabled);
  }
};

// 获取所有 mock 规则
window.getAllMockRules = function () {
  if (!window.__mockData) return [];
  return Object.keys(window.__mockData).map(key => {
    const parts = key.split(':');
    const method = parts[0];
    const url = parts.slice(1).join(':');
    const rule = window.__mockData[key];
    return {
      key,
      method,
      url,
      enabled: rule.enabled !== false,
      data: rule.data
    };
  });
};

// ========== Fetch 拦截 ==========
if (!window._injectOriginalFetch) {
  window._injectOriginalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    // 获取 URL 和 method
    let urlString, method;

    if (typeof url === 'string') {
      urlString = url;
      method = (options && options.method) ? options.method.toUpperCase() : 'GET';
    } else if (url instanceof Request) {
      // url 是 Request 对象
      urlString = url.url;
      method = url.method ? url.method.toUpperCase() : 'GET';
    } else {
      urlString = window.location.href;
      method = (options && options.method) ? options.method.toUpperCase() : 'GET';
    }

    const mockData = window.getMockData(method, urlString);
    if (mockData) {
      console.log('[Inject Fetch] Mock 拦截:', method, urlString);
      const mockBody = typeof mockData === 'string' ? mockData : JSON.stringify(mockData);

      // 直接返回 mock 响应
      return new Response(mockBody, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'x-mock-intercepted': 'true'
        }
      });
    }

    return await window._injectOriginalFetch(url, options);
  };
  console.log('[Inject] Fetch 拦截已安装');
}

// ========== XHR 拦截 ==========
if (!window._injectOriginalXHR) {
  window._injectOriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function () {
    const xhr = new window._injectOriginalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let _url = '';
    let _method = 'GET';

    xhr.open = function (method, url, ...args) {
      _url = url;
      _method = method.toUpperCase();
      return originalOpen.call(this, method, url, ...args);
    };

    xhr.send = function (body) {
      const mockData = window.getMockData(_method, _url);
      if (mockData) {
        console.log('[Inject XHR] Mock 拦截:', _method, _url);
        const responseBody = typeof mockData === 'string' ? mockData : JSON.stringify(mockData);

        setTimeout(() => {
          Object.defineProperty(xhr, 'status', { value: 200, writable: false });
          Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
          Object.defineProperty(xhr, 'responseText', { value: responseBody, writable: false });
          Object.defineProperty(xhr, 'response', { value: responseBody, writable: false });

          xhr.getResponseHeader = function (header) {
            if (header.toLowerCase() === 'content-type') return 'application/json';
            if (header.toLowerCase() === 'x-mock-intercepted') return 'true';
            return null;
          };

          if (xhr.onreadystatechange) xhr.onreadystatechange();
          if (xhr.onload) xhr.onload();
          xhr.dispatchEvent(new Event('load'));
        }, 10);

        return;
      }

      return originalSend.call(this, body);
    };

    return xhr;
  };

  window.XMLHttpRequest.UNSENT = 0;
  window.XMLHttpRequest.OPENED = 1;
  window.XMLHttpRequest.HEADERS_RECEIVED = 2;
  window.XMLHttpRequest.LOADING = 3;
  window.XMLHttpRequest.DONE = 4;
  console.log('[Inject] XHR 拦截已安装');
}

// 监听 DevTools 发送的消息
window.addEventListener('message', (event) => {
  if (event.data.source === 'devtools-mock') {
    const { type, method, url, data } = event.data;
    if (type === 'setMock') {
      window.setMockData(method, url, data);
    } else if (type === 'toggleGlobal') {
      window.toggleMockGlobal(data);
    } else if (type === 'toggleRule') {
      window.toggleMockRule(method, url, data);
    }
  }
});

console.log('[Inject] 注入脚本已加载');
