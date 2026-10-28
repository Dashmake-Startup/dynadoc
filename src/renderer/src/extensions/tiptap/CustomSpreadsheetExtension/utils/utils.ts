import SpreadsheetEditor from "../components/SpreadsheetEditor.svelte";

export const CustomSpreadsheetExtensionComponents = {
  nodeView: SpreadsheetEditor,
  // decorationView: SlideDeck,
}
/* export function getSheetNameFromPath(rootPath: string) {
  if (!rootPath) return "Sheet1";

  // Normalize separators (Windows support)
  const normalized = rootPath.replace(/\\/g, "/");

  // Get last path segment
  const filename = normalized.split("/").pop() ?? "";

  // Remove extension
  const name = filename.replace(/\.[^/.]+$/, "");

  return name || "Sheet1";
} */
