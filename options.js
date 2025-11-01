const interestInput = document.getElementById('interest');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const statusDiv = document.getElementById('status');
const interestChips = Array.from(document.querySelectorAll('.chip[data-value]'));
const summaryChips = Array.from(document.querySelectorAll('.chip[data-summary]'));
const quizChips = Array.from(document.querySelectorAll('.chip[data-quiz]'));
const DEFAULT_SUMMARY_PREF = 'balanced-brief';
const DEFAULT_QUIZ_PREF = 'challenge';
let statusTimeoutId;

const showStatus = (message) => {
  if (!statusDiv) {
    return;
  }

  clearTimeout(statusTimeoutId);
  statusDiv.innerHTML = `<span class="status-icon">✓</span><span>${message}</span>`;
  statusDiv.className = 'status-container status-success show';

  statusTimeoutId = setTimeout(() => {
    statusDiv.className = 'status-container';
    statusDiv.innerHTML = '';
  }, 3200);
};

const persistInterest = (interest) => {
  chrome.storage.sync.set({ userInterest: interest }, () => {
    showStatus('Focus area saved');
  });
};

const persistSummaryPreference = (value) => {
  chrome.storage.sync.set({ summaryPreference: value }, () => {
    showStatus('Summary style updated');
  });
};

const persistQuizPreference = (value) => {
  chrome.storage.sync.set({ quizPreference: value }, () => {
    showStatus('Quiz focus updated');
  });
};

const selectChip = (chipCollection, selectedValue, dataAttr) => {
  chipCollection.forEach((chip) => {
    if (chip.dataset[dataAttr] === selectedValue) {
      chip.classList.add('is-selected');
    } else {
      chip.classList.remove('is-selected');
    }
  });
};

if (saveButton) {
  saveButton.addEventListener('click', () => {
    const interest = interestInput.value.trim();
    persistInterest(interest);
  });
}

if (clearButton) {
  clearButton.addEventListener('click', () => {
    interestInput.value = '';
    chrome.storage.sync.remove('userInterest', () => {
      showStatus('Preference cleared');
    });
    interestInput.focus();
  });
}

interestChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const value = chip.dataset.value || chip.textContent.trim();
    interestInput.value = value;
    interestInput.focus();
    if (typeof interestInput.setSelectionRange === 'function') {
      const end = interestInput.value.length;
      interestInput.setSelectionRange(end, end);
    }
  });
});

summaryChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const value = chip.dataset.summary;
    if (!value) {
      return;
    }
    selectChip(summaryChips, value, 'summary');
    persistSummaryPreference(value);
  });
});

quizChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const value = chip.dataset.quiz;
    if (!value) {
      return;
    }
    selectChip(quizChips, value, 'quiz');
    persistQuizPreference(value);
  });
});

if (interestInput) {
  interestInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (saveButton) {
        saveButton.click();
      } else {
        persistInterest(interestInput.value.trim());
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(
    {
      userInterest: '',
      summaryPreference: DEFAULT_SUMMARY_PREF,
      quizPreference: DEFAULT_QUIZ_PREF
    },
    (data) => {
      if (data.userInterest) {
        interestInput.value = data.userInterest;
      }
      selectChip(summaryChips, data.summaryPreference || DEFAULT_SUMMARY_PREF, 'summary');
      selectChip(quizChips, data.quizPreference || DEFAULT_QUIZ_PREF, 'quiz');
    }
  );
});
