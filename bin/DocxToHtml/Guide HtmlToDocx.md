Got it 👍 You’re in a **Svelte + Electron (Node.js)** environment, but **Open-Xml-PowerTools (HtmlConverter)** is a **.NET library**. That means you can’t just `npm install` it — you’ll need to run it through a bridge (like a background service, CLI tool, or .NET → Node interop).

Here’s how you can realistically use **HtmlConverter** in your Svelte + Electron project:

---

## 1. Install Open-Xml-PowerTools in .NET

PowerTools is a NuGet package:

```sh
dotnet new console -n HtmlToDocx
cd HtmlToDocx
dotnet add package Open-Xml-PowerTools
dotnet add package DocumentFormat.OpenXml
```

This creates a small .NET Core console app.

---

## 2. Example .NET Code for Conversion

`Program.cs`:

```csharp
using System;
using System.IO;
using DocumentFormat.OpenXml.Packaging;
using OpenXmlPowerTools;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: HtmlToDocx input.docx output.html");
            Environment.Exit(1);
        }

        string inputFile = args[0];
        string outputFile = args[1];

        using (WordprocessingDocument doc = WordprocessingDocument.Open(inputFile, false))
        {
            var settings = new HtmlConverterSettings()
            {
                PageTitle = Path.GetFileNameWithoutExtension(inputFile)
            };

            var html = HtmlConverter.ConvertToHtml(doc, settings);

            File.WriteAllText(outputFile, html.ToStringNewLineOnAttributes());
        }

        Console.WriteLine("Converted: " + outputFile);
    }
}
```

Build it:

```sh
dotnet publish -c Release -r osx-x64 --self-contained false
```

(Replace `osx-x64` with `win-x64` or `linux-x64` depending on your target.)

Now you have a **CLI tool** (`HtmlToDocx`) that converts `.docx → .html`.

---

## 3. Call From Electron (Node.js)

Inside Electron, call the compiled .NET CLI using `child_process`:

```ts
import { execFile } from 'child_process'
import path from 'path'

function convertHtmlToDocx(inputPath: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const exePath = path.join(__dirname, 'bin/HtmlToDocx') // your published exe path
    execFile(exePath, [inputPath, outputPath], (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message)
      } else {
        resolve(outputPath)
      }
    })
  })
}
```

Usage in your **Svelte/Electron renderer**:

```ts
async function handleFile(filePath: string) {
  const outputHtml = filePath.replace(/\.docx$/, '.html')
  await window.api.convertHtmlToDocx(filePath, outputHtml) // preload bridge
  const htmlContent = await fs.promises.readFile(outputHtml, 'utf8')
  document.getElementById('viewer').innerHTML = htmlContent
}
```

---

## 4. Alternatives if You Don’t Want a .NET Binary

If bundling .NET feels too heavy:

- **Pandoc**: install system-wide, call via `child_process` (simpler than compiling PowerTools).
- **Mammoth.js**: pure JS, but less fidelity.
- **LibreOffice headless**: `soffice --convert-to html file.docx`, callable from Node.

---

✅ **Best Fidelity** = run the .NET **HtmlConverter** CLI in the background and pipe HTML back into Electron.
⚡ **Simpler but lower fidelity** = Pandoc or Mammoth.js.

---

Do you want me to show you how to **bundle that .NET converter directly inside your Electron app** (so you don’t require users to install .NET separately)?

Perfect 👍 then we’ll make your **Electron app ship with the Open-Xml-PowerTools converter** as a built-in helper binary, so your users don’t need to install .NET manually.

Here’s a step-by-step:

---

## 1. Create the .NET Converter Project

On your dev machine:

```sh
dotnet new console -n HtmlToDocx
cd HtmlToDocx
dotnet add package Open-Xml-PowerTools
dotnet add package DocumentFormat.OpenXml
```

Replace `Program.cs` with:

```csharp
using System;
using System.IO;
using DocumentFormat.OpenXml.Packaging;
using OpenXmlPowerTools;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: HtmlToDocx input.docx output.html");
            return 1;
        }

        string inputFile = args[0];
        string outputFile = args[1];

        try
        {
            using (WordprocessingDocument doc = WordprocessingDocument.Open(inputFile, false))
            {
                var settings = new HtmlConverterSettings()
                {
                    PageTitle = Path.GetFileNameWithoutExtension(inputFile)
                };

                var html = HtmlConverter.ConvertToHtml(doc, settings);

                File.WriteAllText(outputFile, html.ToStringNewLineOnAttributes());
            }

            Console.WriteLine(outputFile);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Error: " + ex.Message);
            return 2;
        }
    }
}
```

---

## 2. Publish a Self-Contained Binary

Build a single binary for your target OS:

- **macOS (Intel):**

  ```sh
  dotnet publish -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true
  ```

- **Windows (x64):**

  ```sh
  dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
  ```

- **Linux (x64):**

  ```sh
  dotnet publish -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true
  ```

This produces a **single executable** (`HtmlToDocx`) under `bin/Release/netX.X/<rid>/publish/`.

---

## 3. Put the Binary Inside Your Electron Project

Inside your Electron project:

```
/resources/
   /bin/
      /win/
         HtmlToDocx.exe
      /mac/
         HtmlToDocx
      /linux/
         HtmlToDocx
```

---

## 4. Electron Code to Run the Converter

In `main/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('docxConverter', {
  convert: (inputPath, outputPath) => ipcRenderer.invoke('convert-docx', inputPath, outputPath)
})
```

In `main/index.js`:

