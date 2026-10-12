/**
 * 将 electron-updater 的 releaseNotes（string | ReleaseNoteInfo[]）规范为纯文本。
 */
export function normalizeUpdaterReleaseNotes(notes: unknown): string | null {
  if (notes == null || notes === "") return null;
  if (typeof notes === "string") {
    const t = notes.trim();
    return t || null;
  }
  if (Array.isArray(notes)) {
    const parts = notes.map((item) => {
      if (item && typeof item === "object" && "note" in item) {
        return String((item as { note?: string }).note ?? "");
      }
      return "";
    });
    const t = parts.filter(Boolean).join("\n").trim();
    return t || null;
  }
  return null;
}
