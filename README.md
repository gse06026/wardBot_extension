# Ward Bot

<div align="center">

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-138%2B-blue.svg)](https://www.google.com/chrome/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)]()

**AI-powered research assistant Chrome extension**

[Installation](#installation) • [Quick Start](#usage) • [Features](#features) • [Technical Details](#technical-details) • [Troubleshooting](#troubleshooting)

</div>

---

## Overview

**Ward Bot** helps you research and learn more effectively by using **Chrome’s built-in AI** to analyze web pages, explain complex concepts through personalized analogies, and generate study materials — all locally, without sending data to external servers.

---

## Features

### 1. Context-Based Search

- Ask questions directly about the current webpage
- AI highlights the most relevant sentences automatically
- Auto-scrolls to results and supports smart fallback matching

### 2. Analogy Tutor

- Right-click → **Ward Bot: Explain with Analogy Tutor**
- Explains difficult ideas using your hobbies or interests
- Customize interests in settings (e.g. “League of Legends”, “Cooking”)

### 3. AI Study Notes

- Collect highlighted text into a notepad
- Generate summaries and quiz questions with one click
- Build your own knowledge base while browsing

---

## Installation

### Prerequisites

- **Chrome 138+** with AI features enabled
- Compatible device for Chrome Built-in AI

### Install from Chrome Web Store

1. Visit the [Ward Bot Web Store page](#) (link coming soon)
2. Click “Add to Chrome”
3. The Ward Bot icon appears in your toolbar

### Local Development Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select `wardBot_extension` folder

---

## Usage

### Basic Workflow

1. Open any webpage
2. Click the Ward Bot icon in the toolbar
3. Ask a question (e.g. "What is VPC?")
4. Click **Find Answers (Search)** to highlight answers
5. Add highlights to notepad and use **Summarize** or **Make a Quiz**

### Context Menu (Analogy Tutor)

1. Select text → Right-click → **Ward Bot: Explain with Analogy Tutor**
2. Read the AI response in the popup modal

### Settings

1. `chrome://extensions` → Options under Ward Bot
2. Enter your interests → Click **Save**

---

## Technical Details

### Architecture

| Component           | Purpose                             |
| ------------------- | ----------------------------------- |
| `manifest.json`     | Extension metadata (Manifest V3)    |
| `background.js`     | Context menu & service worker logic |
| `content_script.js` | DOM highlighting & AI interaction   |
| `popup.html/js`     | Main UI interface                   |
| `options.html/js`   | User settings                       |
| `docs/assets/`      | Images and screenshots              |

### AI Integration

- Uses Chrome’s experimental `LanguageModel` API
- **No external API keys required**
- **All processing happens locally**
- Privacy-first design — no data sent out

---

## Features in Detail

### Smart Text Matching

1. Exact match — finds precise quote
2. Keyword fallback — matches ≥ 70 % keywords if exact fails

### Security

- Escaped user content to prevent XSS
- Text limit 15 000 chars per AI call
- Validated all user inputs

### Performance

- Cached AI models across sessions
- Clean model teardown on popup close
- Efficient DOM search via TreeWalker API

---

## Limitations

- Works only on Chrome 138 + with Built-in AI
- English-optimized responses
- Analyses first 15 000 page characters only
- Highlight accuracy depends on AI quoting verbatim text

---

## Troubleshooting

### Chrome AI Unavailable

- Update Chrome ≥ 138
- Check hardware compatibility
- Enable experimental AI flags in `chrome://flags`

### Highlights Missing

- Open DevTools → Console → check for “Found 0 matching nodes”
- Rephrase question and try again
- Use **Clear Highlights** then search again

### Context Menu Missing

- Refresh page or reload extension
- Verify background service worker is active

---

## Development & Debugging

### Local Setup

```bash
chrome://extensions  →  Developer Mode → Load unpacked
```
