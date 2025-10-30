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

let aiModel = null;

// Centralized AI availability checking function
async function createOrCheckAIModel(options = {}) {
  if (typeof LanguageModel === 'undefined') {
    throw new Error("Chrome's built-in AI is not available. Please ensure you're using Chrome 138+ with AI features enabled.");
  }
  
  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') {
    throw new Error("Chrome's built-in AI is not available. Please check that you have the required hardware and Chrome settings enabled.");
  }
  
  if (availability === 'downloadable') {
    console.log("Chrome AI model needs to be downloaded. This may take a few minutes on first use.");
    if (!confirm("Chrome AI model needs to be downloaded for the first time. This may take a few minutes. Continue?")) {
      throw new Error("User canceled AI download.");
    }
  }
  
  return await LanguageModel.create({ 
    outputLanguage: options.outputLanguage || 'en',
    ...options 
  });
}

// Input sanitization function
function sanitizeInput(text, maxLength = 5000) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a string');
  }
  
  // Remove potentially harmful content
  const cleaned = text
    .trim()
    .substring(0, maxLength)  // Limit length
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');  // Remove control characters
  
  if (cleaned.length === 0) {
    throw new Error('Input is empty after sanitization');
  }
  
  return cleaned;
}

document.getElementById('clearButton').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await ensureContentScript(tab.id);
    chrome.tabs.sendMessage(tab.id, { action: "clearHighlights" }, (_response) => {
      if (chrome.runtime.lastError) {
        console.error("Could not clear highlights:", chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.error("Content script injection failed:", error);
    alert("Could not access the page. Ward Bot may not work on this site.");
  }
});

document.getElementById('searchButton').addEventListener('click', async () => {
  let question = document.getElementById('questionInput').value;
  if (!question) {
    alert('Please enter a question.');
    return;
  }

  const searchButton = document.getElementById('searchButton');
  const originalButtonText = searchButton.textContent; // Cache original text
  searchButton.disabled = true;
  searchButton.textContent = 'Analyzing...';

  try {
    if (!navigator.userActivation?.isActive) {
      throw new Error("User interaction required. Please ensure you've interacted with the page before using the AI feature.");
    }

    question = sanitizeInput(question); // Sanitize the question input

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script before sending message
    await ensureContentScript(tab.id);

    const contextResponse = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "getText" }, (response) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(response);
      });
    });

    if (!contextResponse || !contextResponse.pageText) {
      throw new Error("Could not retrieve page text.");
    }
    const pageContext = contextResponse.pageText.substring(0, 15000);

    if (!aiModel) {
      aiModel = await createOrCheckAIModel({ outputLanguage: 'en' });
    }

    const prompt = `You are a helpful research assistant called "Ward Bot".
From the following text, find the THREE most relevant paragraphs that answer the user's question.
Respond with only a JSON array of strings, where each string is an exact quote from the text. Do not add any extra text or explanations.

--- TEXT FROM WEBPAGE ---
${pageContext}
--- END OF TEXT ---

USER QUESTION: "${question}"

JSON response:`;

    const schema = {
      "type": "array",
      "items": {
        "type": "string"
      },
      "maxItems": 3
    };

    const fullResponse = await aiModel.prompt(prompt, {
      outputLanguage: 'en',
      responseConstraint: schema
    });

    let answers;
    try {
      const cleanedJsonString = fullResponse.replace(/^```json\n?|```$/g, '').trim();
      answers = JSON.parse(cleanedJsonString);

      if (!Array.isArray(answers) || answers.length === 0) {
        throw new Error("AI could not find relevant answers.");
      }
    } catch (parseError) {
      console.error("JSON parsing failed. Raw response:", fullResponse);
      throw new Error("AI response format error. Please try again.");
    }

    console.log("Paragraphs found by Chrome AI:", answers);

    chrome.tabs.sendMessage(tab.id, {
      action: "highlightText",
      paragraphs: answers
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Content script may not be available on this page:", chrome.runtime.lastError.message);
      } else {
        console.log("Highlight response:", response);
        if (response && response.error) {
          alert(`Highlight failed: ${response.error}`);
        }
      }
    });

  } catch (error) {
    console.error("An error occurred:", error);
    alert(`An error occurred: ${error.message}`);
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = originalButtonText; // Restore original text
  }
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('textToAdd', (data) => {
    if (data.textToAdd) {
      const notePad = document.getElementById('notePad');
      if (notePad) {
        notePad.value += `${data.textToAdd}\n\n`;
        chrome.storage.local.remove('textToAdd');
      }
    }
  });

  const notePad = document.getElementById('notePad');
  const summarizeButton = document.getElementById('summarizeButton');
  const quizButton = document.getElementById('quizButton');

  if (summarizeButton && notePad) {
    summarizeButton.addEventListener('click', async () => {
      const textToSummarize = notePad.value;
      if (!textToSummarize) {
        alert('Please enter some text in the notepad to summarize.');
        return;
      }

      await processTextWithAI(
        textToSummarize,
        'Summarize the following text into a few key bullet points:',
        'Summary'
      );
    });
  }

  if (quizButton && notePad) {
    quizButton.addEventListener('click', async () => {
      const textForQuiz = notePad.value;
      if (!textForQuiz) {
        alert('Please enter some text in the notepad to create a quiz from.');
        return;
      }

      await processTextWithAI(
        textForQuiz,
        'Based on the following text, create a multiple-choice question with 3 options (A, B, C) and indicate the correct answer.',
        'Quiz'
      );
    });
  }

  async function processTextWithAI(text, instruction, type) {
    const originalContent = notePad.value;
    notePad.value = `Generating ${type}... Please wait.`;

    try {
      text = sanitizeInput(text); // Sanitize the text input

      if (!aiModel) {
        aiModel = await createOrCheckAIModel({ outputLanguage: 'en' });
      }
      const prompt = `${instruction}\n\nTEXT:\n\"\"\"${text}\"\"\"`;

      const response = await aiModel.prompt(prompt, { outputLanguage: 'en' });
      notePad.value = `${originalContent}\n\n--- ${type.toUpperCase()} ---\n${response}\n`;

    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      alert(`Failed to generate ${type}: ${error.message}`);
      notePad.value = originalContent;
    }
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && aiModel) {
    aiModel.destroy();
    aiModel = null;
  }
});
