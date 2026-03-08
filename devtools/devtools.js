// DevTools panels registration
'use strict';

// Create EventBus Monitor panel
chrome.devtools.panels.create(
  'EventBus Monitor',
  null, // Use default icon
  'devtools/eventbus-devtools.html',
  function (panel) {
    console.log('EventBus Monitor panel created');
  }
);

// Create Console panel
chrome.devtools.panels.create(
  'Tool-info',
  null, // Use default icon
  'devtools/console.html',
  function (panel) {
    console.log('Console panel created');
  }
);