```js
const { ipcMain } = require('electron')
const { execFile } = require('child_process')
const path = require('path')
const os = require('os')

ipcMain.handle('convert-docx', async (event, inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    let platform
    if (os.platform() === 'win32') platform = 'win/HtmlToDocx.exe'
    else if (os.platform() === 'darwin') platform = 'mac/HtmlToDocx'
    else platform = 'linux/HtmlToDocx'

    const exePath = path.join(process.resourcesPath, 'bin', platform)

    execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
      if (err) reject(stderr || err.message)
      else resolve(stdout.trim())
    })
  })
})
```

---

## 5. Use It in Your Svelte Renderer

Example Svelte code:

```svelte
<script>
  async function handleFileSelect(event) {
    const file = event.target.files[0]
    if (!file) return

    const output = file.path.replace(/\.docx$/, '.html')
    try {
      const htmlPath = await window.docxConverter.convert(file.path, output)
      const res = await window.fs.readFile(htmlPath, 'utf-8')
      document.getElementById('viewer').innerHTML = res
    } catch (err) {
      console.error('Conversion failed:', err)
    }
  }
</script>

<input type="file" accept=".docx" on:change={handleFileSelect} /><div id="viewer"></div>
```

---

✅ Now your Electron app ships with **HtmlConverter** already embedded.
No need for your users to install .NET or any extra tools.

Would you like me to also show you how to **bundle all three platforms (Win, Mac, Linux) inside your Electron build** so it auto-selects at runtime?

Perfect 🚀 let’s make your **Electron + Svelte app automatically ship with the right Docx→HTML converter binary** for **Windows, macOS, and Linux**, and pick the correct one at runtime.

---

# 1. Build All 3 Binaries (One Time on Your Dev Machine / CI)

From your C# `HtmlToDocx` project:

```sh
# Windows (x64)
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/win

# macOS (Intel x64)
dotnet publish -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac

# macOS (Apple Silicon arm64, optional if you want native M1/M2/M3)
dotnet publish -c Release -r osx-arm64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac-arm64

# Linux (x64)
dotnet publish -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/linux



dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/win && dotnet publish -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac && dotnet publish -c Release -r osx-arm64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac-arm64 && dotnet publish -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/linux && chmod +x ./publish/mac/DocxToHtml ./publish/mac-arm64/DocxToHtml ./publish/linux/DocxToHtml && cp -R "publish/" "../../resources/bin/"


```

You’ll now have:

```
publish/
  win/DocxToHtml.exe
  mac/DocxToHtml
  mac-arm64/DocxToHtml
  linux/DocxToHtml
```

---

# 2. Copy Binaries into Your Electron Project

Put them in a `resources/bin` folder inside your Electron project (this folder will be bundled):

```
/resources/bin/
  /win/DocxToHtml.exe
  /mac/DocxToHtml
  /mac-arm64/DocxToHtml
  /linux/DocxToHtml
```

⚠️ On macOS/Linux: run `chmod +x DocxToHtml` so the binaries are executable.

---

# 3. Detect Platform in Electron `main/index.js`

Update your IPC handler:

```js
const { ipcMain } = require('electron')
const { execFile } = require('child_process')
const path = require('path')
const os = require('os')

ipcMain.handle('convert-docx', async (event, inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    let binaryFolder

    if (os.platform() === 'win32') {
      binaryFolder = 'win/HtmlToDocx.exe'
    } else if (os.platform() === 'darwin') {
      // Handle Intel vs Apple Silicon
      binaryFolder = os.arch() === 'arm64' ? 'mac-arm64/HtmlToDocx' : 'mac/HtmlToDocx'
    } else {
      binaryFolder = 'linux/HtmlToDocx'
    }

    const exePath = path.join(process.resourcesPath, 'bin', binaryFolder)

    execFile(exePath, [inputPath, outputPath], (err, stdout, stderr) => {
      if (err) reject(stderr || err.message)
      else resolve(stdout.trim())
    })
  })
})
```

---

# 4. Preload Exposure (`preload.js`)

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('docxConverter', {
  convert: (inputPath, outputPath) => ipcRenderer.invoke('convert-docx', inputPath, outputPath)
})
```

---

# 5. Svelte Renderer Usage

```svelte
<script>
  async function convertHtmlToDocx(event) {
    const file = event.target.files[0]
    if (!file) return

    const outputPath = file.path.replace(/\.docx$/, '.html')

    try {
      const htmlPath = await window.docxConverter.convert(file.path, outputPath)
      const res = await window.fs.readFile(htmlPath, 'utf-8')
      document.getElementById('viewer').innerHTML = res
    } catch (e) {
      console.error('Conversion failed:', e)
    }
  }
</script>

<input type="file" accept=".docx" on:change={convertHtmlToDocx} />
<div id="viewer" class="prose"></div>
```

---

# 6. Pack with Electron Builder

In your `electron-builder.yml` or `package.json` config, make sure `resources/bin` is included:

```yaml
extraResources:
  - from: resources/bin
    to: bin
```

This ensures the executables are inside your packaged app under `process.resourcesPath/bin`.

---

✅ Now your Electron app will automatically select the correct **HtmlToDocx** binary at runtime (Windows/Mac/Linux, Intel/ARM).
✅ Users won’t need to install .NET at all.
✅ Works offline, packaged inside your app.

---

Would you like me to also add a **fallback mode** (use an online API if the binary fails to run), so your app is guaranteed to always convert docx → html even if the local binary breaks?

brew install --cask dotnet-sdk

## Running it by hand

```sh
dotnet run -- "<input.html>" "<output folder>"
```
