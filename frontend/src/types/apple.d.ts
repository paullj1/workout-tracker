export {};

declare global {
  interface AppleSignInName {
    firstName?: string;
    lastName?: string;
  }

  interface AppleUserInfo {
    name?: AppleSignInName;
  }

  interface AppleAuthorization {
    code?: string;
    id_token?: string;
  }

  interface AppleSignInResponse {
    authorization?: AppleAuthorization;
    user?: AppleUserInfo;
  }

  interface AppleIDAuth {
    init(config: {
      clientId: string;
      scope: string;
      redirectURI: string;
      usePopup?: boolean;
    }): void;
    signIn(): Promise<AppleSignInResponse>;
  }

  interface AppleID {
    auth: AppleIDAuth;
  }

  interface Window {
    AppleID?: AppleID;
  }
}
