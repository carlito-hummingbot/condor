/**
 * "Signed in to Botcamp", for the Bots tab's demo only.
 *
 * The real check — whether this install is linked to Botcamp — is not built on
 * this branch: it would read the link state from the backend (`condor/hub.py`)
 * and needs a Botcamp session. Until then one small flag stands in for it, so
 * the walkthrough can show both states without a network call, a token or a
 * credential anywhere. Replacing these two functions with the real check is the
 * whole change when it lands.
 */

import { BOTCAMP_SIGNED_IN_KEY } from "@/lib/sessionState";

export function readBotcampSignedIn(): boolean {
  try {
    return globalThis.localStorage?.getItem(BOTCAMP_SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeBotcampSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) globalThis.localStorage?.setItem(BOTCAMP_SIGNED_IN_KEY, "1");
    else globalThis.localStorage?.removeItem(BOTCAMP_SIGNED_IN_KEY);
  } catch {
    // A browser with storage turned off still gets a working switch this visit.
  }
}
