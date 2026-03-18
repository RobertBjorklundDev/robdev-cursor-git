import React from "react";
import { cn } from "./cn";

interface ListStateMessageProps {
  children: React.ReactNode;
  className?: string;
}

function ListStateMessage({ children, className }: ListStateMessageProps) {
  return (
    <div className={cn("px-1 py-2 text-[11px] text-muted-foreground", className)}>
      {children}
    </div>
  );
}

export { ListStateMessage };
