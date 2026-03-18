import { useAuth } from "./AuthContext";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, startDeviceFlow } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-muted">Connecting to GitHub...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-surface rounded-lg border border-border p-8 text-center max-w-md">
          <h1 className="text-xl font-semibold text-text mb-2">RDgit Dashboard</h1>
          <p className="text-text-muted mb-6">
            Sign in with GitHub to view pull requests, issues, and review status.
          </p>
          <button
            type="button"
            onClick={() => void startDeviceFlow()}
            className="bg-accent-emphasis text-white px-6 py-2 rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Sign in with GitHub
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export { AuthGate };
