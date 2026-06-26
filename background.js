chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
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

function showUnsupportedPageBadge(tabId) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#ff6b4a" });
  chrome.action.setBadgeText({ tabId, text: "!" });
  chrome.action.setTitle({
    tabId,
    title: "ScubaScubaa works on normal webpages, not Chrome internal pages."
  });

  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: "" });
    chrome.action.setTitle({
      tabId,
      title: "Toggle ScubaScubaa overlay"
    });
  }, 2600);
}
