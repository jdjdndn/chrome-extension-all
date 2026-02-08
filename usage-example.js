// 使用示例：如何使用新增的阻止接口返回功能

// 1. 添加阻止接口返回的域名
chrome.runtime.sendMessage({
  type: 'ADD_BLOCKED_RESPONSE_DOMAIN',
  domain: 'analytics.google.com'
});

// 2. 检查当前页面是否在阻止列表中
async function checkCurrentDomain() {
  const result = await chrome.runtime.sendMessage({
    type: 'CHECK_DOMAIN_BLOCKED',
    domain: window.location.hostname
  });

  if (result.blocked) {
    console.log(`当前域名 ${result.currentDomain} 被阻止`);
    console.log(`阻止原因: ${result.blockedReason}`);
  }
}

// 3. 尝试发起API请求（会被阻止）
async function makeAPIRequest() {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    console.log('API响应:', data);
  } catch (error) {
    console.log('API请求被阻止:', error.message);
  }
}

// 4. 在页面加载时检查
window.addEventListener('load', checkCurrentDomain);
