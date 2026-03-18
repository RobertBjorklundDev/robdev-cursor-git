import { AuthProvider } from "./auth/AuthContext";
import { AuthGate } from "./auth/AuthGate";
import { Dashboard } from "./dashboard/Dashboard";

const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? "";

function App() {
  return (
    <AuthProvider clientId={GITHUB_CLIENT_ID}>
      <AuthGate>
        <Dashboard />
      </AuthGate>
    </AuthProvider>
  );
}

export { App };
