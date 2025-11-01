const interestInput = document.getElementById('interest');
const saveButton = document.getElementById('saveButton');
const clearButton = document.getElementById('clearButton');
const statusDiv = document.getElementById('status');
const chips = Array.from(document.querySelectorAll('.chip'));
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
    showStatus('Preferences saved');
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

chips.forEach((chip) => {
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
  chrome.storage.sync.get('userInterest', (data) => {
    if (data.userInterest) {
      interestInput.value = data.userInterest;
    }
  });
});
