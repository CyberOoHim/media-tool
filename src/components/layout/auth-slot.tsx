import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return <div className="h-8 w-24 animate-pulse rounded-full bg-secondary" />;
  }

  if (user) return <UserButton />;

  return (
    <Link
      to="/login"
      className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
    >
      Sign in
    </Link>
  );
}
