### **Zlab**

> [!IMPORTANT] 
> Formerly Kslab — revived and renamed to Zlab.

A visual organization tool for notes, text, and images on an infinite canvas.

### **Table of Contents**

  * [Technologies](#technologies)
  * [Development Setup](#development-setup)
  * [Installation](#installation)
  * [Usage](#usage)
  * [Contributing](#contributing)

### **Technologies**

This project utilizes the following open-source libraries:

  * **Kiru:** A lightweight UI rendering library ([Kiru](https://kiru.dev))
  * **TypeScript:** A typed superset of JavaScript that adds optional static typing
  * **ESLint:** A linter for enforcing code style and catching potential errors

### **Development Setup**

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Klectr/zlab.git
   ```
2. **Install dependencies:**
This project uses [Bun](https://bun.sh) as its package manager.
   ```bash
   bun install
   ```

### **Installation**

Zlab is a web app — there is no desktop build. For development:

```bash
bun run dev
```

For production, `bun run build` emits a static `dist/` you can serve from any static host (HTTPS required for installation, see below).

**Install as an app (PWA):** open Zlab in Chrome over HTTPS (or localhost) and choose **Install Zlab** from the address-bar install icon or the browser menu. It installs like a native app and works offline after the first load (the service worker precaches the app shell and its assets while it installs), and keeps your boards in the browser's local storage on that origin.

### **Usage**

* **Create cards:** Use the toolbar to create a sticky note, add an image, or create a text item.
* **Edit:** Click into a note or text item and type; notes are written in Markdown.
* **Move and resize:** Drag a card to reposition it on the canvas, and drag its corner handle to resize it.
* **Delete:** Use a card's close button, or right-click a note or image card for its context menu.
* **Save and share a board:** Use the toolbar to export the board as a JSON file, and import a JSON file to replace the current board.
* **Find a card:** Click a card's marker on the minimap to scroll to it.

### **Contributing**

Report bugs and request features by opening a GitHub issue. For code changes, open a pull request against `main`, keep the change focused, follow the existing TypeScript and ESLint conventions, and make sure `bun run build` passes before submitting.
