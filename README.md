### **Zlab**

> [!IMPORTANT] 
> Formerly Kslab — revived and renamed to Zlab.

A visual organization tool for notes, text, shapes, and images.

### **Table of Contents**

  * [Technologies]()
  * [Development Setup]()
  * [Installation]()
      * [Desktop Application]() 
      * [Web Application]() 
  * [Usage]()
      * [Desktop Application]() 
      * [Web Application]() 
  * [Contributing]()
  * [License]()

### **Screenshots**

![screenshot](./src/assets/repo/screenshot.png)

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

* **Add notes:** Click the "+" button to create a new note.
* **Edit notes:** Double-click a note to edit its content.
* **Move notes:** Drag and drop notes to reposition them on the canvas.
* **Add shapes and images:** Use the toolbar to add various shapes and images.
* **Customize appearance:** Change the color, size, and other properties of elements.

### **Contributing**

[Guidelines for contributors, including how to report bugs or submit pull requests. Also, emphasize the importance of following TypeScript and ESLint conventions.]

### **License**

[Specify the license under which the project is released (e.g., MIT, Apache License 2.0)]

**Additional sections you might consider:**

  * **Roadmap** - Future plans for Zlab, such as implementing an infinite canvas or adding more features.

**Remember to replace the placeholder text with specific details about your project.**

