# ddoc-office tasks

- Documentation
  - Technical specifications -> Donald, Sarah, Folly (Lead)
  -
- Programming UI
  - Ribbon
    - Word processing (Ex. MS Word) -> Folly
    - Presentation (Ex. MS PowerPoint) -> Salou
  - Context Menu / Popup menu (Right click menu ) -> Donald
  -
- Programming core app
  - Document editor
  - Code editor
  - Terminal -> Folly
- Programming external tools (converters (docx->pdf, docx->html...), automatic ddoc file cleaner for disappearing file function,.. )
  - Converters -> Sarah
- Programming .sddoc security server manager
-

==========
Fonctionalites necessaires

-Translation files at bottom side with tabs and easy navigation (Like excel tabs)
- Document Version control
-Support in-document variable creation and usage system to avoid repeating words/paragraphs/sections

-In document variables can have 4 type of content : text, file, folder, rich content (html css), ai (dymanic content coupled with Artificial Intelligence), inner document part (like just a slide, a spreadsheett, a table in one document inside the ddoc document)
- Support in document ai generation
-Support AI chat (like copilot in Word/Powerpoint/Excel...) for document analysis, questions, interaction...

-In document variables can have 4 type of visibilities : Advanced settings. document (only currently file document), package (default behavior, whole document with all children folders and files), desktop (all documents on user desktop can use it), cloud (all documents created by the user on desktop/drive... can use it)    

- Support in document multiple type (text, slide with animation.. , spreadsheet, worksheet, design tool like mini photoshop with layers support..) in the same document and all will share the sync every time a variable is changed anywhere in the document

- Support reviews, comments and suggestions

