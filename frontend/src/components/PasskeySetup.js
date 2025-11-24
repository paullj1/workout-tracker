import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { registerPasskey, loginWithPasskey } from "../lib/passkeys";
const PasskeySetup = ({ email }) => {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const run = async (fn) => {
        try {
            setBusy(true);
            setMessage(null);
            await fn();
            setMessage("Success! 🎉");
        }
        catch (error) {
            console.error(error);
            setMessage("Something went wrong.");
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Passkey" }), _jsx("p", { children: "Secure your account with a hardware-backed credential." }), _jsxs("div", { style: { display: "flex", gap: "0.5rem" }, children: [_jsx("button", { onClick: () => run(registerPasskey), disabled: busy, children: "Register Passkey" }), _jsx("button", { onClick: () => run(() => loginWithPasskey(email || undefined)), disabled: busy, children: "Log in with Passkey" })] }), message && _jsx("small", { children: message })] }));
};
export default PasskeySetup;
