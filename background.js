async function ensureContentScript(tabId) {
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_script.js']
    });
  } catch (error) {
    console.error('Ward Bot content script injection failed', error);
    throw error;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wardbot-analogy-tutor",
    title: "Ward Bot: Explain with Analogy Tutor",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "wardbot-analogy-tutor") {
    await ensureContentScript(tab.id);
    chrome.tabs.sendMessage(tab.id, {
      action: "runAnalogyTutor",
      selectedText: info.selectionText
    });
  }
});
