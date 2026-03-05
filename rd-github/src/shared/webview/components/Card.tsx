import React from "react";
import { cn } from "./cn";

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

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padding = "md", ...props },
  ref
) {
  const classes = cn(
    "rounded-lg border border-border/70 bg-card/90 text-card-foreground",
    getCardPaddingClasses(padding),
    className
  );

  return <div className={classes} ref={ref} {...props} />;
});

export { Card };
