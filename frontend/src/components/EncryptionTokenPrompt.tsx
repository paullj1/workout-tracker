import { FormEvent, useState } from "react";

type Props = {
  onSave: (token: string) => void;
};

const EncryptionTokenPrompt = ({ onSave }: Props) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    onSave(value.trim());
    setValue("");
  };

  return (
    <div className="card">
      <h2>Unlock Your Vault</h2>
      <p>Enter the encryption token derived from your passkey to decrypt workouts.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem" }}>
        <input
          type="password"
          placeholder="Paste encryption token"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ flex: 1, padding: "0.65rem", borderRadius: 8, border: "1px solid var(--input-border)" }}
        />
        <button type="submit">Unlock</button>
      </form>
    </div>
  );
};

export default EncryptionTokenPrompt;
