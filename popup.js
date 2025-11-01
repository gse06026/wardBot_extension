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
const DEFAULT_SUMMARY_PREFERENCE = 'balanced-brief';
const DEFAULT_QUIZ_PREFERENCE = 'challenge';
const SUMMARY_PRESETS = {
  'quick-bullets': {
    prompt: 'Summarize the text into exactly three concise bullet points. Each bullet should focus on one core takeaway and stay under 12 words.',
    heading: 'Summary · Quick bullets',
    generating: 'Condensing into quick bullets...'
  },
  'balanced-brief': {
    prompt: 'Summarize the text into three or four bullet points. Give each bullet a short context phrase plus the key takeaway in a friendly tone.',
    heading: 'Summary · Balanced brief',
    generating: 'Shaping a balanced summary...'
  },
  'deep-outline': {
    prompt: 'Summarize the text into a short outline with section headers and sub-bullets. Highlight relationships, causes/effects, and any important numbers while staying under 120 words.',
    heading: 'Summary · Deep outline',
    generating: 'Drafting a structured outline...'
  }
};

const QUIZ_PRESETS = {
  warmup: {
    prompt: 'Create one gentle multiple-choice question (options A, B, C) that checks basic understanding of the text. Provide the correct answer and a one-sentence explanation that encourages the learner.',
    heading: 'Quiz · Warm-up',
    generating: 'Building a warm-up quiz...'
  },
  challenge: {
    prompt: 'Create two application-focused multiple-choice questions (options A, B, C) based on the text. After each question, provide the correct answer with a brief justification. Use plausible distractors.',
    heading: 'Quiz · Challenge',
    generating: 'Crafting a challenge quiz...'
  },
  'exam-mode': {
    prompt: 'Create three assessment questions drawn from the text. Include at least one multiple-choice item (options A, B, C) and one short-answer prompt. After listing the questions, provide an answer key with concise reasoning for each.',
    heading: 'Quiz · Exam mode',
    generating: 'Preparing exam-mode questions...'
  }
};

let userPreferences = {
  summary: DEFAULT_SUMMARY_PREFERENCE,
  quiz: DEFAULT_QUIZ_PREFERENCE
};

const getSummaryPreset = () => SUMMARY_PRESETS[userPreferences.summary] || SUMMARY_PRESETS[DEFAULT_SUMMARY_PREFERENCE];
const getQuizPreset = () => QUIZ_PRESETS[userPreferences.quiz] || QUIZ_PRESETS[DEFAULT_QUIZ_PREFERENCE];

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
  
  const { outputLanguage = 'en', ...rest } = options;

  return await LanguageModel.create({
    expectedOutputs: [{
      type: 'text',
      languages: [outputLanguage]
    }],
    ...rest
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
  chrome.storage.sync.get(
    {
      summaryPreference: DEFAULT_SUMMARY_PREFERENCE,
      quizPreference: DEFAULT_QUIZ_PREFERENCE
    },
    (data) => {
      userPreferences.summary = data.summaryPreference || DEFAULT_SUMMARY_PREFERENCE;
      userPreferences.quiz = data.quizPreference || DEFAULT_QUIZ_PREFERENCE;
    }
  );

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

      await processTextWithAI({
        text: textToSummarize,
        mode: 'summary'
      });
    });
  }

  if (quizButton && notePad) {
    quizButton.addEventListener('click', async () => {
      const textForQuiz = notePad.value;
      if (!textForQuiz) {
        alert('Please enter some text in the notepad to create a quiz from.');
        return;
      }

      await processTextWithAI({
        text: textForQuiz,
        mode: 'quiz'
      });
    });
  }

  async function processTextWithAI({ text, mode }) {
    const preset = mode === 'summary' ? getSummaryPreset() : getQuizPreset();
    const generatingMessage = preset.generating || `Generating ${mode}...`;
    const originalContent = notePad.value;
    notePad.value = generatingMessage;

    try {
      const sanitizedText = sanitizeInput(text);

      if (!aiModel) {
        aiModel = await createOrCheckAIModel({ outputLanguage: 'en' });
      }

      const prompt = `${preset.prompt}\n\nTEXT:\n"""${sanitizedText}"""`;
      const response = await aiModel.prompt(prompt, { outputLanguage: 'en' });
      const cleanedResponse = response.trim();

      const trimmedOriginal = originalContent.trimEnd();
      const baseText = trimmedOriginal.length ? `${trimmedOriginal}\n\n` : '';
      notePad.value = `${baseText}--- ${preset.heading} ---\n${cleanedResponse}\n`;
      notePad.scrollTop = notePad.scrollHeight;
    } catch (error) {
      const readableMode = mode === 'summary' ? 'summary' : 'quiz';
      console.error(`Error generating ${readableMode}:`, error);
      alert(`Failed to generate ${readableMode}: ${error.message}`);
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

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'summaryPreference')) {
      const updatedSummary = changes.summaryPreference?.newValue;
      userPreferences.summary = updatedSummary || DEFAULT_SUMMARY_PREFERENCE;
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'quizPreference')) {
      const updatedQuiz = changes.quizPreference?.newValue;
      userPreferences.quiz = updatedQuiz || DEFAULT_QUIZ_PREFERENCE;
    }
  });
}
