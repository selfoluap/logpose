import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LogposeConfig, ProviderConfig } from "../types";

const mappings = [
  ["refine", "Refine"],
  ["plan", "Plan"],
  ["review", "Review"],
  ["0", "Complexity 0"],
  ["1", "Complexity 1"],
  ["2", "Complexity 2"],
  ["3", "Complexity 3"],
  ["4", "Complexity 4"],
  ["5", "Complexity 5"]
] as const;

function providerFor(model: string, providers: ProviderConfig[]) {
  return providers.find((provider) => provider.models.includes(model))?.name ?? providers[0]?.name ?? "";
}

export function SettingsPage() {
  const [config, setConfig] = useState<LogposeConfig | null>(null);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    api.config()
      .then((next) => {
        setConfig(next);
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Failed to load settings"));
  }, []);

  if (!config) return <div className="panel p-4 text-sm">{message}</div>;

  function updateProvider(index: number, patch: Partial<ProviderConfig>) {
    setConfig((current) => current && { ...current, providers: current.providers.map((provider, i) => i === index ? { ...provider, ...patch } : provider) });
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
      setMessage("Settings reset.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to reset settings");
    } finally {
      setSaving(false);
    }
  }

  async function refreshModels(index: number) {
    const provider = config!.providers[index];
    setLoadingProvider(provider.name);
    setMessage(`Loading models from ${provider.name}...`);
    try {
      const models = await api.providerModels(provider.baseUrl);
      updateProvider(index, { models });
      setMessage(`Loaded ${models.length} models from ${provider.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load provider models");
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <section className="panel p-4">
        <div className="eyebrow">Configuration</div>
        <h2 className="mt-2 text-lg font-semibold">Model mappings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mappings.map(([key, label]) => {
            const providerName = providerFor(config.models[key], config.providers);
            const provider = config.providers.find((item) => item.name === providerName) ?? config.providers[0];
            return (
              <label key={key} className="grid gap-2 text-sm">
                <span className="text-[var(--muted)]">{label}</span>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2">
                  <select className="range-select rounded-[var(--radius-sm)]" value={providerName} onChange={(event) => setConfig({ ...config, models: { ...config.models, [key]: config.providers.find((item) => item.name === event.target.value)?.models[0] ?? "" } })} aria-label={`${label} provider`}>
                    {config.providers.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <select className="range-select rounded-[var(--radius-sm)]" value={config.models[key]} onChange={(event) => setConfig({ ...config, models: { ...config.models, [key]: event.target.value } })} aria-label={`${label} model`}>
                    {(provider?.models ?? []).map((model) => <option key={model} value={model}>{model}</option>)}
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
        <p className="mt-2 text-sm text-[var(--muted)]">Store base URLs and model names only. Secrets stay out of Logpose config.</p>
        <div className="mt-4 grid gap-3">
          {config.providers.map((provider, index) => (
            <div key={provider.name} className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 md:grid-cols-[1fr_1.5fr_2fr_auto]">
              <input value={provider.name} onChange={(event) => updateProvider(index, { name: event.target.value })} aria-label="Provider name" className="range-select rounded-[var(--radius-sm)]" />
              <input value={provider.baseUrl} onChange={(event) => updateProvider(index, { baseUrl: event.target.value })} aria-label={`${provider.name} base URL`} className="range-select rounded-[var(--radius-sm)]" />
              <input value={provider.models.join(", ")} onChange={(event) => updateProvider(index, { models: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} aria-label={`${provider.name} models`} className="range-select rounded-[var(--radius-sm)]" />
              <button type="button" disabled={loadingProvider === provider.name || saving} onClick={() => void refreshModels(index)} className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-60">{loadingProvider === provider.name ? "Loading..." : "Load"}</button>
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
