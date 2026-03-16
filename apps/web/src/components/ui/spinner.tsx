import { SpinnerGap } from "@phosphor-icons/react";
import type React from "react";
import { cn } from "@/lib/utils";

export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof SpinnerGap>): React.ReactElement {
  return (
    <SpinnerGap
      weight="thin"
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
