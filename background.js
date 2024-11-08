// Set up the side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

// Function to inject content script if needed
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content-script.js']
    });
  } catch (error) {
    console.log('Content script already exists or injection failed:', error);
  }
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "findHistoryTab") {
    chrome.tabs.query({url: "*://www.crunchyroll.com/history*"}, async (tabs) => {
      if (tabs.length > 0) {
        // Found history tab
        const tab = tabs[0];
        await ensureContentScript(tab.id);
        sendResponse({ found: true, tabId: tab.id });
      } else {
        // No history tab found
        sendResponse({ found: false });
      }
    });
    return true; // Keep message channel open for async response
  }
});