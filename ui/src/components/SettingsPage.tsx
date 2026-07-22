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

type ProviderModels = Record<string, { models: string[]; loading: boolean; error?: string }>;

function providerFor(model: string, providers: ProviderConfig[], providerModels: ProviderModels) {
  return providers.find((provider) => providerModels[provider.name]?.models.includes(model))?.name
    ?? providers.find((provider) => model.startsWith(`${provider.name}/`))?.name
    ?? providers[0]?.name
    ?? "";
}

export function SettingsPage() {
  const [config, setConfig] = useState<LogposeConfig | null>(null);
  const [message, setMessage] = useState("Loading settings...");
  const [saving, setSaving] = useState(false);
  const [providerModels, setProviderModels] = useState<ProviderModels>({});
  const [selectedProviders, setSelectedProviders] = useState<Record<string, string>>({});

  useEffect(() => {
    api.config()
      .then((next) => {
        setConfig(next);
        setMessage("");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Failed to load settings"));
  }, []);

  const providerKey = config?.providers.map((provider) => `${provider.name}:${provider.baseUrl}`).join("|") ?? "";

  useEffect(() => {
    if (!config) return;
    config.providers.forEach((provider) => { void refreshProviderModels(provider); });
  }, [providerKey]);

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
      setSelectedProviders({});
      setMessage("Settings reset.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to reset settings");
    } finally {
      setSaving(false);
    }
  }

  async function refreshProviderModels(provider: ProviderConfig) {
    setProviderModels((current) => ({ ...current, [provider.name]: { models: current[provider.name]?.models ?? [], loading: true } }));
    setMessage(`Loading models from ${provider.name}...`);
    try {
      const models = await api.providerModels(provider.baseUrl);
      setProviderModels((current) => ({ ...current, [provider.name]: { models, loading: false } }));
      setMessage(models.length ? `Loaded ${models.length} models from ${provider.name}.` : `No models found for ${provider.name}.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load provider models";
      setProviderModels((current) => ({ ...current, [provider.name]: { models: current[provider.name]?.models ?? [], loading: false, error: errorMessage } }));
      setMessage(errorMessage);
    }
  }

  function optionsFor(providerName: string, currentModel: string) {
    const models = providerModels[providerName]?.models ?? [];
    return currentModel && !models.includes(currentModel) ? [currentModel, ...models] : models;
  }

  return (
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <section className="panel p-4">
        <div className="eyebrow">Configuration</div>
        <h2 className="mt-2 text-lg font-semibold">Model mappings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {mappings.map(([key, label]) => {
            const providerName = selectedProviders[key] ?? providerFor(config.models[key], config.providers, providerModels);
            const provider = config.providers.find((item) => item.name === providerName) ?? config.providers[0];
            const providerState = providerModels[providerName];
            const options = optionsFor(providerName, config.models[key]);
            return (
              <label key={key} className="grid gap-2 text-sm">
                <span className="text-[var(--muted)]">{label}</span>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-2">
                  <select className="range-select rounded-[var(--radius-sm)]" value={providerName} onChange={(event) => {
                    const nextProviderName = event.target.value;
                    const nextProvider = config.providers.find((item) => item.name === nextProviderName);
                    const nextModel = providerModels[nextProviderName]?.models[0];
                    setSelectedProviders({ ...selectedProviders, [key]: nextProviderName });
                    if (nextModel) setConfig({ ...config, models: { ...config.models, [key]: nextModel } });
                    if (nextProvider) void refreshProviderModels(nextProvider);
                  }} aria-label={`${label} provider`}>
                    {config.providers.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                  <select className="range-select rounded-[var(--radius-sm)]" value={config.models[key]} onChange={(event) => setConfig({ ...config, models: { ...config.models, [key]: event.target.value } })} aria-label={`${label} model`} disabled={providerState?.loading && options.length === 0}>
                    {providerState?.loading && options.length === 0 ? <option>Loading...</option> : null}
                    {!providerState?.loading && options.length === 0 ? <option>No models found</option> : null}
                    {options.map((model) => <option key={model} value={model}>{model}</option>)}
                  </select>
                </div>
                {providerState?.error ? <span className="text-xs text-[var(--muted)]">{providerState.error}</span> : null}
              </label>
            );
          })}
        </div>
      </section>
      <section className="panel p-4">
        <div className="eyebrow">Providers</div>
        <h2 className="mt-2 text-lg font-semibold">Named providers</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Store provider names and base URLs only. Secrets and cached model lists stay out of Logpose config.</p>
        <div className="mt-4 grid gap-3">
          {config.providers.map((provider, index) => (
            <div key={provider.name} className="grid gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] p-3 md:grid-cols-[1fr_1.5fr_auto]">
              <input value={provider.name} onChange={(event) => updateProvider(index, { name: event.target.value })} aria-label="Provider name" className="range-select rounded-[var(--radius-sm)]" />
              <input value={provider.baseUrl} onChange={(event) => updateProvider(index, { baseUrl: event.target.value })} aria-label={`${provider.name} base URL`} className="range-select rounded-[var(--radius-sm)]" />
              <button type="button" disabled={providerModels[provider.name]?.loading || saving} onClick={() => void refreshProviderModels(provider)} className="rounded-[var(--radius-sm)] border border-[var(--line)] px-3 py-2 text-sm disabled:opacity-60">{providerModels[provider.name]?.loading ? "Loading..." : "Reload models"}</button>
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
