import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type ModelProvider = { name: string; baseUrl: string; models: string[] };
export type ModelCatalog = { providers: ModelProvider[] };
export type UiSettings = { models: Record<string, string>; catalog: ModelCatalog };

export const DEFAULT_UI_MODELS: Record<string, string> = {
  refine: "aperture/deepseek-v4-flash",
  plan: "openai-codex/gpt-5.5",
  review: "aperture/deepseek-v4-pro",
  "1": "aperture/deepseek-v4-flash",
  "2": "aperture/deepseek-v4-flash",
  "3": "aperture/glm-5.2",
  "4": "openai-codex/gpt-5.4",
  "5": "openai-codex/gpt-5.5"
};

export const DEFAULT_MODEL_CATALOG: ModelCatalog = {
  providers: [
    {
      name: "aperture",
      baseUrl: "https://ai.tail1a19b7.ts.net/v1",
      models: [
        "aperture/big-pickle",
        "aperture/deepseek-v4-flash",
        "aperture/deepseek-v4-flash-free",
        "aperture/deepseek-v4-pro",
        "aperture/glm-5.2",
        "aperture/kimi-k2.7-code",
        "aperture/mimo-v2.5-free",
        "aperture/nemotron-3-ultra-free",
        "aperture/north-mini-code-free"
      ]
    },
    {
      name: "openai-codex",
      baseUrl: "http://ai.tail1a19b7.ts.net/codex",
      models: ["openai-codex/gpt-5.4", "openai-codex/gpt-5.5"]
    }
  ]
};

const MODEL_KEYS = ["1", "2", "3", "4", "5", "refine", "plan", "review"];

export function normalizeUiModels(input: unknown) {
  const raw = (input && typeof input === "object" ? input : {}) as { models?: unknown };
  const rawModels = raw.models && typeof raw.models === "object" ? raw.models as Record<string, unknown> : {};
  return Object.fromEntries(MODEL_KEYS.map((key) => [key, typeof rawModels[key] === "string" ? rawModels[key] : DEFAULT_UI_MODELS[key]]));
}

export function normalizeCatalog(input: unknown): ModelCatalog {
  const raw = (input && typeof input === "object" ? input : {}) as { providers?: unknown };
  const providers = Array.isArray(raw.providers)
    ? raw.providers
        .map((provider) => provider && typeof provider === "object" ? provider as Record<string, unknown> : null)
        .filter((provider): provider is Record<string, unknown> => Boolean(provider))
        .map((provider) => ({
          name: String(provider.name ?? "").trim(),
          baseUrl: String(provider.baseUrl ?? "").trim(),
          models: Array.isArray(provider.models) ? provider.models.map((model) => String(model).trim()).filter(Boolean) : []
        }))
        .filter((provider) => provider.name && provider.baseUrl && provider.models.length)
    : [];

  return { providers: providers.length ? providers : DEFAULT_MODEL_CATALOG.providers };
}

export function loadUiSettings(configPath: string, catalogPath: string): UiSettings {
  let config: unknown = {};
  let catalog: unknown = {};
  try { config = JSON.parse(readFileSync(configPath, "utf8")); } catch {}
  try { catalog = JSON.parse(readFileSync(catalogPath, "utf8")); } catch {}
  return { models: normalizeUiModels(config), catalog: normalizeCatalog(catalog) };
}

export function saveUiSettings(configPath: string, catalogPath: string, settings: UiSettings) {
  const current = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown> : {};
  mkdirSync(dirname(configPath), { recursive: true });
  mkdirSync(dirname(catalogPath), { recursive: true });
  const { providers: _providers, ...currentSafe } = current;
  writeFileSync(configPath, `${JSON.stringify({ ...currentSafe, models: normalizeUiModels(settings) }, null, 2)}\n`);
  writeFileSync(catalogPath, `${JSON.stringify(normalizeCatalog(settings.catalog), null, 2)}\n`);
  return loadUiSettings(configPath, catalogPath);
}
