import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-pin-sm border px-2 py-0.5 text-pin-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        critical:
          'bg-pin-critical-bg text-pin-critical border-pin-critical/20',
        warning:
          'bg-pin-warning-bg text-pin-warning border-pin-warning/20',
        info:
          'bg-pin-info-bg text-pin-info border-pin-info/20',
        success:
          'bg-pin-success-bg text-pin-success border-pin-success/20',
        nominal:
          'bg-pin-nominal-bg text-pin-nominal border-pin-nominal/20',
        beta:
          'bg-[#EEF2FF] text-[#4F46E5] border-[#4F46E5]/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