-Support in-document file content include/append system to avoid repeating files
-Files navigation in left side (like VSCode). Should be able to detect and list all folders and files and all tree navigation.
-Be able to create a document (like a folder) that can content multiple files and folders in the same .ddoc file. To address the issue of file organization.
-Be able to collaborate with teams on one document (comments, track changes, revision history… https://ckeditor.com/ )
-Be able to chat with collaborators in real time
-Be able to have meeting with collaborators and get instant meeting report
-Meeting reports should be added automatically to user's ai knowledge base. so users can ask any question related to previous meetings
-Be able to protect (hide, display but not modifiable) or blur .sddoc documents (whole document, only one file, only one page, only one section or paragraph or even only one word or even only one character)
Use different kind of protection for accessing .sddoc and .xddoc  protected or blurred parts  (2 factors authentication, password protection, …)
Use different kind of protection for accessing .sddoc files  (2 factors authentication, password protection, …)
Have icons (shortcuts) for each page to change quickly the orientation, the background
Use Layers system for items superposition (Like in Photoshop)
-Implement Photoshop like image editor
Implement in the image editor, an AI image genration based on layers for more detailed and user need focused output. User create different text layers an input the prompt on each layer (for example one for bg description, another for text, another for sns logo...). Then the generation for each layeer is done and user can change any details like position,prompt, scale... of the generated image
#Be able to change quickly the type of a page (or section or word) to either document/presentation/image/text (for programming)/excel/powerpoint...
-Can quickly switch between edit and view mode (https://kenshin54.github.io/popline/)
-Manage references (citations…) for images, tables,…
-Be able to have 2 synchronized modes: CODE (for developers) and WYSIWYG (for non-developers)
-Support Latex
-Have a terminal like in VSCode
-Add text style via customizable shortcuts (In WYSIWYG): For example Ctrl+Shift+I put text in italic
-Be able to add form components (textfield, checkboxes, radios, buttons...) anywhere in a ddoc file
Create Forms that can be sent directly within the file without attaching the file to email or other sending methods
Create templating for Word, Powerpoint
-Support Word, Excel, Powerpoint, PDF, Image (read only), PSD (read only), video, multimedia... in the same DDOC
-Be able to open in read mode as many text, image, video, binary, 3D files as it can
Export in PDF that cannot be edited or the content being copied (Method TO JPG->TO PDF)
-Be able to add (programming) comment to a part (word, section, ...) in a document
Documents should automatically update their contents if any
-Documents should display the correspondent translation by default based on user's locale


-Should support ephemeral documents. Ephemeral documents are documents that can be delete from the disk automatically by the app once the deadline is reached. Any document that is opened is checked and if there is any ephemeral deadline, it should prevent user from viewing the content and delete it automatically from disk. .xddoc and .sddoc should both have that function. The ephemeral deadline can be : a datetime (January 5, 2025 13:00:00), a relative time after creation (5 days, 5 years after document initial creation), or a relative time after a specific user/group's (email addresses ) initial access (read mode),  or a relative time after user/group 's (email addresses) initial writing (write mode). Only the document owner or creator can choose if the document can continue to be viewed by himself or if the document should be deleted for him too. Of course, owner can include or exclude users who are exempt of the ephemeral and automatic deletion. Provide audit logs before deletion for compliance without keeping the actual data on the disk.

-Support slideshow (should support slides, sheets, docs...)
-Support live update of the slideshow when file change. For existing apps like ms word. You must exit slideshow and restart
Slide show should support bg color change,support video autoplay, lightbox (https://revealjs.com/lightbox/), slide visibility,vertical-slides https://revealjs.com/vertical-slides/... like revealjs

-it should also support the number of times user can read a document, or the number of times user can write a document, number of times user can read a document before it should be deleted automatically, number of times user can write a document before it should be deleted automatically

-It should also support character/word/sentence count limitation. For example allow user to write only 500 words in a document. User cannot go beyond. Important for academic fields.For minimum feature (50 sentences minimum...), manage it (on app close, and top of the document) with a popup or alert message that shows to user that the minimum requirement is not fulfilled


-It should also support some criteria like user should include maximum 2 tables, or 3 images, 4 videos... User cannot go beyond. For minimum feature (2 tables minimum...), manage it (on app close, and top of the document) with a popup or alert message that shows to user that the minimum requirement is not fulfilled

-Support granular export. Like export only one specific table (or all tables) in a file to excel/markdown/html/… Or, selected text, sheet, slide, file (one image/all images, video/all videos)… to excel/markdown/html…

Support text completion like in Gmail

-Support Gallery (images + videos with thumbnail like on websites) adding. Should have slideshow mode. Can be created from folder or multiple files

-Support Lorem piscum (dummy text adding)



-Support the situation where a document was exported to pdf or any format and the document changed, so the app should ask user if he/she wants to update exported files as well. The user will have 2 options export even if exported file location does no exist (file was deleted or moved), and export only if exported file location still exist. So once a file changed, ask this via bottom notification, and also ask when user wants to close the file




User can have 2 simultaneous account on the software (individual - free and Pro/Enterprise/Organization). User can easily switch from one account to another. Organization account admin can decide if user can have personal account beside the organization account.

The default owner and admin of an organization is the user that subscribe to the organization plan. In case of the professional account, the admin is the user himself

if enable by user, The cloud storage should automatically save user's documents at the same location as the one on the local device. For example if user's currently opened document is at C:/Download, in the cloud it she also be at C:/Download. This maximize document organization




Support OCR: Image to Text

Support easy addons/plugins installation (like VSCode)
Support easy theme installation for UX design change (like VSCode)



Think about dynamic book series (like manga, newspapers, magazine...) that can be updated automatically once a new chapter or sequence is published

Think about subscription plans or paid plan for dynamic book series where user will get full access to a documeent once they pay (for example master class course that has free module and paid module)

Think about dynamic book with dynamic stories, where stories can change depending on what the reader choose as proposed actions in the book.




=========

Limitation of existing word processing tools

THINKFREE/HANGUL
Not free
The time it takes to swap between documents
not as feature rich as Microsoft's offerings.

Like most free "MS Office"-like programs, not much available in templates, macros, or a lot of the more advanced document design and editing tools

The file size was too big, it took up too much space.

If only does not open some word or excel format files.

Creating presentations felt a bit slow because the availably templates are low in volumen and there's not much offer. Same as in compatibility when working with other types of software, sometimes the format got lost in the file conversion.


Speaking specifically for the mobile version, its problems lay with the issues of any business tasks on a mobile device. Mainly, anything needed for free draw like a signature is very hard to do, even with a stylus.

Video tutorials should have been included in the bundle and integrated into the software with a supporting cloud-based file format (so that we can stream the tutorials)

======

FOE EXCEL FEATURES


#### 2. **Feature set to start with (MVP+)**

Here’s the minimal viable Excel-like feature layer that users will love:

| Category       | Feature                         | Description                                                                                          |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Variables**  | Named variables                 | Each `<td>` or `<input>` can have an automatic variable like `cell_A1` or user-defined `price_total` |
| **Formulas**   | Basic operators                 | `+`, `-`, `*`, `/`, `()`                                                                             |
| **Functions**  | Basic math                      | `SUM()`, `AVERAGE()`, `MIN()`, `MAX()`, `ROUND()`                                                    |
| **References** | Cross-cell                      | `A1 + A2`, or `price * qty`                                                                          |
| **Reactivity** | Auto-update                     | Changing one cell updates dependent cells                                                            |
| **Formatting** | Number, currency, percent, date | Optional but improves usability                                                                      |
| **Bindings**   | Link variables to text fields   | e.g. a paragraph shows “Total: {{total_price}}”                                                      |

This gives 80% of the *perceived power* of Excel in documents — without building an Excel clone.

---

#### 3. **Under the hood**

You can use an **embedded formula engine** like:

* 🧠 [formulajs](https://github.com/formulajs/formulajs) — Excel-compatible functions
* ⚙️ [hot-formula-parser](https://github.com/handsontable/formula-parser)
* 🧩 [hyperformula](https://github.com/handsontable/hyperformula) — full spreadsheet engine but modular

These can run directly inside your Svelte/Electron/Vite app — no external service needed.
You can scope it so that only your table and variable system use it.

---

#### 4. **Competitive positioning**

Think of your app as:

> “A document editor that understands data and calculations.”

That puts you **between Word and Excel**, but without needing to reimplement either fully.
You’ll serve professionals, writers, and teams who want **smart documents** — not raw spreadsheets.

---

#### 5. **Later features (if demand grows)**

You can gradually add:

* Formula autocomplete (`=SU...` → `SUM`)
* Variable inspector panel
* Cross-document references (`{{file.total}}`)
* Charts linked to table data
* Conditional formatting (color by value)

But only if users explicitly request spreadsheet-like control.

---

### 🧠 Bottom line

You **don’t need all Excel features** to compete.
You just need:

* A **robust formula parser**
* **Reactive variable system**
* **Smart table integration** with the document structure.

That’s enough to make Ddoc feel powerful and unique — like “Word meets Notion meets Excel.”


NEXT

## ✅ If you add those Later features, will it *feel* like Excel inside documents?

### → **Almost — about 90–95% of the perceived power of Excel.**

Here’s why: what users *feel* as “Excel power” mostly comes from:

1. **Instant feedback** (recalculation and highlighting)
2. **Familiar formula behavior** (`=SUM(A1:A5)`)
3. **Visual cues and control (charts, color rules, autocomplete)**
4. **Cross-sheet logic (references and named ranges)**

The features you listed cover *all four* of these — that’s already what most office users need *within a document context*.

Let’s look at them one by one 👇

---

### 🧮 1. Formula autocomplete (`=SU... → SUM`)

✅ *Massive perceived value gain.*
Even if your formula system supports only 30–50 functions, autocomplete makes users feel it’s “Excel-grade.”
People rarely use more than 20 core formulas anyway (SUM, AVERAGE, IF, ROUND, CONCAT, etc.).

> **Impact on perception:** +30%
> **Implementation complexity:** Medium (you can integrate with `formulajs` and a popup suggestion UI).

---

### 🧭 2. Variable inspector panel

✅ *Gives visibility and confidence.*
This allows users to see “what’s behind the scenes” — e.g.,

> price_total = qty × price_per_unit

That’s what makes Notion formulas or Airtable formulas feel powerful and transparent.

> **Impact on perception:** +20%
> **Complexity:** Low–Medium (you can visualize current variable map from the reactive store).

---

### 🌐 3. Cross-document references (`{{file.total}}`)

✅ *Feels like enterprise-level automation.*
Users will think, “Wow, this document talks to another!”
Even if it’s implemented as simple file-link JSON caching, it gives a *networked Excel workbook* feel.

> **Impact:** +25%
> **Complexity:** Medium–High (needs dependency resolution, caching, and updates when files change).

---

### 📊 4. Charts linked to table data

✅ *Visual satisfaction = perceived intelligence.*
Even simple charts (bar, pie, line) make the system feel analytical and professional.
No one needs pivot tables if they can generate a chart from live variables.

> **Impact:** +15–20%
> **Complexity:** Medium (you can integrate Chart.js or ECharts and bind data to your formula engine).

---

### 🎨 5. Conditional formatting (color by value)

✅ *Perceived interactivity and “smartness.”*
This is the difference between “a static table” and “a living spreadsheet.”
Highlighting cells or rows based on conditions (e.g., `<td class:warning={price>limit}>`) creates an immediate Excel-like feedback loop.

> **Impact:** +10%
> **Complexity:** Low–Medium (depends on how your formula evaluator integrates with DOM bindings).

---

### 🧩 Combined effect

| Feature                  | Real complexity | Perceived Excel power boost |
| ------------------------ | --------------- | --------------------------- |
| Formula autocomplete     | ⚙️⚙️            | ⭐⭐⭐⭐                        |
| Variable inspector panel | ⚙️              | ⭐⭐⭐                         |
| Cross-document refs      | ⚙️⚙️⚙️          | ⭐⭐⭐⭐                        |
| Charts                   | ⚙️⚙️            | ⭐⭐⭐⭐                        |
| Conditional formatting   | ⚙️              | ⭐⭐⭐                         |

✅ Together: **≈ 90–95% of Excel’s perceived power**
❌ Missing only: pivot tables, macros/VBA, 3D charts, advanced data validation — which few non-analyst users care about.

---

### 💬 So the *real answer*:

> If you implement those 5 features *well* — responsive, reactive, and visually satisfying —
> your users will **feel like they’re using a powerful, Excel-grade document system**.

You’ll surpass Google Docs’ tables, Word tables, and even Notion’s database tables in perceived intelligence.

---

### 🧠 Bonus: The *philosophical edge*

Excel is a *spreadsheet that pretends to be a database*.
Your Ddoc could be a *document that pretends to be a spreadsheet*.
That’s a **completely new category** — “computable documents.”

That novelty gives you differentiation **without cloning Excel**.

---

If you want, I can draft a **feature map diagram** showing which subsystems you’d need (formula engine, variable store, document bindings, chart bridge, etc.) to reach that 95% Excel parity — while staying lean inside Electron/Svelte.

Would you like me to draw that next?


======

ONLYOFFICE (https://www.softwareadvice.com/cms/onlyoffice-docs-profile/ )

Like i always say make it more easy not yust a rip off

Some options like applying same background to every powerpoint slide is hidden or not available.

My only concern is the price of this software, which is a little expensive for users like me who are finding an alternative solution of MS Office. Otherwise, all other features are pleasant.


Recently they changed their pricing model and pushed out the small businesses, and now it's no longer affordable like it used to be. Talking to their customer service resulted in a "well, sorry, that's the way it is now...", so we will have to find another similar product/service at the previous price point. This is quite disappointing, as it's a great service. I guess when companies grow, they ultimately choose to discard the smaller businesses that supported them in the early stages. Unfortunate.

It doesn't allow sharing of documents over Google drive or Onedrive. also the customer support is not the best in the world.

Sometimes the software hangs too much and the common window to show recent works is unnecessary

The only con is that the software opens slowly

Regarding the application of presentations, I think that the number of options for transitions and backgrounds for the slides could be improved.


nothing essential that I recall, it would great to have integration with webex

Performance can be improved and more feature can be added.

It needs more photoshop options at no additional cost.

Nothing. Everything is fine, exept the lacking of OneDrive connection.

The design limitations are the only element that I would recommend improvements.

My biggest struggle is that it doesn't word count and although there are plugins with literally limitless

Unfortunately far to be full-features in my opinion No way to manage document fields. Bad management of templates. Some unbearable bugs (e.g. rename a sheet and you'll lose all inter-sheet references) Rather buggy overall.

Dépendance à internet et ne prend pas en charges plusieurs types de documents


======

WPS Office (https://www.softwareadvice.com/spreadsheet/wps-office-profile/ )


I like how you are able to open different documents of varying formats from the same window, but it would be nice to be able to open more document formats or rather if WPS Office could add more programs?

One of the things I dislike about WPS office is the limitations placed on the free version, this software has a lot of nice features but most of it are not available to free users and that not quite encouraging
One other thing I dislike about this software is the level of ads shown for the free version, it had lots of ads showing up every single minute and that's a huge turn off for me.


The grammar check tool on this software is not good enough. After working on this, you transfer your work to Microsoft office and you see there are a lot of red inks. It does not readily support researching tools like Endnotes and Mendeley (It takes a lot of calibrations of the settings to get them through) Very difficult.

I think it doesn't have all required tools to edit pdf docs ,Not sure if it has spell check. About the safety and security of this app its not very clear about the data and privacy ,

There needs to be an auto update function built in.

======

VS CODE (https://www.getapp.com/development-tools-software/a/visual-studio-code/reviews/ )

I don't like the graphic interface of VS Code. For me, it is too many things I don't use and not too many things I would like to have. I think the side menu could be improved with more practical options and buttons.

Changing settings can be a bit difficult. There is a Command Palate where you can search for settings to change, but I find the use of it a bit daunting and I can understand if newcomers also find this a difficult but necessary tool to learn.

Cons: Excess plugin for similar purpose. Hard to find the best one.




