Summary of what I changed to match FortuneSheet menu actions and route sheet clicks away from TipTap:

- Expanded the FortuneSheet bridge so ribbon commands can use more workbook APIs.
- Updated formatting commands so when you’re in a sheet, they call FortuneSheet-style commands instead of TipTap.
- Wired sheet-only ribbon buttons (Number formats, Clear, Row/Column size, Freeze Panes, etc.) to sheet commands.
- Added sheet-only alignment/merge/wrap/rotation controls to `HomeRibbon`.

I also added safe no-ops for actions FortuneSheet doesn’t expose via its public API (Filter, Conditional Formatting, etc.) so they no longer trigger TipTap while in a sheet.

---

**Key code changes**

**1) Expanded FortuneSheet bridge**
- `src/renderer/src/extensions/tiptap/CustomSpreadsheetExtension/components/react/ReactSpreadsheetEditor.tsx`
  - Exposes more workbook APIs in `methods` (get/set cells, ranges, freeze, row/col size, sheet update, etc.)

- `src/renderer/src/stores/sheetBridge.store.ts`
  - Updated `SheetBridgeMethods` to match new methods.

**2) Sheet-aware formatting commands**
- `src/renderer/src/components/common/actions/formatting/commands/GenericFormatingEditorCommands.ts`
  - Added sheet helpers: number formats, decimals, wrap/rotate, vertical align, merge types.
  - Added row/column size prompt (uses `openTextInputModal`).
  - Sort A→Z / Z→A via `getSheet()` + `updateSheet()` (basic sort).
  - AutoSum inserts `=SUM(...)` formulas below the selection.
  - Hyperlink/image/search/replace now no-op in sheet (so no TipTap action leaks).

**3) Ribbon actions wired to FortuneSheet**
- `src/renderer/src/components/common/actions/formatting/GenericFormatingComponentMap.ts`
  - `FormatPainter` now uses `formatPainter()` (sheet-aware).
  - Added sheet vertical align, wrap, rotate commands.
  - `MergeCells` now a select with Merge All / H / V / Unmerge.
  - Excel actions for NumberFormat/Percent/Comma/Decimal, Clear, Row/Column size, Freeze Panes wired to commands.
  - Fill now uses color picker with `backgroundColor()` (sheet-aware).

**4) Sheet-only ribbon groups**
- `src/renderer/src/components/app/ribbon/components/home/HomeRibbon.svelte`
  - Added new “Alignment” sheet group with:
    - Vertical align
    - Wrap/Clip/Overflow
    - Rotate Up/Down/None
    - Merge Cells

---

**Important limitations (FortuneSheet API)**
These FortuneSheet toolbar actions are present in the ribbon but currently no-op because FortuneSheet doesn’t expose them through the public API that the React ref gives us:

- Filter
- Conditional Formatting
- Data Validation
- Split Column
- Location Condition
- Screenshot
- Comment/Image insertion

If you want those to work, we’ll need to patch FortuneSheet or fork it to expose the internal `handle*` toolbar handlers.

---

**Next steps you can choose**
1. I can patch FortuneSheet locally to expose toolbar handlers (full parity).
2. I can add more sheet-only ribbon items (Link/Image/Comment/etc.) as placeholders with a tooltip or disabled state.
3. I can refine Sort/AutoSum behaviors (multi-column sort, sum placement rules).

Tell me which direction you want.