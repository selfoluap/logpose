import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LogposeConfig, ModelProvider } from "../types";

const mappings = [
  ["refine", "Refine"],
  ["plan", "Plan"],
  ["review", "Review"],
  ["1", "Complexity 1"],
  ["2", "Complexity 2"],
  ["3", "Complexity 3"],
  ["4", "Complexity 4"],
  ["5", "Complexity 5"]
] as const;

function providerFor(model: string, providers: ModelProvider[]) {
  return providers.find((provider) => provider.models.includes(model))?.name
    ?? providers.find((provider) => model.startsWith(`${provider.name}/`))?.name
    ?? providers[0]?.name
    ?? "";
}

export function SettingsPage() {
  const [config, setConfig] = useState<LogposeConfig | null>(null);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({});

  useEffect(() => {
    api.config()
      .then((next) => {
        setConfig(next);
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Failed to load settings"));
  }, []);

  if (!config) return <div className="panel p-4 text-sm">{message}</div>;

  function updateProvider(index: number, patch: Partial<ModelProvider>) {
    setConfig((current) => current && {
      ...current,
      catalog: { providers: current.catalog.providers.map((provider, i) => i === index ? { ...provider, ...patch } : provider) }
    });
  }

  async function save() {
    setSaving(true);
    setMessage("Saving settings...");
    try {
      setConfig(await api.saveConfig(config!));
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    setMessage("Resetting settings...");
    try {
      setConfig(await api.resetConfig());
      setSelectedProviders({});
      setMessage("Settings reset.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to reset settings");
    } finally {
      setSaving(false);
    }
  }

  function optionsFor(providerName: string, currentModel: string) {
    const models = config!.catalog.providers.find((provider) => provider.name === providerName)?.models ?? [];
    return currentModel && !models.includes(currentModel) ? [currentModel, ...models] : models;
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <section className="panel p-4">
        <div className="eyebrow">Configuration</div>
        <h2 className="mt-2 text-lg font-semibold">Model mappings</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Complexity 0: Hermes direct mechanical patch only. No model used.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mappings.map(([key, label]) => {
            const providerName = selectedProviders[key] ?? providerFor(config.models[key], config.catalog.providers);
            const options = optionsFor(providerName, config.models[key]);
            return (
              <label key={key} className="grid gap-2 text-sm">
                <span className="text-[var(--muted)]">{label}</span>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2">
                  <select className="range-select rounded-[var(--radius-sm)]" value={providerName} onChange={(event) => {
                    const nextProviderName = event.target.value;
                    const nextModel = config.catalog.providers.find((item) => item.name === nextProviderName)?.models[0];
                    setSelectedProviders({ ...selectedProviders, [key]: nextProviderName });
                    if (nextModel) setConfig({ ...config, models: { ...config.models, [key]: nextModel } });
                  }} aria-label={`${label} provider`}>
                    {config.catalog.providers.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <select className="range-select rounded-[var(--radius-sm)]" value={config.models[key]} onChange={(event) => setConfig({ ...config, models: { ...config.models, [key]: event.target.value } })} aria-label={`${label} model`}>
                    {options.length === 0 ? <option>No models listed</option> : null}
                    {options.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </div>
              </label>
            );
          })}
        </div>
      </section>
      <section className="panel p-4">
        <div className="eyebrow">Providers</div>
        <h2 className="mt-2 text-lg font-semibold">Named providers</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Store provider names, base URLs, and explicit model strings. No secrets.</p>
        <div className="mt-4 grid gap-3">
          {config.catalog.providers.map((provider, index) => (
            <div key={provider.name} className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 md:grid-cols-[1fr_1.5fr_2fr]">
              <input value={provider.name} onChange={(event) => updateProvider(index, { name: event.target.value })} aria-label="Provider name" className="range-select rounded-[var(--radius-sm)]" />
              <input value={provider.baseUrl} onChange={(event) => updateProvider(index, { baseUrl: event.target.value })} aria-label={`${provider.name} base URL`} className="range-select rounded-[var(--radius-sm)]" />
              <textarea value={provider.models.join("\n")} onChange={(event) => updateProvider(index, { models: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} aria-label={`${provider.name} models`} className="range-select min-h-24 rounded-[var(--radius-sm)]" />
            </div>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving} className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">{saving ? "Saving..." : "Save settings"}</button>
        <button type="button" disabled={saving} onClick={() => void reset()} className="rounded-[var(--radius-sm)] border border-[var(--line)] px-4 py-2 text-sm disabled:opacity-60">Reset defaults</button>
        {message ? <span className="text-sm text-[var(--muted)]">{message}</span> : null}
      </div>
    </form>
  );
}
