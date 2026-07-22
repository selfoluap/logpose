import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_UI_CONFIG, loadUiConfig, saveUiConfig } from "./config.js";

describe("ui config", () => {
  it("loads default providers and mappings for roles plus complexity 0-5", () => {
    const config = loadUiConfig(join(mkdtempSync(join(tmpdir(), "logpose-ui-")), "config.json"));

    expect(Object.keys(config.models).sort()).toEqual(["0", "1", "2", "3", "4", "5", "plan", "refine", "review"]);
    expect(config.providers.map((provider) => provider.name)).toContain("openai");
    expect(config.providers.find((provider) => provider.name === "openai")).toEqual({ name: "openai", baseUrl: "https://api.openai.com/v1" });
  });

  it("saves provider base urls without cached models or secrets", () => {
    const file = join(mkdtempSync(join(tmpdir(), "logpose-ui-")), "config.json");

    saveUiConfig(file, {
      ...DEFAULT_UI_CONFIG,
      providers: [{ name: "local", baseUrl: "http://localhost:11434/v1", models: ["local/llama"], apiKey: "provider-nope" }],
      models: { ...DEFAULT_UI_CONFIG.models, plan: "local/llama" },
      apiKey: "nope"
    } as any);

    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("http://localhost:11434/v1");
    expect(raw).toContain("local/llama");
    expect(raw).not.toContain('"models": [\n      "local/llama"');
    expect(raw).not.toContain("provider-nope");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("nope");
  });

  it("preserves unrelated config keys while dropping old provider model caches", () => {
    const file = join(mkdtempSync(join(tmpdir(), "logpose-ui-")), "config.json");
    writeFileSync(file, JSON.stringify({
      sentry: { org: "acme" },
      providers: [{ name: "old", baseUrl: "https://old.example/v1", models: ["old/model"] }]
    }));

    saveUiConfig(file, {
      ...DEFAULT_UI_CONFIG,
      providers: [{ name: "new", baseUrl: "https://new.example/v1" }]
    });

    const raw = readFileSync(file, "utf8");
    expect(raw).toContain('"sentry"');
    expect(raw).toContain("acme");
    expect(raw).toContain("https://new.example/v1");
    expect(raw).not.toContain("old/model");
  });
});
