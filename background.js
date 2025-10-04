chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wardbot-analogy-tutor",
    title: "Ward Bot: Explain with Analogy Tutor",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wardbot-analogy-tutor") {
    chrome.tabs.sendMessage(tab.id, {
      action: "runAnalogyTutor",
      selectedText: info.selectionText
    });
  }
});