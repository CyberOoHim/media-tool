import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/lib/theme";

function Toaster(props: ToasterProps) {
  const theme = useTheme((s) => s.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast font-mono text-sm border-2 border-border bg-card text-foreground shadow-[3px_3px_0px_var(--color-border)]",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
