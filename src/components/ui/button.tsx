import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/95 shadow-xs hover:shadow-lg hover:shadow-primary/25 active:shadow-xs font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs hover:shadow-lg hover:shadow-destructive/25 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border/80 bg-background/80 backdrop-blur-xs shadow-2xs hover:bg-muted/80 hover:text-foreground hover:border-border dark:border-border/60 dark:hover:bg-muted/60",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-secondary/20 shadow-2xs",
        ghost:
          "hover:bg-muted/70 hover:text-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        glass:
          "bg-white/15 dark:bg-white/[0.05] backdrop-blur-md border border-white/25 dark:border-white/[0.1] text-foreground hover:bg-white/25 dark:hover:bg-white/[0.09] shadow-2xs",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-xl px-8 has-[>svg]:px-4 font-semibold text-base",
        icon: "size-9 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentProps<"button">,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
