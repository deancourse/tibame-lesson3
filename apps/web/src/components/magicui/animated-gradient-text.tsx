import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedGradientText({
  children,
  className,
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn(
        "inline-block animate-shimmer bg-size-[200%_auto] bg-clip-text text-transparent",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, hsl(var(--brand-from)), hsl(var(--brand-accent)), hsl(var(--brand-to)), hsl(var(--brand-from)))",
      }}
    >
      {children}
    </span>
  );
}
