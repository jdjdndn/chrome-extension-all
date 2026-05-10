// 等待 StorageBridge module 加载完成后再加载 console.js
(function waitStorageBridge() {
  if (window.StorageBridge) {
    var s = document.createElement('script')
    s.src = 'console.js'
    document.body.appendChild(s)
  } else {
    setTimeout(waitStorageBridge, 50)
  }
})()
