import React from "react";

type CardPadding = "none" | "sm" | "md";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

function getCardPaddingClasses(padding: CardPadding) {
  if (padding === "none") {
    return "";
  }
  if (padding === "sm") {
    return "p-2";
  }
  return "p-3";
}

function getClassName(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padding = "md", ...props },
  ref,
) {
  const classes = getClassName([
    "rounded-lg border border-(--vscode-panel-border) bg-(--vscode-editor-background)",
    getCardPaddingClasses(padding),
    className,
  ]);

  return <div className={classes} ref={ref} {...props} />;
});
