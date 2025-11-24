import { useEffect, useState } from "react";
import { appleLogin } from "../lib/api";
import { useEncryptionStore } from "../lib/encryption";

type Props = {
  onComplete: () => void;
};

const APPLE_SCRIPT_ID = "apple-signin-js";

const AppleSignInButton = ({ onComplete }: Props) => {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
  const storedToken = useEncryptionStore((state) => state.token);
  const setToken = useEncryptionStore((state) => state.setToken);
  const [localToken, setLocalToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const initApple = () => {
      if (!window.AppleID) return;
      window.AppleID.auth.init({
        clientId,
        scope: "name email",
        redirectURI: window.location.origin,
        usePopup: true,
      });
    };

    if (window.AppleID) {
      initApple();
      return;
    }
    if (document.getElementById(APPLE_SCRIPT_ID)) {
      return;
    }
    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.id = APPLE_SCRIPT_ID;
    script.onload = initApple;
    document.body.appendChild(script);
  }, [clientId]);

  if (!clientId) {
    return null;
  }

  const needsTokenInput = !storedToken;
  const effectiveToken = storedToken || localToken;

  const handleAppleLogin = async () => {
    if (!window.AppleID) {
      setError("Apple sign-in is unavailable right now.");
      return;
    }
    if (!effectiveToken) {
      setError("Provide a sync token first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await window.AppleID.auth.signIn();
      const code = response?.authorization?.code;
      if (!code) {
        throw new Error("Missing authorization code");
      }
      await appleLogin({
        authorization_code: code,
        encryption_token: effectiveToken,
        display_name: response?.user?.name
          ? `${response.user.name.firstName ?? ""} ${response.user.name.lastName ?? ""}`.trim() || undefined
          : undefined,
      });
      if (!storedToken) {
        setToken(effectiveToken);
      }
      onComplete();
    } catch (err) {
      console.error(err);
      setError("Apple sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Sign in with Apple</h2>
      <p>Use your Apple ID to sign in and sync your workouts.</p>
      {needsTokenInput && (
        <input
          type="password"
          placeholder="Sync token for this device"
          value={localToken}
          onChange={(event) => setLocalToken(event.target.value)}
        />
      )}
      <button type="button" onClick={handleAppleLogin} disabled={busy}>
        {busy ? "Contacting Apple..." : "Continue with Apple"}
      </button>
      {error && <small style={{ color: "red" }}>{error}</small>}
    </div>
  );
};

export default AppleSignInButton;
