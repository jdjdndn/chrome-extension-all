// Script injected directly into the page context
// This script runs in the same context as the web page

// ========== 彩色日志工具 ==========
// 生成随机颜色（避开白色/浅色）
function getRandomColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 40);
  const lightness = 30 + Math.floor(Math.random() * 30);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
function coloredLog(tag, message, ...args) {
  const tagStyle = `color: ${getRandomColor()}; font-weight: bold;`;
  const styledArgs = args.map((arg) => {
    return [`%c${String(arg)}`, `color: ${getRandomColor()}`];
  }).flat();
  if (styledArgs.length > 0) console.log(`%c${tag} ${message}`, tagStyle, ...styledArgs);
  else console.log(`%c${tag} ${message}`, tagStyle);
}
const originalConsole = { log: console.log.bind(console) };
console.log = function(...args) {
  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    const tagMatch = firstArg.match(/^\[([^\]]+)\]/);
    if (tagMatch) {
      const tag = `[${tagMatch[1]}]`;
      const message = firstArg.slice(tag.length).trim() || '';
      coloredLog(tag, message, ...args.slice(1));
      return;
    }
  }
  originalConsole.log(...args);
};

console.log('[Extension] Extension injected script loaded');

// Page-specific functionality can be added here
// This script can access page variables and functions that are not available in content scripts

// Helper function to safely access page variables
function getGlobalVar(name) {
  try {
    return window[name];
  } catch (e) {
    console.error(`Error accessing global variable ${name}:`, e);
    return null;
  }
}

// Create a bridge between the extension and page context
window.ExtensionBridge = {
  // Send message to content script
  sendToContent: function(message) {
    window.postMessage({
      source: 'extension-inject',
      type: message.type,
      data: message.data
    }, '*');
  },

  // Listen for messages from content script
  receiveFromContent: function(callback) {
    window.addEventListener('message', function(event) {
      if (event.source === window && event.data.source === 'extension-content') {
        callback(event.data);
      }
    });
  }
};

// Example: Wait for page to be fully loaded
function waitForPageLoad(callback) {
  if (document.readyState === 'complete') {
    callback();
  } else {
    window.addEventListener('load', callback);
  }
}

// Example: Create a custom element
class ExtensionCustomElement extends HTMLElement {
  constructor() {
    super();
    // Your custom element code here
  }

  connectedCallback() {
    console.log('Custom element connected');
    // Element has been added to the DOM
  }

  disconnectedCallback() {
    console.log('Custom element disconnected');
    // Element has been removed from the DOM
  }
}

// Define the custom element (if not already defined)
if (!customElements.get('extension-custom-element')) {
  customElements.define('extension-custom-element', ExtensionCustomElement);
}

// Example: Inject custom UI into the page
function injectCustomUI() {
  // Check if we should inject
  if (!document.body.classList.contains('extension-active')) {
    return;
  }

  // Create floating action button
  const fab = document.createElement('button');
  fab.className = 'extension-button extension-fab';
  fab.innerHTML = 'EXT';
  fab.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 2147483646;
  `;

  fab.addEventListener('click', function() {
    window.ExtensionBridge.sendToContent({
      type: 'FAB_CLICKED'
    });
  });

  document.body.appendChild(fab);

  // Add CSS for the floating button
  const style = document.createElement('style');
  style.textContent = `
    .extension-fab {
      border-radius: 50%;
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

// Initialize when page loads
waitForPageLoad(() => {
  console.log('Page fully loaded, initializing extension UI');

  // Inject custom UI
  injectCustomUI();

  // Listen for messages from content script
  ExtensionBridge.receiveFromContent((message) => {
    console.log('Received message from content:', message);
    // Handle messages from content script
  });

  // Notify content script that we're ready
  ExtensionBridge.sendToContent({
    type: 'INJECT_SCRIPT_LOADED'
  });
});

// Clean up when page is unloaded
window.addEventListener('beforeunload', () => {
  // Remove injected elements
  document.querySelectorAll('.extension-fab').forEach(el => el.remove());
});