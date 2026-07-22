import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type ProviderConfig = { name: string; baseUrl: string };
export type UiConfig = { models: Record<string, string>; providers: ProviderConfig[] };

export const DEFAULT_UI_CONFIG: UiConfig = {
  models: {
    "0": "logpose/direct-patch",
    refine: "opencode-go/deepseek-v4-flash",
    plan: "openai/gpt-5.5",
    review: "opencode-go/deepseek-v4-pro",
    "1": "opencode-go/deepseek-v4-flash",
    "2": "opencode-go/deepseek-v4-flash",
    "3": "openai/glm-5.2",
    "4": "openai/gpt-5.4",
    "5": "openai/gpt-5.5"
  },
  providers: [
    { name: "logpose", baseUrl: "local" },
    { name: "opencode-go", baseUrl: "https://models.dev/api" },
    { name: "openai", baseUrl: "https://api.openai.com/v1" }
  ]
};

const MODEL_KEYS = ["0", "1", "2", "3", "4", "5", "refine", "plan", "review"];

export function normalizeUiConfig(input: unknown): UiConfig {
  const raw = (input && typeof input === "object" ? input : {}) as { models?: unknown; providers?: unknown };
  const rawModels = raw.models && typeof raw.models === "object" ? raw.models as Record<string, unknown> : {};
  const models = Object.fromEntries(MODEL_KEYS.map((key) => [key, typeof rawModels[key] === "string" ? rawModels[key] : DEFAULT_UI_CONFIG.models[key]]));
  const providers = Array.isArray(raw.providers)
    ? raw.providers
        .map((provider) => provider && typeof provider === "object" ? provider as Record<string, unknown> : null)
        .filter((provider): provider is Record<string, unknown> => Boolean(provider))
        .map((provider) => ({
          name: String(provider.name ?? "").trim(),
          baseUrl: String(provider.baseUrl ?? "").trim()
        }))
        .filter((provider) => provider.name && provider.baseUrl)
    : [];

  return { models, providers: providers.length ? providers : DEFAULT_UI_CONFIG.providers };
}

export function loadUiConfig(configPath: string): UiConfig {
  try {
    return normalizeUiConfig(JSON.parse(readFileSync(configPath, "utf8")));
  } catch {
    return DEFAULT_UI_CONFIG;
  }
}

export function saveUiConfig(configPath: string, config: UiConfig) {
  const safe = normalizeUiConfig(config);
  const current = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown> : {};
  mkdirSync(dirname(configPath), { recursive: true });
  const { apiKey: _apiKey, token: _token, secret: _secret, ...currentSafe } = current;
  writeFileSync(configPath, `${JSON.stringify({ ...currentSafe, ...safe }, null, 2)}\n`);
  return safe;
}

export async function loadProviderModels(baseUrl: string) {
  if (baseUrl === "local") return ["logpose/direct-patch"];
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`);
  if (!response.ok) throw new Error(await response.text());
  const payload = await response.json() as { data?: Array<{ id?: unknown }> } | string[];

  return (Array.isArray(payload) ? payload : payload.data ?? [])
    .map((item) => typeof item === "string" ? item : item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
