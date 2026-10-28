
## 1️⃣ Install Capacitor in your Vite/Svelte project

```bash
npm install @capacitor/core @capacitor/cli
npx cap init
```

* It will ask for **app name** and **app ID** (e.g., `com.example.myapp`).
* This creates a `capacitor.config.ts` file.

---

## 2️⃣ Build your web app

```bash
# npm run build
sudo npm run build:capacitor
```

* Vite will generate the production bundle (usually in `dist/`).
* Make sure **Tailwind/UnoCSS** is fully compiled and included.

---

## 3️⃣ Add mobile platforms

```bash
npm install @capacitor/ios @capacitor/android
npx cap add android
npx cap add ios
```

* Capacitor creates native projects in `android/` and `ios/` folders.

---

## 4️⃣ Sync your web build

Whenever your web app changes:

```bash
# npm run build
sudo npm run build:capacitor
npx cap copy
```

* `npx cap copy` updates the native project with your new web assets.
* For plugin/native changes, run `npx cap sync`.

---

## 5️⃣ Run on a device or emulator

**Android:**

```bash
npx cap open android
```

* Opens Android Studio.
* From there, you can build/run on an emulator or physical device.

**iOS:**

```bash
npx cap open ios
```

* Opens Xcode.
* Build/run on simulator or device.

---

## 6️⃣ Handle native plugins

* Capacitor provides plugins for camera, filesystem, push notifications, geolocation, etc.
* Install via:

```bash
npm install @capacitor/camera
npx cap sync
```

* Call from JS:

```ts
import { Camera, CameraResultType } from '@capacitor/camera'

const photo = await Camera.getPhoto({
  quality: 90,
  resultType: CameraResultType.Uri,
})
```

---

## 7️⃣ Tips for Performance & Size

* Enable **Vite production optimization**:

```bash
vite build --mode production
```

* Lazy-load heavy components and large assets.
* Use **native scroll/gesture APIs** if you rely on long lists.
* Minimize DOM-heavy operations; mobile WebView can lag compared to desktop browsers.
* UnoCSS/Tailwind tree-shaking reduces CSS size.

---

## 8️⃣ Hot Reloading During Development

* Run Vite dev server:

```bash
npm run dev
```

* In Capacitor config, set `server.url = "http://localhost:5173"` (your dev server)
* This enables live reload on device/emulator.

---

## ✅ Summary

* Capacitor allows **100% reuse** of your Svelte + Vite app.
* Native plugins are easy to add.
* Performance is good for most apps (WebView-based).
* Build size depends on assets, CSS, and web bundle optimization.
* Perfect for production-ready mobile apps without rewriting in React Native.

---

I can also make a **ready-to-use Capacitor + Svelte + UnoCSS starter template** with:

* Real-time Tiptap collaboration
* Mobile-friendly UI
* Tailwind/UnoCSS integration

This will save you a ton of setup time.

Do you want me to do that?
