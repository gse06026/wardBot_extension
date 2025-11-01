if (!window.wardBotInitialized) {
  window.wardBotInitialized = true;

  let aiModel = null;
  let activeAnalogyOverlayCleanup = null;

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
          launchAnalogyTutor(selectedText, interest);
          sendResponse({ success: true, message: 'Analogy Tutor initiated. Click Generate in the modal to continue.' });
        } catch (error) {
          const message = formatAIError(error);
          console.error("Analogy Tutor Error:", error);
          alert("An error occurred while running the Analogy Tutor: " + message);
          sendResponse({ success: false, error: message });
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

  function removeAnalogyOverlay() {
    if (typeof activeAnalogyOverlayCleanup === 'function') {
      const cleanup = activeAnalogyOverlayCleanup;
      activeAnalogyOverlayCleanup = null;
      cleanup();
      return;
    }

    const overlay = document.getElementById('wardbot-analogy-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  function createAnalogyOverlay({ modalStyles = '', onClose } = {}) {
    removeAnalogyOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'wardbot-analogy-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(47, 39, 36, 0.42);
      backdrop-filter: blur(4px);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    `;
    overlay.setAttribute('role', 'presentation');

    const modal = document.createElement('div');
    modal.id = 'wardbot-analogy-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = `
      position: relative;
      width: min(480px, 92vw);
      background: linear-gradient(160deg, #fffaf6 0%, #f4f0eb 45%, #efe7e0 100%);
      border-radius: 20px;
      padding: 28px 30px;
      color: #2f2724;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      border: 1px solid rgba(193, 95, 60, 0.16);
      box-shadow: 0 34px 68px -34px rgba(47, 35, 29, 0.48);
      overflow: hidden;
      box-sizing: border-box;
    ` + modalStyles;

    const backgroundAccent = document.createElement('div');
    backgroundAccent.style.cssText = `
      position: absolute;
      inset: -35% -20% auto -10%;
      height: 220px;
      background: radial-gradient(circle at 20% 20%, rgba(193, 95, 60, 0.28), transparent 62%);
      pointer-events: none;
      opacity: 0.8;
    `;

    const backgroundAccentSecondary = document.createElement('div');
    backgroundAccentSecondary.style.cssText = `
      position: absolute;
      inset: auto -35% -45% auto;
      width: 220px;
      height: 220px;
      background: radial-gradient(circle at 70% 70%, rgba(216, 114, 75, 0.22), transparent 70%);
      pointer-events: none;
      opacity: 0.7;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 18px;
    `;

    modal.appendChild(backgroundAccent);
    modal.appendChild(backgroundAccentSecondary);
    modal.appendChild(modalContent);

    let closed = false;

    function closeOverlay() {
      if (closed) {
        return;
      }
      closed = true;
      overlay.removeEventListener('click', handleOverlayClick);
      document.removeEventListener('keydown', handleKeydown);
      if (overlay.parentNode) {
        overlay.remove();
      }
      if (typeof onClose === 'function') {
        try {
          onClose();
        } catch (_error) {
          // no-op
        }
      }
      if (activeAnalogyOverlayCleanup === closeOverlay) {
        activeAnalogyOverlayCleanup = null;
      }
    }

    function handleKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeOverlay();
      }
    }

    function handleOverlayClick(event) {
      if (event.target === overlay) {
        closeOverlay();
      }
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close Ward Bot Analogy Tutor');
    closeButton.style.cssText = `
      position: absolute;
      top: 14px;
      right: 14px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(193, 95, 60, 0.28);
      background: rgba(255, 255, 255, 0.88);
      color: #c15f3c;
      font-size: 20px;
      font-weight: 600;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 14px 28px -22px rgba(47, 35, 29, 0.45);
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
      z-index: 2;
    `;
    closeButton.textContent = '\u00d7';
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.transform = 'translateY(-1px)';
      closeButton.style.boxShadow = '0 16px 32px -20px rgba(193, 95, 60, 0.48)';
      closeButton.style.borderColor = 'rgba(193, 95, 60, 0.38)';
      closeButton.style.background = 'rgba(255, 255, 255, 0.94)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.transform = 'translateY(0)';
      closeButton.style.boxShadow = '0 14px 28px -22px rgba(47, 35, 29, 0.45)';
      closeButton.style.borderColor = 'rgba(193, 95, 60, 0.28)';
      closeButton.style.background = 'rgba(255, 255, 255, 0.88)';
    });
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeOverlay();
    });

    modal.appendChild(closeButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleKeydown);

    modal.setAttribute('tabindex', '-1');
    requestAnimationFrame(() => {
      if (typeof modal.focus === 'function') {
        modal.focus();
      }
    });

    activeAnalogyOverlayCleanup = closeOverlay;

    const isOverlayClosed = () => closed;

    return { overlay, modal, modalContent, closeOverlay, isOverlayClosed };
  }

  function formatAIError(error) {
    if (!error) {
      return 'Unknown error';
    }

    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          return 'Chrome blocked the built-in AI because it needs a recent click on the page. Please click somewhere on the page and press "Generate Analogy" again.';
        case 'InvalidStateError':
          return 'Chrome AI is still getting ready. Keep this tab focused for a moment so it can finish setting up, then try again.';
        case 'NotSupportedError':
          return 'Chrome AI is not supported in this context. Make sure you are on Chrome 138+ with on-device AI enabled in chrome://flags.';
        default:
          return error.message || `Chrome AI returned a ${error.name} DOMException.`;
      }
    }

    return error.message || error.name || String(error);
  }

  async function createOrCheckAIModel(options = {}) {
    if (typeof LanguageModel === 'undefined') {
      throw new Error("Chrome's built-in AI is not available. Please ensure you're using Chrome 138+ with AI features enabled.");
    }

    let availability;
    try {
      availability = await LanguageModel.availability();
    } catch (error) {
      throw new Error(`Could not verify Chrome AI availability: ${error?.message || error}`);
    }

    if (availability === 'unavailable') {
      throw new Error("Chrome's built-in AI is not available. Please check that you have the required hardware and Chrome settings enabled.");
    }

    if (availability === 'downloadable') {
      const proceed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm("Chrome AI model needs to be downloaded for the first time. This may take a few minutes. Continue?")
        : true;

      if (!proceed) {
        throw new Error("User canceled AI download.");
      }
    }

    const {
      expectedOutputs = [{
        type: 'text',
        languages: ['en']
      }],
      ...rest
    } = options;

    try {
      return await LanguageModel.create({
        expectedOutputs,
        ...rest
      });
    } catch (error) {
      throw new Error(error?.message || error?.name || String(error));
    }
  }

  function launchAnalogyTutor(concept, interest) {
    if (!concept || typeof concept !== 'string' || !concept.trim()) {
      throw new Error("Please select some text to explain before running the Analogy Tutor.");
    }

    const trimmedConcept = concept.trim();
    const { closeOverlay, modalContent, isOverlayClosed } = createAnalogyOverlay();

    const badge = document.createElement('div');
    badge.style.cssText = `
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 14px;
      border-radius: 999px;
      background: rgba(193, 95, 60, 0.14);
      border: 1px solid rgba(193, 95, 60, 0.32);
      color: #d8724b;
      font-weight: 600;
      letter-spacing: 0.6px;
      font-size: 12px;
      text-transform: uppercase;
      box-shadow: 0 10px 22px -18px rgba(193, 95, 60, 0.32);
    `;
    badge.textContent = 'Analogy Tutor';

    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.style.fontSize = '22px';
    title.style.fontWeight = '700';
    title.style.color = '#d8724b';
    title.style.textShadow = '0 6px 20px rgba(193, 95, 60, 0.22)';
    title.textContent = 'Craft a personalized analogy';

    const promptText = document.createElement('p');
    promptText.style.marginBottom = '4px';
    promptText.style.fontSize = '14px';
    promptText.style.lineHeight = '1.5';
    promptText.style.color = '#6f645f';
    promptText.textContent = 'We\'ll translate the selected concept into an everyday story that matches your saved interests.';

    const excerpt = document.createElement('blockquote');
    excerpt.style.cssText = `
      margin: 0;
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.78);
      border-radius: 14px;
      border: 1px solid rgba(193, 95, 60, 0.16);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
      color: #2f2724;
      font-size: 14px;
      line-height: 1.55;
    `;
    excerpt.textContent = trimmedConcept.substring(0, 300) + (trimmedConcept.length > 300 ? '…' : '');

    const status = document.createElement('div');
    status.style.cssText = `
      min-height: 20px;
      font-size: 13px;
      color: #6f645f;
      line-height: 1.45;
    `;
    status.textContent = '';

    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 6px;
    `;

    const generateBtn = document.createElement('button');
    generateBtn.textContent = 'Generate Analogy';
    generateBtn.style.cssText = `
      padding: 10px 20px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #d8724b 0%, #c15f3c 100%);
      color: #fff;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 16px 30px -18px rgba(193, 95, 60, 0.58);
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
    `;
    generateBtn.onmouseenter = () => {
      generateBtn.style.transform = 'translateY(-1px)';
      generateBtn.style.boxShadow = '0 18px 32px -16px rgba(193, 95, 60, 0.62)';
    };
    generateBtn.onmouseleave = () => {
      generateBtn.style.transform = 'translateY(0)';
      generateBtn.style.boxShadow = '0 16px 30px -18px rgba(193, 95, 60, 0.58)';
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      padding: 10px 18px;
      border-radius: 999px;
      border: 1px solid rgba(111, 100, 95, 0.2);
      background: rgba(244, 243, 238, 0.9);
      color: #6f645f;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    `;
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.transform = 'translateY(-1px)';
      cancelBtn.style.boxShadow = '0 12px 24px -20px rgba(47, 35, 29, 0.5)';
      cancelBtn.style.borderColor = 'rgba(193, 95, 60, 0.32)';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.transform = 'translateY(0)';
      cancelBtn.style.boxShadow = 'none';
      cancelBtn.style.borderColor = 'rgba(111, 100, 95, 0.2)';
    };

    buttonsWrapper.appendChild(cancelBtn);
    buttonsWrapper.appendChild(generateBtn);

    modalContent.appendChild(badge);
    modalContent.appendChild(title);
    modalContent.appendChild(promptText);
    modalContent.appendChild(excerpt);
    modalContent.appendChild(status);
    modalContent.appendChild(buttonsWrapper);

    cancelBtn.addEventListener('click', () => {
      closeOverlay();
    });

    generateBtn.addEventListener('click', async () => {
      status.style.color = '#6f645f';
      status.textContent = 'Preparing Chrome AI…';

      if (!navigator.userActivation?.isActive) {
        status.style.color = '#d9534f';
        status.textContent = 'Please click the button again after interacting with the page.';
        return;
      }

      generateBtn.disabled = true;
      cancelBtn.disabled = true;
      generateBtn.textContent = 'Generating…';

      try {
        const analogy = await getAnalogyFromNano(trimmedConcept, interest);
        if (isOverlayClosed()) {
          return;
        }
        closeOverlay();
        showAnalogyResult(analogy);
      } catch (error) {
        if (error?.name === 'InvalidStateError' || error?.name === 'NotAllowedError') {
          aiModel = null; // reset so we try to re-create next time
        }

        const message = formatAIError(error);
        console.error('Analogy Tutor Error:', error);
        status.style.color = '#d9534f';
        status.textContent = message;
        generateBtn.disabled = false;
        cancelBtn.disabled = false;
        generateBtn.textContent = 'Generate Analogy';
      }
    });
  }

  async function getAnalogyFromNano(concept, interest) {
    if (!concept || typeof concept !== 'string' || !concept.trim()) {
      throw new Error("Please select some text to explain before running the Analogy Tutor.");
    }

    if (!aiModel) {
      aiModel = await createOrCheckAIModel();
    }

    const prompt = `You are a creative and friendly tutor.
Your student's favorite hobby is "${interest}".
Explain the following difficult concept to them using a simple and accurate analogy from their hobby. Make it easy and fun to understand.
Keep the explanation to a single short paragraph of no more than 3 sentences and 85 words.
Highlight the connection to the hobby explicitly so it feels personal.

**Concept to explain:**
"""
${concept}
"""

**Analogy-based explanation:**`;

    const response = await aiModel.prompt(prompt, { outputLanguage: 'en' });
    return response;
  }

  function showAnalogyResult(analogy) {
    const { closeOverlay, modalContent } = createAnalogyOverlay({
      modalStyles: `
        padding: 30px 32px 26px;
      `
    });

    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.style.fontSize = '22px';
    title.style.fontWeight = '700';
    title.style.color = '#d8724b';
    title.style.textShadow = '0 6px 20px rgba(193, 95, 60, 0.22)';
    title.textContent = 'Here’s your tailored analogy';

    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      font-size: 14px;
      color: #6f645f;
      line-height: 1.5;
      margin-bottom: 4px;
    `;
    subtitle.textContent = 'We mapped the concept to something familiar. Copy any part into your study notes whenever you like.';

    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
      background: rgba(255, 255, 255, 0.82);
      border-radius: 14px;
      border: 1px solid rgba(193, 95, 60, 0.14);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      color: #2f2724;
      font-size: 14px;
      line-height: 1.6;
    `;

    const paragraphs = analogy
      .split(/\n{2,}/)
      .map(section => section.trim())
      .filter(section => section.length > 0);

    if (paragraphs.length === 0) {
      const fallback = document.createElement('p');
      fallback.style.margin = '0';
      fallback.appendChild(document.createTextNode(analogy));
      contentWrapper.appendChild(fallback);
    } else {
      paragraphs.forEach(section => {
        const paragraph = document.createElement('p');
        paragraph.style.margin = '0';
        paragraph.appendChild(document.createTextNode(section));
        contentWrapper.appendChild(paragraph);
      });
    }

    const buttonsWrapper = document.createElement('div');
    buttonsWrapper.style.cssText = `
      display: flex;
      justify-content: flex-end;
      margin-top: 14px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'wardbot-close-modal';
    closeBtn.style.cssText = `
      padding: 10px 20px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #d8724b 0%, #c15f3c 100%);
      color: #fff;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 16px 30px -18px rgba(193, 95, 60, 0.58);
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
    `;
    closeBtn.textContent = 'Close';
    closeBtn.onmouseenter = () => {
      closeBtn.style.transform = 'translateY(-1px)';
      closeBtn.style.boxShadow = '0 18px 32px -16px rgba(193, 95, 60, 0.62)';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.transform = 'translateY(0)';
      closeBtn.style.boxShadow = '0 16px 30px -18px rgba(193, 95, 60, 0.58)';
    };

    buttonsWrapper.appendChild(closeBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(subtitle);
    modalContent.appendChild(contentWrapper);
    modalContent.appendChild(buttonsWrapper);

    closeBtn.addEventListener('click', () => {
      closeOverlay();
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
}
