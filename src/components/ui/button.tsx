import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";

const buttonVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap font-medium leading-tight transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border border-line-2 bg-surface text-ink rounded-2 hover:bg-bg-2 hover:border-line-3",
        primary:
          "border border-accent bg-accent text-accent-ink rounded-2 hover:bg-accent-h hover:border-accent-h",
        ghost:
          "border border-transparent bg-transparent text-ink-2 rounded-2 hover:bg-bg-2 hover:text-ink",
      },
      size: {
        sm: "px-2 py-0.5 text-[11.5px] rounded-1",
        md: "px-2.5 py-1 text-[12px]",
        lg: "px-3.5 py-1.5 text-[13px]",
        icon: "h-[26px] w-[26px] p-0 justify-center",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
