const interestInput = document.getElementById('interest');
const saveButton = document.getElementById('saveButton');
const statusDiv = document.getElementById('status');

saveButton.addEventListener('click', () => {
  const interest = interestInput.value;
  chrome.storage.sync.set({ userInterest: interest }, () => {
    statusDiv.textContent = 'Settings saved successfully!';
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 2000);
  });
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('userInterest', (data) => {
    if (data.userInterest) {
      interestInput.value = data.userInterest;
    }
  });
});