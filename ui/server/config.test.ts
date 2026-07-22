import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_CATALOG, DEFAULT_UI_MODELS, loadUiSettings, saveUiSettings } from "./config.js";

describe("ui config", () => {
  it("loads default catalog and mappings for roles plus complexity 1-5", () => {
    const dir = mkdtempSync(join(tmpdir(), "logpose-ui-"));
    const config = loadUiSettings(join(dir, "config.json"), join(dir, "model-catalog.json"));

    expect(Object.keys(config.models).sort()).toEqual(["1", "2", "3", "4", "5", "plan", "refine", "review"]);
    expect(config.catalog.providers[0].models).toContain("openai/gpt-5.5");
  });

  it("saves mappings to config and explicit catalog separately", () => {
    const dir = mkdtempSync(join(tmpdir(), "logpose-ui-"));
    const configPath = join(dir, "config.json");
    const catalogPath = join(dir, "model-catalog.json");

    saveUiSettings(configPath, catalogPath, {
      models: { ...DEFAULT_UI_MODELS, plan: "local/llama" },
      catalog: { providers: [{ name: "local", baseUrl: "http://localhost:11434/v1", models: ["local/llama"], apiKey: "provider-nope" } as any] },
      apiKey: "nope"
    } as any);

    const raw = readFileSync(configPath, "utf8");
    const catalogRaw = readFileSync(catalogPath, "utf8");
    expect(raw).toContain("local/llama");
    expect(raw).not.toContain('"providers"');
    expect(catalogRaw).toContain("http://localhost:11434/v1");
    expect(catalogRaw).toContain('"models"');
    expect(raw).not.toContain("provider-nope");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("nope");
  });

  it("preserves unrelated config keys while dropping old provider model caches", () => {
    const dir = mkdtempSync(join(tmpdir(), "logpose-ui-"));
    const configPath = join(dir, "config.json");
    const catalogPath = join(dir, "model-catalog.json");
    writeFileSync(configPath, JSON.stringify({
      sentry: { org: "acme" },
      providers: [{ name: "old", baseUrl: "https://old.example/v1", models: ["old/model"] }]
    }));

    saveUiSettings(configPath, catalogPath, {
      models: DEFAULT_UI_MODELS,
      catalog: { providers: [{ name: "new", baseUrl: "https://new.example/v1", models: ["new/model"] }] }
    });

    const raw = readFileSync(configPath, "utf8");
    expect(raw).toContain('"sentry"');
    expect(raw).toContain("acme");
    expect(raw).not.toContain('"providers"');
    expect(raw).not.toContain("old/model");
    expect(readFileSync(catalogPath, "utf8")).toContain("new/model");
  });

  it("falls back to default catalog when catalog file is absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "logpose-ui-"));

    expect(loadUiSettings(join(dir, "config.json"), join(dir, "model-catalog.json")).catalog).toEqual(DEFAULT_MODEL_CATALOG);
  });
});
