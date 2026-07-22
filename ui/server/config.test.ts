import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_UI_CONFIG, loadUiConfig, saveUiConfig } from "./config.js";

describe("ui config", () => {
  it("loads default providers and mappings for roles plus complexity 0-5", () => {
    const config = loadUiConfig(join(mkdtempSync(join(tmpdir(), "logpose-ui-")), "config.json"));

    expect(Object.keys(config.models).sort()).toEqual(["0", "1", "2", "3", "4", "5", "plan", "refine", "review"]);
    expect(config.providers.map((provider) => provider.name)).toContain("openai");
    expect(config.providers.find((provider) => provider.name === "openai")?.models).toContain("openai/gpt-5.5");
  });

  it("saves provider base urls and models without secrets", () => {
    const file = join(mkdtempSync(join(tmpdir(), "logpose-ui-")), "config.json");

    saveUiConfig(file, {
      ...DEFAULT_UI_CONFIG,
      providers: [{ name: "local", baseUrl: "http://localhost:11434/v1", models: ["local/llama"] }],
      models: { ...DEFAULT_UI_CONFIG.models, plan: "local/llama" },
      apiKey: "nope"
    } as any);

    const raw = readFileSync(file, "utf8");
    expect(raw).toContain("http://localhost:11434/v1");
    expect(raw).toContain("local/llama");
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("nope");
  });
});
