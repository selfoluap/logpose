import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads dropdown models from catalog and saves catalog edits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/config" && !init) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            models: { "1": "openai/gpt-5.4", "2": "openai/gpt-5.4", "3": "openai/gpt-5.4", "4": "openai/gpt-5.4", "5": "openai/gpt-5.5", refine: "openai/gpt-5.4", plan: "openai/gpt-5.5", review: "openai/gpt-5.4" },
            catalog: { providers: [{ name: "openai", baseUrl: "https://api.openai.com/v1", models: ["openai/gpt-5.4", "openai/gpt-5.5"] }] }
          })
        } as Response);
      }
      if (url === "/api/config" && init?.method === "PUT") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(String(init.body))) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<SettingsPage />); });
    await act(async () => {});

    expect(container.textContent).toContain("Model mappings");
    expect(container.textContent).toContain("Complexity 0: Hermes direct mechanical patch only");
    expect(container.textContent).toContain("Review");
    expect(container.querySelectorAll("select").length).toBe(16);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/provider-models", expect.anything());

    const planSelect = [...container.querySelectorAll<HTMLSelectElement>("select")].find((select) => select.getAttribute("aria-label") === "Plan model")!;
    expect([...planSelect.options].map((option) => option.value)).toEqual(["openai/gpt-5.4", "openai/gpt-5.5"]);
    act(() => {
      planSelect.value = "openai/gpt-5.4";
      planSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true })); });

    expect(fetchMock).toHaveBeenCalledWith("/api/config", expect.objectContaining({ method: "PUT" }));
    expect((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body).toContain('"plan":"openai/gpt-5.4"');
    expect((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body).toContain('"models":["openai/gpt-5.4","openai/gpt-5.5"');

    act(() => { root.unmount(); });
    container.remove();
  });

  it("keeps selected model visible when it is missing from catalog", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/config" && !init) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            models: { "1": "openai/gpt-5.4", "2": "openai/gpt-5.4", "3": "openai/gpt-5.4", "4": "openai/gpt-5.4", "5": "openai/gpt-5.5", refine: "openai/gpt-5.4", plan: "openai/gpt-5.5", review: "openai/gpt-5.4" },
            catalog: { providers: [{ name: "openai", baseUrl: "https://api.openai.com/v1", models: ["openai/gpt-5.4"] }] }
          })
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => { root.render(<SettingsPage />); });
    await act(async () => {});

    const planSelect = [...container.querySelectorAll<HTMLSelectElement>("select")].find((select) => select.getAttribute("aria-label") === "Plan model")!;
    expect([...planSelect.options].map((option) => option.value)).toContain("openai/gpt-5.5");

    act(() => { root.unmount(); });
    container.remove();
  });
});
