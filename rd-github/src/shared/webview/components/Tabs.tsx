import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "./cn";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      className={cn("grid grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/60 p-1", className)}
      ref={ref}
      {...props}
    />
  );
});

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-8 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", className)}
      ref={ref}
      {...props}
    />
  );
});

export { Tabs, TabsContent, TabsList, TabsTrigger };
