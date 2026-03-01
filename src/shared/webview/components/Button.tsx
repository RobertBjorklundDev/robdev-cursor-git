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
  size = "md",
  type = "button",
  variant = "secondary",
  width = "auto",
  ...props
}: ButtonProps) {
  const classes = getClassName([
    "cursor-pointer border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--vscode-focusBorder)",
    getVariantClasses(variant),
    getSizeClasses(size),
    getWidthClasses(width),
    className
  ]);

  return <button className={classes} type={type} {...props} />;
}

export { Button };
