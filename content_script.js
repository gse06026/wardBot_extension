let aiModel = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getText") {
    try {
      const pageText = document.body.innerText;
      sendResponse({ pageText: pageText });
    } catch (error) {
      console.error("Error getting page text:", error);
      sendResponse({ pageText: "", error: error.message });
    }
  }

  if (request.action === "highlightText") {
    console.log("Received highlightText request with paragraphs:", request.paragraphs);
    try {
      highlightParagraphs(request.paragraphs);
      console.log("Highlight completed successfully");
      sendResponse({ success: true, message: "Text highlighted successfully" });
    } catch (error) {
      console.error("Error highlighting text:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  if (request.action === "clearHighlights") {
    try {
      removeHighlights();
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error clearing highlights:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  if (request.action === "runAnalogyTutor") {
    chrome.storage.sync.get('userInterest', async (data) => {
      const interest = data.userInterest || 'a simple everyday object';
      const selectedText = request.selectedText;

      try {
        const analogy = await getAnalogyFromNano(selectedText, interest);
        showAnalogyResult(analogy);
        sendResponse({ success: true });
      } catch (error) {
        console.error("Analogy Tutor Error:", error);
        alert("An error occurred while running the Analogy Tutor: " + error.message);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true;
  }

  return true;
});

function highlightParagraphs(paragraphs) {
  if (!paragraphs || !Array.isArray(paragraphs)) {
    throw new Error("Invalid paragraphs array provided");
  }

  console.log("Starting highlight for", paragraphs.length, "paragraphs");
  removeHighlights();

  paragraphs.forEach((paragraph, index) => {
    if (typeof paragraph !== 'string' || paragraph.trim() === '') {
      console.warn("Skipping empty or invalid paragraph:", paragraph);
      return;
    }

    console.log(`Processing paragraph ${index + 1}:`, paragraph.substring(0, 50) + "...");
    const textNodes = getTextNodes(document.body, paragraph);
    console.log(`Found ${textNodes.length} matching text nodes`);

    textNodes.forEach(node => {
      const nodeText = node.textContent;
      const parent = node.parentNode;

      if (!parent || parent.classList?.contains('wardbot-highlight')) {
        return;
      }

      const span = document.createElement('mark');
      span.className = 'wardbot-highlight';
      span.style.cssText = 'background-color: yellow; border: 2px solid orange; border-radius: 4px; padding: 2px 4px;';
      span.textContent = nodeText;

      parent.replaceChild(span, node);
      console.log("Highlighted text node successfully");
    });
  });

  const firstHighlight = document.querySelector('.wardbot-highlight');
  if (firstHighlight) {
    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function getTextNodes(parent, searchText) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    parent,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const cleanSearchText = searchText.replace(/…/g, '').replace(/\.{3}/g, '').trim();
  const searchWords = cleanSearchText.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  let node;
  while (node = walker.nextNode()) {
    const nodeText = node.textContent.toLowerCase();

    if (nodeText.includes(cleanSearchText.toLowerCase())) {
      textNodes.push(node);
    } else if (searchWords.length >= 3) {
      const matchCount = searchWords.filter(word => nodeText.includes(word)).length;
      if (matchCount >= Math.max(3, Math.ceil(searchWords.length * 0.7))) {
        textNodes.push(node);
      }
    }
  }

  return textNodes;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeHighlights() {
  const highlightedElements = document.querySelectorAll('.wardbot-highlight');
  highlightedElements.forEach(highlighted => {
    const textNode = document.createTextNode(highlighted.textContent);
    highlighted.parentNode.replaceChild(textNode, highlighted);
  });
}

async function getAnalogyFromNano(concept, interest) {
  if (typeof LanguageModel === 'undefined') {
    throw new Error("Chrome AI is not available.");
  }

  if (!aiModel) {
    aiModel = await LanguageModel.create();
  }

  const prompt = `You are a creative and friendly tutor.
Your student's favorite hobby is "${interest}".
Explain the following difficult concept to them using a simple and accurate analogy from their hobby. Make it easy and fun to understand.

**Concept to explain:**
"""
${concept}
"""

**Analogy-based explanation:**`;

  const response = await aiModel.prompt(prompt);
  return response;
}

function showAnalogyResult(analogy) {
  const existingModal = document.getElementById('wardbot-analogy-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'wardbot-analogy-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: sans-serif;
  `;

  const title = document.createElement('h3');
  title.style.marginTop = '0';
  title.textContent = '🤖 Ward Bot Analogy Tutor';

  const content = document.createElement('p');
  content.innerHTML = analogy.replace(/\n/g, '<br>');

  const closeBtn = document.createElement('button');
  closeBtn.id = 'wardbot-close-modal';
  closeBtn.style.cssText = 'margin-top: 10px; padding: 5px 10px;';
  closeBtn.textContent = 'Close';

  modal.appendChild(title);
  modal.appendChild(content);
  modal.appendChild(closeBtn);

  document.body.appendChild(modal);

  document.getElementById('wardbot-close-modal').addEventListener('click', () => {
    modal.remove();
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && aiModel) {
    aiModel.destroy();
    aiModel = null;
  }
});

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('wardbot-highlight')) {
    const clickedText = event.target.textContent;
    if (confirm('Add this highlighted text to your AI Study Note?')) {
      chrome.storage.local.set({ textToAdd: clickedText });
      alert('Text saved! Open the Ward Bot popup to see it in your notepad.');
    }
  }
}, true);