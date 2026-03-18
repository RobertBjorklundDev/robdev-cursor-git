import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-border bg-muted/70 text-foreground hover:bg-muted",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        sm: "h-8 rounded-md px-2 text-xs",
        md: "h-9 rounded-md px-2.5 py-1.5",
        lg: "h-10 rounded-lg px-3 py-2.5"
      },
      width: {
        auto: "",
        full: "w-full"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
      width: "auto"
    }
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ asChild = false, className, size, type = "button", variant, width, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, width }), className)}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}

export { Button, buttonVariants };
