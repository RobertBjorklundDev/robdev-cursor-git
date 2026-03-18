import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { isVSCodeWebview } from "../env";

interface AuthState {
  accessToken: string | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: string | undefined;
}

interface AuthContextValue extends AuthState {
  startDeviceFlow: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_STORAGE_KEY = "rd-git-github-token";
const LOGIN_STORAGE_KEY = "rd-git-github-login";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function AuthProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (isVSCodeWebview()) {
      return { accessToken: undefined, isAuthenticated: false, isLoading: true, login: undefined };
    }
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedLogin = localStorage.getItem(LOGIN_STORAGE_KEY);
    return {
      accessToken: storedToken ?? undefined,
      isAuthenticated: !!storedToken,
      isLoading: false,
      login: storedLogin ?? undefined,
    };
  });

  const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | undefined>();

  useEffect(() => {
    if (isVSCodeWebview()) {
      function handleMessage(event: MessageEvent) {
        const message = event.data;
        if (message?.type === "setAuthToken" && typeof message.accessToken === "string") {
          setState({
            accessToken: message.accessToken,
            isAuthenticated: true,
            isLoading: false,
            login: message.login ?? undefined,
          });
        }
      }
      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    }
  }, []);

  const startDeviceFlow = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const codeResponse = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ client_id: clientId, scope: "repo read:user" }),
      });
      const codeData = (await codeResponse.json()) as DeviceCodeResponse;
      setDeviceCode({ userCode: codeData.user_code, verificationUri: codeData.verification_uri });
      window.open(codeData.verification_uri, "_blank");

      const intervalMs = (codeData.interval || 5) * 1000;
      const expiresAt = Date.now() + codeData.expires_in * 1000;

      const pollForToken = async () => {
        while (Date.now() < expiresAt) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
          const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: clientId,
              device_code: codeData.device_code,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
          });
          const tokenData = (await tokenResponse.json()) as TokenResponse;

          if (tokenData.access_token) {
            localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
            const loginResponse = await fetch("https://api.github.com/user", {
              headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const userData = (await loginResponse.json()) as { login?: string };
            const login = userData.login ?? undefined;
            if (login) {
              localStorage.setItem(LOGIN_STORAGE_KEY, login);
            }
            setState({
              accessToken: tokenData.access_token,
              isAuthenticated: true,
              isLoading: false,
              login,
            });
            setDeviceCode(undefined);
            return;
          }

          if (tokenData.error === "expired_token" || tokenData.error === "access_denied") {
            break;
          }
        }
        setState((prev) => ({ ...prev, isLoading: false }));
        setDeviceCode(undefined);
      };

      void pollForToken();
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [clientId]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(LOGIN_STORAGE_KEY);
    setState({ accessToken: undefined, isAuthenticated: false, isLoading: false, login: undefined });
  }, []);

  const value: AuthContextValue = {
    ...state,
    startDeviceFlow,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {deviceCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface rounded-lg border border-border p-8 text-center max-w-md">
            <h2 className="text-lg font-semibold text-text mb-4">Sign in to GitHub</h2>
            <p className="text-text-muted mb-4">
              Enter this code at{" "}
              <a
                href={deviceCode.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                github.com/login/device
              </a>
            </p>
            <div className="font-mono text-2xl tracking-widest text-text bg-surface-raised px-6 py-3 rounded border border-border-muted">
              {deviceCode.userCode}
            </div>
            <p className="text-text-subtle text-sm mt-4">Waiting for authorization...</p>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };
