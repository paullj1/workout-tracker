import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
const EncryptionTokenPrompt = ({ onSave }) => {
    const [value, setValue] = useState("");
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!value)
            return;
        onSave(value.trim());
        setValue("");
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Unlock Your Vault" }), _jsx("p", { children: "Enter the encryption token derived from your passkey to decrypt workouts." }), _jsxs("form", { onSubmit: handleSubmit, style: { display: "flex", gap: "0.75rem" }, children: [_jsx("input", { type: "password", placeholder: "Paste encryption token", value: value, onChange: (event) => setValue(event.target.value), style: { flex: 1, padding: "0.65rem", borderRadius: 8, border: "1px solid var(--input-border)" } }), _jsx("button", { type: "submit", children: "Unlock" })] })] }));
};
export default EncryptionTokenPrompt;
