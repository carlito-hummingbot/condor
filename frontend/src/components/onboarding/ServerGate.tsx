import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useServer } from "@/hooks/useServer";
import { api } from "@/lib/api";
import type { ServerGate as ServerGateState } from "@/lib/onboarding";

/**
 * Shown only when setup did not already leave a server selected. Not a dot:
 * the check is hidden once a server is confirmed.
 */
export function ServerGate({
  gate,
  onPicked,
}: {
  gate: Exclude<ServerGateState, { phase: "ready" }> | { phase: "error" };
  onPicked: (name: string) => void;
}) {
  if (gate.phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-[var(--color-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Checking this install…</p>
      </div>
    );
  }

  if (gate.phase === "pick") {
    return (
      <div>
        <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
          Pick a server
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
          These servers are configured, and none of them is online right now. Pick the one you trade on.
        </p>
        <ul className="mt-4 space-y-2">
          {gate.servers.map((server) => (
            <li key={server.name}>
              <Button variant="secondary" className="w-full justify-start" onClick={() => onPicked(server.name)}>
                {server.name}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">Offline</span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return <AddServer onAdded={onPicked} failed={gate.phase === "error"} />;
}

function AddServer({ onAdded, failed }: { onAdded: (name: string) => void; failed: boolean }) {
  const qc = useQueryClient();
  const { setServer } = useServer();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8000");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const add = useMutation({
    mutationFn: api.addServer,
    onSuccess: (_data, body) => {
      qc.invalidateQueries({ queryKey: ["servers"] });
      qc.invalidateQueries({ queryKey: ["settings-servers"] });
      setServer(body.name);
      onAdded(body.name);
    },
  });

  const portNumber = Number(port);
  const canSave =
    name.trim() !== "" &&
    host.trim() !== "" &&
    username.trim() !== "" &&
    password !== "" &&
    Number.isInteger(portNumber) &&
    portNumber > 0;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave || add.isPending) return;
        add.mutate({
          name: name.trim(),
          host: host.trim(),
          port: portNumber,
          username: username.trim(),
          password,
        });
      }}
    >
      <h2 id="onboarding-title" className="text-xl font-bold text-[var(--color-text)]">
        Connect a server
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">
        {failed
          ? "The server list could not be read. Add the Hummingbot API this dashboard should use, or skip setup and try again from Settings."
          : "No Hummingbot API server is configured yet. Add the one this dashboard should trade through."}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Name" htmlFor="onboarding-server-name">
          <Input
            id="onboarding-server-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="my-server"
            autoFocus
          />
        </Field>
        <Field label="Host" htmlFor="onboarding-server-host">
          <Input
            id="onboarding-server-host"
            value={host}
            onChange={(event) => setHost(event.target.value)}
            placeholder="localhost"
          />
        </Field>
        <Field label="Port" htmlFor="onboarding-server-port">
          <Input
            id="onboarding-server-port"
            inputMode="numeric"
            value={port}
            onChange={(event) => setPort(event.target.value)}
          />
        </Field>
        <Field label="Username" htmlFor="onboarding-server-user">
          <Input
            id="onboarding-server-user"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="admin"
            autoComplete="off"
          />
        </Field>
        <Field label="Password" htmlFor="onboarding-server-password">
          <Input
            id="onboarding-server-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
      {add.isError && (
        <p className="mt-3 text-xs text-[var(--color-red)]">
          {add.error instanceof Error ? add.error.message : "Could not add that server."}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="primary" disabled={!canSave || add.isPending}>
          {add.isPending ? "Saving…" : "Save server"}
        </Button>
      </div>
    </form>
  );
}
