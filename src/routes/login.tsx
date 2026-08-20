import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-[var(--radius-md)] border-2 border-border bg-card p-6 shadow-[4px_4px_0px_var(--color-border)]">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Video Tool // VCR-77
          </p>
          <h1 className="mt-1 text-xl font-medium">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Optional. The player and bench work without an account — sign-in is only for a saved identity.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
        )}
        <Link
          to="/"
          className="block text-center font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
