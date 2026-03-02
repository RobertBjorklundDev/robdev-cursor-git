import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";
type ButtonWidth = "auto" | "full";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: ButtonWidth;
}

function getVariantClasses(variant: ButtonVariant) {
  if (variant === "primary") {
    return "border-(--vscode-button-border,transparent) bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)";
  }
  if (variant === "ghost") {
    return "border-transparent bg-transparent text-(--vscode-foreground) hover:bg-[color-mix(in_srgb,var(--vscode-foreground)_8%,transparent)]";
  }
  return "border-(--vscode-button-border,transparent) bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground,var(--vscode-button-secondaryBackground))";
}

function getSizeClasses(size: ButtonSize) {
  if (size === "sm") {
    return "rounded-md px-2 py-1 text-xs";
  }
  if (size === "lg") {
    return "rounded-lg px-3 py-2.5";
  }
  return "rounded-md px-2.5 py-1.5";
}

function getWidthClasses(width: ButtonWidth) {
  if (width === "full") {
    return "w-full";
  }
  return "";
}

function getClassName(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Button({
  className,
  onBlur,
  onClick,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  size = "md",
  title,
  type = "button",
  variant = "secondary",
  width = "auto",
  ...props
}: ButtonProps) {
  const [isTooltipVisible, setIsTooltipVisible] = React.useState(false);
  const tooltipTimeoutRef = React.useRef<number | null>(null);

  const tooltipText = typeof title === "string" && title.length > 0 ? title : null;

  function clearTooltipTimeout() {
    if (tooltipTimeoutRef.current !== null) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  }

  function scheduleTooltipOpen() {
    if (tooltipText === null) {
      return;
    }
    clearTooltipTimeout();
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setIsTooltipVisible(true);
    }, 150);
  }

  function hideTooltip() {
    clearTooltipTimeout();
    setIsTooltipVisible(false);
  }

  React.useEffect(() => {
    return () => {
      clearTooltipTimeout();
    };
  }, []);

  const classes = getClassName([
    "cursor-pointer border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--vscode-focusBorder)",
    getVariantClasses(variant),
    getSizeClasses(size),
    getWidthClasses(width),
    className
  ]);

  const wrapperClasses = getClassName([
    "relative inline-flex",
    width === "full" ? "w-full" : undefined
  ]);

  const buttonElement = (
    <button
      className={classes}
      type={type}
      onBlur={(event) => {
        hideTooltip();
        if (onBlur) {
          onBlur(event);
        }
      }}
      onFocus={(event) => {
        scheduleTooltipOpen();
        if (onFocus) {
          onFocus(event);
        }
      }}
      onMouseEnter={(event) => {
        if (onMouseEnter) {
          onMouseEnter(event);
        }
      }}
      onMouseLeave={(event) => {
        if (onMouseLeave) {
          onMouseLeave(event);
        }
      }}
      onClick={(event) => {
        hideTooltip();
        if (onClick) {
          onClick(event);
        }
      }}
      {...props}
    />
  );

  if (tooltipText === null) {
    return buttonElement;
  }

  return (
    <span
      className={wrapperClasses}
      onMouseEnter={() => {
        scheduleTooltipOpen();
      }}
      onMouseLeave={() => {
        hideTooltip();
      }}
    >
      {buttonElement}
      {isTooltipVisible ? (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-(--vscode-widget-border,var(--vscode-contrastBorder,transparent)) bg-(--vscode-editorHoverWidget-background,var(--vscode-editor-background)) px-2 py-1 text-[11px] text-(--vscode-editorHoverWidget-foreground,var(--vscode-foreground)) shadow-lg"
          role="tooltip"
        >
          {tooltipText}
        </span>
      ) : null}
    </span>
  );
}

export { Button };
