# Chrome Extension Template

A modern Chrome extension template built with Manifest V3, featuring best practices and a clean structure.

## Features

- 📦 Manifest V3 compliance
- 🎯 Clean and modular code structure
- 💾 Chrome Storage API integration
- 🔄 Message passing between components
- 🎨 Responsive popup UI
- 🌐 Content script injection
- 🔧 Service worker for background tasks
- 🎨 Custom CSS styles
- 📱 Mobile-friendly design

## File Structure

```
chrome-extension-template/
├── manifest.json          # Extension manifest file (V3)
├── popup.html             # Extension popup window
├── popup.js               # Popup script
├── content.js             # Content script
├── background.js          # Service worker
├── inject.js              # Script injected into page context
├── styles.css             # Content styles
├── welcome.html           # Welcome page on first install
└── icons/                 # Extension icons (not included)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Installation

1. Clone or download this template
2. Update `manifest.json` with your extension details
3. Add your icons to the `icons/` folder
4. Load the extension in Chrome:
   - Open Chrome Extensions page (`chrome://extensions/`)
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

## Usage

### Popup Window
The popup provides a user interface for:
- Toggling the extension on/off
- Managing extension settings
- Viewing extension status

### Content Script
- Runs in the context of web pages
- Can modify page content
- Communicates with other extension components
- Provides an API for page interaction

### Service Worker
- Runs in the background
- Handles periodic tasks
- Manages extension lifecycle
- Listens for browser events

### Storage
- Uses `chrome.storage.sync` for user preferences
- Persists across browser sessions
- Syncs across devices when signed in to Chrome

## API Reference

### Manifest V3 Permissions

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.example.com/*"
  ]
}
```

### Chrome Storage API

```javascript
// Save settings
chrome.storage.sync.set({ key: value });

// Load settings
chrome.storage.sync.get(['key']).then(result => {
  console.log(result.key);
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  console.log('Storage changed:', changes);
});
```

### Message Passing

```javascript
// Send message from popup/content to service worker
chrome.runtime.sendMessage({ type: 'GET_DATA' });

// Send message from service worker to popup/content
chrome.tabs.sendMessage(tabId, { type: 'UPDATE_DATA' });

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message);
  return true; // Keep message channel open
});
```

## Customization

### Manifest Configuration

Update `manifest.json` with:
- Extension name, version, and description
- Permissions and host permissions
- Icons and action configuration
- Content script matches

### Feature Implementation

1. **Content Script**: Add your page modification logic in `content.js`
2. **Background Tasks**: Implement background tasks in `background.js`
3. **UI**: Customize popup UI in `popup.html` and `popup.js`
4. **Styles**: Add custom styles in `styles.css`

### Page Compatibility

Update content script matches in `manifest.json`:
```json
"content_scripts": [
  {
    "matches": ["*://*.yourdomain.com/*"],
    "js": ["content.js"],
    "css": ["styles.css"]
  }
]
```

## Development Tips

1. **Debugging**:
   - Open DevTools for popup: Right-click extension icon → Inspect popup
   - Debug content script: Use DevTools on target web page
   - Debug service worker: Navigate to `chrome://extensions/` and inspect

2. **Testing**:
   - Use `chrome.runtime.getManifest()` to verify manifest
   - Test with different page URLs
   - Check browser console for errors

3. **Deployment**:
   - Package extension for Chrome Web Store
   - Update version number with each release
   - Provide clear documentation and privacy policy

## Troubleshooting

### Common Issues

1. **Service Worker not running**: Check manifest version is 3
2. **Content script not loading**: Verify matches pattern is correct
3. **Storage not working**: Ensure proper permissions in manifest
4. **Message passing failed**: Check if receiver is listening

### Console Commands

```javascript
// Check extension state
chrome.runtime.getManifest()

// Check storage
chrome.storage.local.get(null)

// Check extension errors
chrome.runtime.lastError
```

## License

MIT License - feel free to use this template for your own extensions.

## Contributing

1. Fork this repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For support and questions:
- Create an issue in the repository
- Check Chrome Extension documentation
- Review Chrome Developer resources

---

Happy coding! 🚀