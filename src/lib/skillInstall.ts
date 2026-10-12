/**
 * 本地化 Skill 安装命令（无云端 HMAC / 私有 token）
 * 远程来源技能复制 `npx skills add owner/repo`；本地技能提示导出 ZIP。
 */

export type SkillSourceMeta = {
  sourceType?: string | null;
  sourceRef?: string | null;
  sourceSkill?: string | null;
  sourceCommit?: string | null;
};

export function buildNpxSkillsAddCommand(source: SkillSourceMeta): string | null {
  const ref = (source.sourceRef || "").trim();
  if (!ref) return null;
  const skill = (source.sourceSkill || "").trim();
  if (skill) {
    return `npx skills add ${ref} --skill ${JSON.stringify(skill)}`;
  }
  return `npx skills add ${ref}`;
}

export function formatSkillSourceLabel(source: SkillSourceMeta, locale: "zh" | "en"): string | null {
  const type = (source.sourceType || "").trim();
  const ref = (source.sourceRef || "").trim();
  if (!type && !ref) return null;
  const commit = source.sourceCommit ? source.sourceCommit.slice(0, 7) : "";
  const skill = (source.sourceSkill || "").trim();
  const bits = [ref || type, skill, commit].filter(Boolean);
  if (locale === "zh") {
    if (type === "github") return `来自 GitHub · ${bits.join(" · ")}`;
    if (type === "market") return `来自发现页 · ${ref || ""}`.trim();
    return `来源 · ${bits.join(" · ")}`;
  }
  if (type === "github") return `From GitHub · ${bits.join(" · ")}`;
  if (type === "market") return `From Discover · ${ref || ""}`.trim();
  return `Source · ${bits.join(" · ")}`;
}
