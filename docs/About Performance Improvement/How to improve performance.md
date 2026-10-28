It’s a common "growing pain" when combining **Electron** and **Svelte 5** with a rich editor like **Tiptap**. You are essentially running a browser inside a shell, and if not optimized, it will behave like a memory sponge.

To fix this, we need to attack the "Big Three" memory hogs: **Node/Electron overhead**, **Tiptap's Document Object Model (DOM)**, and **Svelte 5's reactive graph**.

---

## 1. Tiptap & Y.js: The "Zombie Document" Problem
Tiptap and Y.js keep the entire document structure in memory to handle collaboration. If you don't explicitly "destroy" them, they stay in RAM even after you close a tab or navigate away.

### The Fix: Manual Cleanup
In Svelte 5, use the `$effect` or `onDestroy` equivalent to kill the editor instance.

```javascript
// Inside your Editor component
let editor;

$effect(() => {
  // Initialize editor
  return () => {
    // CRITICAL: This clears the memory used by the editor and Y.js
    editor?.destroy(); 
    provider?.destroy();
    ydoc?.destroy();
  };
});
```

---

## 2. Electron: The "Chrome Helper" Sprawl
Electron spawns multiple "Helper" processes. If your app is consuming **1GB+** for a simple text editor, you likely have **Memory Leaks** in the Renderer process.

### Optimization Strategy:
* **Disable Unused Features:** In your `main.js`, turn off what you don't need:
    ```javascript
    const win = new BrowserWindow({
      webPreferences: {
        offscreen: false, // Don't render what isn't visible
        contextIsolation: true,
        spellcheck: false, // Huge memory saver if you don't need it
        backgroundThrottling: true, // Stops JS when window is hidden
      }
    })
    ```
* **V8 Memory Limit:** You can force Electron to be "leaner" by passing flags:
    ```javascript
    // in your package.json start script
    "electron . --max-old-space-size=512"
    ```

---

## 3. Svelte 5 & UnoCSS: Style & Proxy Overhead
Svelte 5 uses **Proxies** for signals. While efficient, if you are accidentally creating huge reactive arrays (like unzipping a 50MB file into a `$state` variable), your RAM will explode.

### The Fix:
* **Keep Blobs out of `$state`:** Your `Uint8Array` data and ZIP buffers should be "Raw" variables. **Do not** wrap them in `$state()` or `$derived()`. Svelte doesn't need to track every byte of a file.
* **UnoCSS Runtime:** If you are using the UnoCSS *Runtime* (the script tag version), it scans the DOM constantly. Use the **Build-time** plugin (Vite plugin) instead to keep the CSS static.

---

## 4. The "Share Cache" Leak
Earlier, we discussed your `Map` for unauthenticated user shares. If that `Map` is in your **Frontend** code, it is likely the culprit.

* **Shared Buffers:** When you `unzipSync`, you are creating multiple copies of the data in memory.
* **Solution:** Use **Object URLs** for large assets instead of keeping them as `Uint8Array` in a Map.
    ```javascript
    // Instead of: entry.files.set(path, data)
    // Use:
    const blob = new Blob([data], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    // Store the URL (string) instead of the data (MBs)
    ```

---

## 5. Debugging: The "Three-Snapshot" Rule
To find exactly what is eating the RAM, use the **Chrome DevTools** (even inside Electron via `remote.openDevTools()`):

1.  **Open Memory Tab** -> Take Heap Snapshot.
2.  **Perform an action** (open a doc, edit, close it).
3.  **Take a second Snapshot.**
4.  **Use "Comparison" mode.** If the number of `Detached HTMLDivElement` or `YDoc` objects is growing, you have a leak.



### Quick Checklist:
* [ ] Are you calling `editor.destroy()`?
* [ ] Is `contextIsolation: true` set in Electron?
* [ ] Are you storing large binary files in Svelte `$state`? (Move them to regular variables).
* [ ] Are you running the **Production** build? (Dev mode has massive overhead for Sourcemaps).

**Are you seeing the high memory usage immediately at startup, or does it climb higher the longer you use the app?**