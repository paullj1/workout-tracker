import { useState } from "react";
import { registerPasskey, loginWithPasskey } from "../lib/passkeys";

type Props = {
  email?: string | null;
};

const PasskeySetup = ({ email }: Props) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setBusy(true);
      setMessage(null);
      await fn();
      setMessage("Success! 🎉");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Passkey</h2>
      <p>Secure your account with a hardware-backed credential.</p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => run(registerPasskey)} disabled={busy}>
          Register Passkey
        </button>
        <button onClick={() => run(() => loginWithPasskey(email || undefined))} disabled={busy}>
          Log in with Passkey
        </button>
      </div>
      {message && <small>{message}</small>}
    </div>
  );
};

export default PasskeySetup;
