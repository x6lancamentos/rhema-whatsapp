import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/10 text-primary dark:text-emerald-400 [a&]:hover:bg-primary/20",
        secondary:
          "border-border/60 bg-secondary/80 text-secondary-foreground [a&]:hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive dark:text-rose-400 [a&]:hover:bg-destructive/20",
        outline:
          "border-border/80 text-foreground [a&]:hover:bg-muted/60 [a&]:hover:text-foreground",
        success:
          "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 [a&]:hover:bg-emerald-500/20",
        warning:
          "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400 [a&]:hover:bg-amber-500/20",
        info:
          "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400 [a&]:hover:bg-blue-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
