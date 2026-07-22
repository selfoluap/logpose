import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type ModelProvider = { name: string; baseUrl: string; models: string[] };
export type ModelCatalog = { providers: ModelProvider[] };
export type UiSettings = { models: Record<string, string>; catalog: ModelCatalog };

export const DEFAULT_UI_MODELS: Record<string, string> = {
  refine: "opencode-go/deepseek-v4-flash",
  plan: "openai/gpt-5.5",
  review: "opencode-go/deepseek-v4-pro",
  "1": "opencode-go/deepseek-v4-flash",
  "2": "opencode-go/deepseek-v4-flash",
  "3": "openai/glm-5.2",
  "4": "openai/gpt-5.4",
  "5": "openai/gpt-5.5"
};

export const DEFAULT_MODEL_CATALOG: ModelCatalog = {
  providers: [
    {
      name: "aperture",
      baseUrl: "https://api.openai.com/v1",
      models: [
        "opencode-go/deepseek-v4-flash",
        "opencode-go/deepseek-v4-pro",
        "openai/glm-5.2",
        "openai/gpt-5.4",
        "openai/gpt-5.5"
      ]
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
  const { providers: _providers, apiKey: _apiKey, token: _token, secret: _secret, ...currentSafe } = current;
  writeFileSync(configPath, `${JSON.stringify({ ...currentSafe, models: normalizeUiModels(settings) }, null, 2)}\n`);
  writeFileSync(catalogPath, `${JSON.stringify(normalizeCatalog(settings.catalog), null, 2)}\n`);
  return loadUiSettings(configPath, catalogPath);
}
