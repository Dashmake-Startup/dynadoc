This is a notorious headache in Electron development on macOS. When you run `npm start` or `electron .`, your app is technically running inside the **pre-compiled Electron binary** (located deep in your `node_modules`).

Because this binary isn't "your" signed app yet, macOS often refuses to show it in the Screen Recording list or ignores the permission even if you try to add it manually.

### The Solution: Granting Permission to the "Helper"

You need to add the specific Electron executable that runs your dev environment to the macOS Privacy list.

#### 1. Locate the Dev Executable

Open your terminal and run this command to find exactly where the Electron binary is living:

```bash
echo $(pwd)/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron

```

#### 2. Manually Add it to System Settings

1. Go to **System Settings** > **Privacy & Security** > **Screen & System Audio Recording**.
2. Do **not** look for your app name. Click the **[+]** button at the bottom.
3. When the file picker opens, press `Cmd + Shift + G` (Go to folder).
4. Paste the path you got from the `echo` command above.
5. Select the **Electron** executable and click **Open**.
6. Ensure the toggle is turned **ON**.


### Innovative "Dev Mode" Helper

To make this easier for your team, add a helper function that checks the status and opens the settings for them if it's denied:

```javascript
import { systemPreferences, shell } from 'electron';

function checkPermissions() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');
    if (status !== 'granted') {
      console.log("Permission not granted. Opening Privacy Settings...");
      // This opens the exact correct page in macOS settings
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
  }
}

```

### Why `tccutil` might be needed

If you've added it but it still fails, macOS's permission database (TCC) might be "stuck." You can reset it for Electron by running this in your terminal:

```bash
tccutil reset ScreenCapture com.github.Electron

```

*(Note: In production,  Replace `com.github.Electron` with your `appId` if you have already set one in your `package.json`).*

**Would you like me to help you create a "Permission Guard" Svelte component that shows a helpful "Enable Screen Recording" guide to the user if the status is denied?**

/path/to/dynadoc/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron





This error persists because on newer macOS versions (Sonoma and Sequoia), simply adding "Electron" to the list isn't enough if the **TCC (Transparency, Consent, and Control) database** has become corrupted or "stuck" for the developer binary.

Since `tccutil reset` didn't work, we need to use a more aggressive "Developer Force" method.

### 1. The "Clean Slate" Terminal Commands

Sometimes resetting just the ID isn't enough. You need to reset the entire Screen Capture category to force the OS to rebuild the list. **Close Electron completely**, then run these three commands in order:

```bash
# 1. Reset the entire Screen Capture database (Aggressive)
tccutil reset ScreenCapture

# 2. Reset the specific Electron Dev ID just in case
tccutil reset ScreenCapture com.github.Electron

# 3. Restart the macOS background daemon responsible for permissions
sudo killall lssave

```

---

### 4. Why it says "Failed to get sources" instead of prompting

macOS has a "Preflight" check. If your app (or the Electron binary) is **unsigned**, or if you have **ScreenCaptureKit** issues on macOS 14+, Electron might fail silently.

**Quick Test:**
Try changing your `types` to *only* `['window']`.

```javascript
const sources = await desktopCapturer.getSources({ types: ['window'] });

```

If `window` works but `screen` fails, you 100% have a macOS System Permission issue. If both fail, your Electron version might be hitting a bug with the newer macOS ScreenCaptureKit.

### Final Troubleshooting Step

If you are on **macOS Sequoia**, try launching Electron with this flag to bypass the newer (and buggier) capture method:

```bash
npx electron . --disable-features=ScreenCaptureKit

```