chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !canInjectInto(tab.url)) {
    showUnsupportedPageBadge(tab.id);
    return;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  } catch (error) {
    console.warn("Could not open ScubaScubaa on this tab.", error);
    showUnsupportedPageBadge(tab.id);
  }
});

function canInjectInto(url = "") {
  return /^(https?|file):/.test(url);
}

function showUnsupportedPageBadge(tabId) {
  if (!tabId) {
    return;
  }

  chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff6b4a" });
  chrome.action.setBadgeText({ tabId, text: "!" });
  chrome.action.setTitle({
    tabId,
    title: "Open a regular website tab, then click ScubaScubaa."
  });

  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({
      tabId,
      title: "Toggle ScubaScubaa camera"
    });
  }, 2500);
}
