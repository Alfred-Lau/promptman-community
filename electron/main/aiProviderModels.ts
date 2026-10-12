/** AI 设置：各 Provider 可选模型与默认端点（与 ipc ai:polish / ai:generate 一致） */

export type AiProvider =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "custom"
  | "bailian_coding";

export type BailianCodingRegion = "cn" | "intl";

/** 百炼 Coding Plan OpenAI 兼容 Chat Completions（勿与按量 dashscope 混用） */
export const BAILIAN_CODING_BASE_URLS: Record<BailianCodingRegion, string> = {
  cn: "https://coding.dashscope.aliyuncs.com",
  intl: "https://coding-intl.dashscope.aliyuncs.com",
};

export const AI_PROVIDER_MODELS: Record<
  Exclude<AiProvider, "custom">,
  readonly string[]
> = {
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "o1",
    "o1-mini",
    "o3-mini",
    "chatgpt-4o-latest",
  ],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
  ],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  /**
   * 百炼 Coding Plan 控制台展示的模型列表（与套餐更新同步，以控制台为准）
   * 千问 / 智谱 / Kimi / MiniMax
   */
  bailian_coding: [
    "qwen3.6-plus",
    "qwen3.5-plus",
    "qwen3-max-2026-01-23",
    "qwen3-coder-next",
    "qwen3-coder-plus",
    "glm-5",
    "glm-4.7",
    "kimi-k2.5",
    "MiniMax-M2.5",
  ],
};

/**
 * 与 `settings.ai` 合并后的实际 Provider。
 * 百炼 Coding Plan 专属 Key 以 `sk-sp-` 开头；若未保存 provider 或误选为 OpenAI，仍会误请求 api.openai.com。
 */
export function resolveEffectiveAiProvider(aiConfig: {
  provider?: string;
  apiKey?: string;
}): AiProvider {
  const key = (aiConfig.apiKey ?? "").trim();
  if (key.startsWith("sk-sp-")) {
    return "bailian_coding";
  }
  return (aiConfig.provider || "openai") as AiProvider;
}

export function getDefaultModel(provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "deepseek":
      return "deepseek-chat";
    case "bailian_coding":
      return "qwen3.6-plus";
    case "custom":
      return "";
    default:
      return "gpt-4o";
  }
}

export function getModelsForProvider(
  provider: AiProvider
): readonly string[] | null {
  if (provider === "custom") return null;
  return AI_PROVIDER_MODELS[provider];
}

/** 切换 Provider 时：若当前模型仍在新列表中则保留，否则用默认 */
export function normalizeModelOnProviderChange(
  prevModel: string | undefined,
  newProvider: AiProvider
): string {
  const list = getModelsForProvider(newProvider);
  if (newProvider === "custom") {
    return prevModel ?? "";
  }
  const trimmed = (prevModel ?? "").trim();
  if (trimmed && list!.includes(trimmed)) return trimmed;
  return getDefaultModel(newProvider);
}

export function resolveOpenAiCompatibleBaseUrl(params: {
  provider: AiProvider;
  customBaseUrl?: string;
  bailianCodingRegion?: BailianCodingRegion;
}): string {
  const { provider, customBaseUrl, bailianCodingRegion } = params;
  if (provider === "custom") {
    return customBaseUrl?.trim() || "https://api.openai.com";
  }
  if (provider === "bailian_coding") {
    const region = bailianCodingRegion === "intl" ? "intl" : "cn";
    return BAILIAN_CODING_BASE_URLS[region];
  }
  if (provider === "deepseek") return "https://api.deepseek.com";
  return "https://api.openai.com";
}

/** 用户未填写模型时，按 Provider 取内置默认（与历史 ipc 行为一致） */
export function resolveEffectiveModel(
  provider: AiProvider,
  model?: string
): string {
  const trimmed = (model ?? "").trim();
  if (trimmed) return trimmed;
  return getDefaultModel(provider) || "gpt-4o";
}
