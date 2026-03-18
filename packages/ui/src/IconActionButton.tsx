import React from "react";
import { Button } from "./Button";
import { cn } from "./cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

interface IconActionButtonProps {
  label: string;
  disabled?: boolean;
  buttonClassName?: string;
  onClick?(): void;
  children: React.ReactNode;
}

function IconActionButton({
  children,
  disabled,
  label,
  buttonClassName,
  onClick
}: IconActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            aria-label={label}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center p-0",
              buttonClassName
            )}
            disabled={disabled}
            size="sm"
            variant="secondary"
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { IconActionButton };
