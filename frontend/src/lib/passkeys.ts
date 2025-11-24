import { api } from "./api";

const bufferDecode = (value: string) =>
  Uint8Array.from(window.atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const bufferEncode = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value);
  let str = "";
  bytes.forEach((charCode) => {
    str += String.fromCharCode(charCode);
  });
  return window
    .btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const prepCreation = (options: any) => {
  options.challenge = bufferDecode(options.challenge);
  options.user.id = bufferDecode(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
      ...cred,
      id: bufferDecode(cred.id),
    }));
  }
  return options;
};

const prepRequest = (options: any) => {
  options.challenge = bufferDecode(options.challenge);
  if (options.allowCredentials) {
    options.allowCredentials = options.allowCredentials.map((cred: any) => ({
      ...cred,
      id: bufferDecode(cred.id),
    }));
  }
  return options;
};

const harvestCredential = (cred: PublicKeyCredential) => {
  const response = cred.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  return {
    id: cred.id,
    rawId: bufferEncode(cred.rawId),
    type: cred.type,
    clientExtensionResults: cred.getClientExtensionResults(),
    response: {
      attestationObject: response.attestationObject
        ? bufferEncode(response.attestationObject)
        : undefined,
      authenticatorData: response.authenticatorData ? bufferEncode(response.authenticatorData) : undefined,
      clientDataJSON: bufferEncode(response.clientDataJSON),
      signature: response.signature ? bufferEncode(response.signature) : undefined,
      userHandle: response.userHandle ? bufferEncode(response.userHandle) : undefined,
    },
  };
};

type PasskeyRegisterResponse = {
  options: PublicKeyCredentialCreationOptions;
};

export const registerPasskey = async () => {
  const { data } = await api.post<PasskeyRegisterResponse>("/auth/passkey/register/begin");
  const request = prepCreation(data.options);
  const credential = (await navigator.credentials.create({ publicKey: request })) as PublicKeyCredential;
  await api.post("/auth/passkey/register/complete", harvestCredential(credential));
};

export const loginWithPasskey = async (email?: string) => {
  const { data: options } = await api.post("/auth/passkey/login/begin", email ? { email } : {});
  const assertion = prepRequest(options);
  const credential = (await navigator.credentials.get({ publicKey: assertion })) as PublicKeyCredential;
  const payload = harvestCredential(credential);
  await api.post("/auth/passkey/login/complete", payload);
};

export const logout = async () => api.post("/auth/logout");
