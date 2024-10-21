// ToDo: This list needs to come from the password database
const urlList = [
  "https://blog.abluestar.com/",
  "https://www.example.com"
];


// Function to check if the current tab's URL is in the list
function checkUrl(tab) {
  if (tab && tab.url) {
    const isUrlInList = urlList.some((url) => tab.url.includes(url));

    if (isUrlInList) {
      chrome.action.setIcon({ path: "../icon_changed.png", tabId: tab.id });
      chrome.action.setPopup({ tabId: tab.id, popup: "popup.html" });
    } else {
      chrome.action.setIcon({ path: "../icon_default.png", tabId: tab.id });
      chrome.action.setPopup({ tabId: tab.id, popup: "" }); // No popup
    }
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    checkUrl(tab);
  }
});

// Listen for tab switches (when user switches tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    checkUrl(tab);
  });
});

// Listen for icon click
chrome.action.onClicked.addListener((tab) => {
  checkUrl(tab);
});