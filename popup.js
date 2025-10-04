let aiModel = null;

document.getElementById('searchButton').addEventListener('click', async () => {
  const question = document.getElementById('questionInput').value;
  if (!question) {
    alert('Please enter a question.');
    return;
  }

  const searchButton = document.getElementById('searchButton');
  searchButton.disabled = true;
  searchButton.textContent = 'Analyzing...';

  try {
    if (typeof LanguageModel === 'undefined') {
      throw new Error("Chrome's built-in AI is not available. Please ensure you're using Chrome 138+ with AI features enabled.");
    }

    if (!navigator.userActivation?.isActive) {
      throw new Error("User interaction required. Please ensure you've interacted with the page before using the AI feature.");
    }

    const availability = await LanguageModel.availability();
    if (availability === 'unavailable') {
      throw new Error("Chrome's built-in AI is not available. Please check that you have the required hardware and Chrome settings enabled.");
    } else if (availability === 'downloadable') {
      console.log("Chrome AI model needs to be downloaded. This may take a few minutes on first use.");
      if (!confirm("Chrome AI model needs to be downloaded for the first time. This may take a few minutes. Continue?")) {
        return;
      }
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

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
    const pageContext = contextResponse.pageText;

    if (!aiModel) {
      aiModel = await LanguageModel.create();
    }

    const prompt = `You are a helpful research assistant called "Ward Bot".
From the following text, find the THREE most relevant sentences that answer the user's question.
Each sentence should be 1-3 sentences long (maximum 150 characters).
Return ONLY a JSON array of strings. Each string MUST be an EXACT COPY from the original text - do not add "..." or summarize.

TEXT FROM WEBPAGE:
${pageContext}

USER QUESTION: "${question}"

Return JSON array with exact quotes:`;

    const schema = {
      "type": "array",
      "items": {
        "type": "string"
      },
      "maxItems": 3
    };

    const fullResponse = await aiModel.prompt(prompt, {
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
    searchButton.textContent = 'Find Answers (Search)';
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
      if (typeof LanguageModel === 'undefined') {
        throw new Error("Chrome AI is not available. Check your browser settings.");
      }
      const availability = await LanguageModel.availability();
      if (availability === 'unavailable') {
        throw new Error("Chrome AI is not available. Please check that you have the required hardware and Chrome settings enabled.");
      } else if (availability === 'downloadable') {
        console.log("Chrome AI model needs to be downloaded. This may take a few minutes on first use.");
        if (!confirm("Chrome AI model needs to be downloaded for the first time. This may take a few minutes. Continue?")) {
          notePad.value = originalContent;
          return;
        }
      }

      if (!aiModel) {
        aiModel = await LanguageModel.create();
      }
      const prompt = `${instruction}\n\nTEXT:\n\"\"\"${text}\"\"\"`;

      const response = await aiModel.prompt(prompt);
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