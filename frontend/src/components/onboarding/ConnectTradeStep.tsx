import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConnectHyperliquid } from "@/components/settings/ConnectHyperliquid";
import { ImportGatewayWallet, type WalletChain } from "@/components/settings/ImportGatewayWallet";
import { Button } from "@/components/ui/Button";
import { useCredentials } from "@/hooks/useCredentials";
import { useServer } from "@/hooks/useServer";
import { OWNER_ONLY_HINT, useServerPermission } from "@/hooks/useServerPermission";
import { api } from "@/lib/api";
import { CREDENTIAL_FIELD_PATTERNS } from "@/lib/credential-fields";
import { credentialsQuery, gatewayWalletsQuery, invalidateCredentialQueries } from "@/lib/queryClient";
import type { PreferencePatch } from "@/lib/onboarding";

import type { WizardAction } from "./MakeItYoursStep";

type Pane = "tiles" | "type" | "exchange" | "fields" | "hyperliquid" | "wallet";

/**
 * Exchange key, Hyperliquid, or a Gateway wallet. Same endpoints and the same
 * Hyperliquid and wallet components as Settings. Skip leaves trading locked
 * behind the reminder banner.
 */
export function ConnectTradeStep({
  busy,
  onContinue,
  onBind,
}: {
  busy: boolean;
  onContinue: (patch: PreferencePatch) => void;
  onBind: (action: WizardAction | null) => void;
}) {
  const { server } = useServer();
  const { isOwner } = useServerPermission();
  const { hasKeys } = useCredentials();
  const qc = useQueryClient();
  const [pane, setPane] = useState<Pane>("tiles");
  const [connectorType, setConnectorType] = useState("");
  const [connectorName, setConnectorName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [chain, setChain] = useState<WalletChain>("ethereum");
  const [notice, setNotice] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const continueRef = useRef(onContinue);
  useEffect(() => {
    continueRef.current = onContinue;
  }, [onContinue]);

  const ready = hasKeys || linked;

  useEffect(() => {
    onBind({
      label: "Next",
      disabled: busy || !ready,
      run: () => continueRef.current({}),
    });
    return () => onBind(null);
  }, [busy, onBind, ready]);

  const connectors = useQuery({
    queryKey: ["settings-connectors", server, connectorType],
    queryFn: () => api.getAvailableConnectors(server!, connectorType),
    enabled: !!server && pane === "exchange" && !!connectorType,
  });
  const configMap = useQuery({
    queryKey: ["connector-config-map", server, connectorName],
    queryFn: () => api.getConnectorConfigMap(server!, connectorName),
    enabled: !!server && pane === "fields" && !!connectorName,
  });
  const gateway = useQuery({
    queryKey: ["gateway-status", server],
    queryFn: () => api.getGatewayStatus(server!),
    enabled: !!server && (pane === "wallet" || pane === "tiles"),
    retry: false,
  });

  const fields = useMemo(() => {
    const map = configMap.data?.config_map ?? {};
    return Object.entries(map).map(([key, val]) => {
      const row = (val ?? {}) as Record<string, unknown>;
      const required = row.required !== false;
      const prompt = String(row.prompt || row.description || "").trim();
      const haystack = `${key} ${row.type ?? ""}`.toLowerCase();
      return {
        key,
        required,
        prompt: required ? prompt : prompt.replace(/\s*\(optional\)\s*$/i, ""),
        secret: CREDENTIAL_FIELD_PATTERNS.some((pattern) => haystack.includes(pattern)),
      };
    });
  }, [configMap.data]);

  const addKey = useMutation({
    mutationFn: () =>
      api.addCredential(server!, { connector_name: connectorName, credentials: values }),
    onSuccess: (res) => {
      invalidateCredentialQueries(qc, server);
      setLinked(true);
      setNotice(
        res.restart_required
          ? `Saved ${connectorName}. Restart running bots before they pick it up.`
          : `Saved ${connectorName}.`,
      );
      setPane("tiles");
      setValues({});
    },
  });

  const startGateway = useMutation({
    mutationFn: () => api.startGateway(server!, { image: "hummingbot/gateway:latest" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gateway-status", server] });
    },
  });

  const linkedNote = () => {
    qc.invalidateQueries({ queryKey: credentialsQuery(server).queryKey });
    qc.invalidateQueries({ queryKey: gatewayWalletsQuery(server).queryKey });
    setLinked(true);
    setPane("tiles");
  };

  if (!isOwner) {
    return (
      <div>
        <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
          Connect where you trade
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{OWNER_ONLY_HINT}</p>
      </div>
    );
  }

  if (pane === "hyperliquid" && server) {
    return (
      <ConnectHyperliquid
        server={server}
        onBack={() => setPane("tiles")}
        onDone={linkedNote}
      />
    );
  }

  if (pane === "wallet" && server) {
    const running = gateway.data?.running === true;
    return (
      <div>
        <Back onClick={() => setPane("tiles")} />
        <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
          DEX wallet
        </h2>
        {!running ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--color-text-muted)]">
              Gateway signs DEX transactions. It is not running on {server}.
            </p>
            <Button
              className="mt-3"
              variant="primary"
              disabled={startGateway.isPending}
              onClick={() => startGateway.mutate()}
            >
              {startGateway.isPending ? "Starting…" : "Start Gateway"}
            </Button>
            {startGateway.isError && (
              <p className="mt-2 text-xs text-[var(--color-red)]">
                {startGateway.error instanceof Error ? startGateway.error.message : "Could not start Gateway."}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1">
              {(["ethereum", "solana"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setChain(item)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                    chain === item
                      ? "bg-[var(--color-primary-fill)]/15 text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {item === "ethereum" ? "Ethereum" : "Solana"}
                </button>
              ))}
            </div>
            <ImportGatewayWallet
              key={chain}
              server={server}
              chain={chain}
              onBack={() => setPane("tiles")}
              onDone={linkedNote}
            />
          </div>
        )}
      </div>
    );
  }

  if (pane === "type") {
    return (
      <div>
        <Back onClick={() => setPane("tiles")} />
        <h2 id="onboarding-title" className="mt-2 text-xl font-bold text-[var(--color-text)]">
          Exchange API key
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {["spot", "perpetual"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setConnectorType(type);
                setPane("exchange");
              }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-left hover:border-[var(--color-border-hover)]"
            >
              <span className="text-sm font-medium capitalize text-[var(--color-text)]">{type}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (pane === "exchange") {
    const list = [...(connectors.data?.connectors ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return (
      <div>
        <Back onClick={() => setPane("type")} />
        <h2 id="onboarding-title" className="mt-2 text-xl font-bold text-[var(--color-text)]">
          Choose an exchange
        </h2>
        {connectors.isLoading ? (
          <Loader2 className="mt-4 h-4 w-4 animate-spin text-[var(--color-text-muted)]" />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {list.map((connector) => (
              <button
                key={connector.name}
                type="button"
                onClick={() => {
                  setConnectorName(connector.name);
                  setValues({});
                  setPane(connector.name.startsWith("hyperliquid") ? "hyperliquid" : "fields");
                }}
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (pane === "fields") {
    return (
      <div>
        <Back onClick={() => setPane("exchange")} />
        <h2 id="onboarding-title" className="mt-2 text-xl font-bold text-[var(--color-text)]">
          {connectorName}
        </h2>
        <div className="mt-3 space-y-3">
          {fields.map((field) => (
            <label key={field.key} className="block text-xs font-medium text-[var(--color-text)]">
              {field.key}
              {field.required ? " *" : ""}
              {field.prompt && (
                <span className="mt-0.5 block font-normal text-[var(--color-text-muted)]">{field.prompt}</span>
              )}
              <input
                type={field.secret ? "password" : "text"}
                autoComplete={field.secret ? "new-password" : "off"}
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                className="mt-1 h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm"
              />
            </label>
          ))}
          <Button variant="primary" disabled={addKey.isPending} onClick={() => addKey.mutate()}>
            {addKey.isPending ? "Saving…" : "Save key"}
          </Button>
          {addKey.isError && (
            <p className="text-xs text-[var(--color-red)]">
              {addKey.error instanceof Error ? addKey.error.message : "Could not save that key."}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Connect where you trade
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        Add an exchange key, Hyperliquid, or a DEX wallet. You can add more than one. Skip leaves
        portfolio and trading locked behind a reminder.
      </p>
      {ready && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">A key or wallet is connected.</p>
      )}
      {notice && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{notice}</p>}
      <div className="mt-4 grid grid-cols-1 gap-2">
        <Tile icon={KeyRound} title="Exchange API key" body="Spot or perpetual" onClick={() => setPane("type")} />
        <Tile
          icon={Wallet}
          title="Hyperliquid"
          body="Connect a wallet"
          onClick={() => setPane("hyperliquid")}
        />
        <Tile icon={Wallet} title="DEX wallet" body="Solana or Ethereum via Gateway" onClick={() => setPane("wallet")} />
      </div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

function Tile({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: typeof KeyRound;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3 text-left hover:bg-[var(--color-surface-hover)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
      <span>
        <span className="block text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="block text-xs text-[var(--color-text-muted)]">{body}</span>
      </span>
    </button>
  );
}
