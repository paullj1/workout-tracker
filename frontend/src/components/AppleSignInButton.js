import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { appleLogin } from "../lib/api";
import { useEncryptionStore } from "../lib/encryption";
const APPLE_SCRIPT_ID = "apple-signin-js";
const AppleSignInButton = ({ onComplete }) => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    const storedToken = useEncryptionStore((state) => state.token);
    const setToken = useEncryptionStore((state) => state.setToken);
    const [localToken, setLocalToken] = useState("");
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!clientId)
            return;
        const initApple = () => {
            if (!window.AppleID)
                return;
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
        }
        catch (err) {
            console.error(err);
            setError("Apple sign-in failed. Try again.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Sign in with Apple" }), _jsx("p", { children: "Use your Apple ID to sign in and sync your workouts." }), needsTokenInput && (_jsx("input", { type: "password", placeholder: "Sync token for this device", value: localToken, onChange: (event) => setLocalToken(event.target.value) })), _jsx("button", { type: "button", onClick: handleAppleLogin, disabled: busy, children: busy ? "Contacting Apple..." : "Continue with Apple" }), error && _jsx("small", { style: { color: "red" }, children: error })] }));
};
export default AppleSignInButton;
