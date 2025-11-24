import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { registerUser } from "../lib/api";
const RegistrationForm = ({ onComplete }) => {
    const [form, setForm] = useState({
        display_name: "",
        email: "",
        encryption_token: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const handleSubmit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await registerUser(form);
            onComplete(form.encryption_token);
        }
        catch (err) {
            setError("Registration failed");
            console.error(err);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "card", children: [_jsx("h2", { children: "Create an account" }), _jsxs("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: "0.75rem" }, children: [_jsx("input", { placeholder: "Display name", value: form.display_name, onChange: (event) => setForm({ ...form, display_name: event.target.value }) }), _jsx("input", { type: "email", placeholder: "Email (optional)", value: form.email, onChange: (event) => setForm({ ...form, email: event.target.value }) }), _jsx("input", { type: "password", placeholder: "Encryption token", value: form.encryption_token, onChange: (event) => setForm({ ...form, encryption_token: event.target.value }), required: true }), error && _jsx("small", { children: error }), _jsx("button", { type: "submit", disabled: busy, children: busy ? "Creating..." : "Register" })] })] }));
};
export default RegistrationForm;
