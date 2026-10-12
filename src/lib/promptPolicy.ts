/**
 * Prompt 字段规范化（开源桌面端：无套餐限额，只做清洗）
 * 规则移植自 prompthub-website/app/lib/prompt-policy.ts，去掉 Pro 门控。
 */

export const BUILTIN_CATEGORIES = [
  "code",
  "writing",
  "analysis",
  "creative",
  "other",
] as const;

export type BuiltinCategory = (typeof BUILTIN_CATEGORIES)[number];

export const MAX_CATEGORY_LEN = 64;
export const MAX_CATEGORIES_PER_PROMPT = 10;
export const MAX_TAGS = 32;
export const MAX_TAG_LEN = 40;

export function normalizeCategory(category: string): string {
  let c = String(category || "other").trim() || "other";
  if (c.length > MAX_CATEGORY_LEN) c = c.slice(0, MAX_CATEGORY_LEN);
  return c;
}

/**
 * 将任意形态的 categories 输入规范化为字符串数组。
 * 空输入默认 ["other"]，永不返回空数组。
 */
export function normalizeCategories(input: unknown): string[] {
  let arr: unknown[] = [];
  if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === "string") {
    const s = input.trim();
    if (s.startsWith("[")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {
        arr = s ? [s] : [];
      }
    } else if (s) {
      arr = [s];
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    let v = String(raw ?? "").trim();
    if (!v) continue;
    if (v.length > MAX_CATEGORY_LEN) v = v.slice(0, MAX_CATEGORY_LEN);
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MAX_CATEGORIES_PER_PROMPT) break;
  }
  return out.length > 0 ? out : ["other"];
}

export function primaryCategoryOf(
  categories: string[] | null | undefined,
  fallback = "other",
): string {
  if (Array.isArray(categories) && categories.length > 0 && categories[0]) {
    return categories[0];
  }
  return fallback || "other";
}

export function normalizeTags(tags: unknown): string[] {
  const arr = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [];
  return arr
    .slice(0, MAX_TAGS)
    .map((t) => (t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) : t));
}
