# Ward Bot

**AI-powered research assistant Chrome extension**

Ward Bot helps you research and learn more effectively by using Chrome's built-in AI to analyze web pages, explain concepts with personalized analogies, and generate study materials.

---

## Features

### 1. Context-Based Search
- Ask questions about the current webpage
- AI finds and highlights the most relevant sentences
- Auto-scrolls to highlighted results
- Smart text matching with fallback algorithms

### 2. Analogy Tutor
- Right-click any text -> "Ward Bot: Explain with Analogy Tutor"
- AI explains complex concepts using your personal interests
- Customize your interests in settings (e.g., "League of Legends", "Cooking")

### 3. AI Study Notes
- Copy-paste or collect highlighted text in notepad
- Generate summaries with one click
- Create quiz questions automatically
- Build your knowledge base while browsing

---

## Installation

### Prerequisites
- **Chrome 138+** with AI features enabled
- Compatible hardware for Chrome Built-in AI

### Steps
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `wardBot_extension` folder
6. The Ward Bot icon should appear in your toolbar

---

## Usage

### Basic Workflow
1. **Navigate** to any webpage
2. **Click** the Ward Bot icon in toolbar
3. **Ask** a question in the text box (e.g., "What is VPC?")
4. **Click** "Find on Page" -> AI highlights relevant text
5. **Click** highlighted text -> Add to notepad
6. **Use** "Summarize" or "Make a Quiz" for study materials

### Context Menu (Analogy Tutor)
1. **Select** any text on a webpage
2. **Right-click** -> "Ward Bot: Explain with Analogy Tutor"
3. **Read** the AI-generated explanation in a modal

### Settings
1. Open Chrome extensions page
2. Click "Options" under Ward Bot
3. Enter your interest/hobby (e.g., "League of Legends")
4. Click "Save"

---

## Technical Details

### Architecture
- **Manifest V3** compliance
- **Service Worker** for background tasks
- **Content Scripts** for DOM manipulation
- **Chrome Built-in AI** (no external API costs)

### Key Files
```
wardBot_extension/
├── manifest.json           # Extension configuration
├── background.js          # Context menu handler
├── content_script.js      # Highlight & analogy logic
├── popup.html/js          # Main UI
├── options.html/js        # Settings page
└── README.md              # This file
```

### AI Integration
- Uses Chrome's experimental `LanguageModel` API
- No external API keys required
- All processing happens locally on your device
- Privacy-first: no data sent to external servers

---

## Features in Detail

### Smart Text Matching
When AI returns quotes, Ward Bot uses a 2-tier matching system:
1. **Exact match**: Finds text word-for-word
2. **Keyword fallback**: Matches 70%+ of keywords if exact match fails

This handles cases where AI slightly modifies text or adds ellipsis.

### Security
- XSS protection: Escaped user content in modals
- Text length limits: Max 15,000 characters sent to AI
- Input validation on all user interactions

### Performance
- AI model caching: Reuses models across calls
- Proper cleanup: Destroys models when popup closes
- Efficient DOM traversal with TreeWalker API

---

## Limitations

- **Chrome Built-in AI required**: Won't work on other browsers or older Chrome versions
- **English optimized**: AI responses are primarily in English
- **Page text limit**: Only first 15,000 characters analyzed
- **Highlight accuracy**: Depends on AI returning exact quotes from page

---

## Troubleshooting

### "Chrome AI is not available"
- Update Chrome to version 138 or later
- Check if your device supports Chrome Built-in AI
- Enable experimental AI features in `chrome://flags`

### Highlights not appearing
- Open DevTools (F12) -> Console tab
- Check for "Found 0 matching text nodes" message
- Try rephrasing your question
- Use "Clear Highlights" button and search again

### Context menu not showing
- Refresh the webpage
- Reload the extension in `chrome://extensions`
- Check if background service worker is running

---

## Development

### Local Setup
```bash
git clone <repository-url>
cd wardBot_extension
# Load unpacked in Chrome
```

### Making Changes
1. Edit files
2. Go to `chrome://extensions`
3. Click reload button under Ward Bot
4. Test changes

### Debugging
- **Popup**: Right-click popup -> Inspect
- **Content Script**: F12 on webpage -> Console tab
- **Background**: `chrome://extensions` -> Service Worker -> Inspect

---

## Privacy

Ward Bot respects your privacy:
- All AI processing happens locally on your device
- No data sent to external servers
- No tracking or analytics
- Settings stored locally in Chrome sync storage

---

## License

MIT License - feel free to modify and distribute

---

## Credits

Built with:
- Chrome Extensions Manifest V3
- Chrome Built-in AI (LanguageModel API)
- Vanilla JavaScript (no frameworks)

---
