// DevTools panels registration
'use strict';

// Create EventBus Monitor panel
chrome.devtools.panels.create(
  'EventBus Monitor',
  null, // Use default icon
  'eventbus-devtools.html',
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


// Create Elements sidebar pane (sibling to Styles, Computed, etc.)
chrome.devtools.panels.elements.createSidebarPane(
  'Element Path',
  function (sidebar) {
    console.log('Elements sidebar pane created');

    // Set the sidebar content
    sidebar.setPage('devtools/sidebar-styles.html');

    // Update when element selection changes
    chrome.devtools.panels.elements.onSelectionChanged.addListener(() => {
      // The sidebar page will handle the update via its own logic
    });
  }
);
