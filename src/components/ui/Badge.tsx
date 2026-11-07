import React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "neutral" | "success" | "warning" | "danger" | "indigo" | "outline";
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-slate-800/80 text-slate-300 border-slate-700/80",
    neutral: "bg-slate-800/60 text-slate-400 border-slate-700/60",
    success: "bg-emerald-950/60 text-emerald-300 border-emerald-800/80",
    warning: "bg-amber-950/60 text-amber-300 border-amber-800/80",
    danger: "bg-rose-950/60 text-rose-300 border-rose-800/80",
    indigo: "bg-violet-950/60 text-violet-300 border-violet-800/80",
    outline: "bg-transparent text-slate-300 border-slate-700/80",
  };

  const sizeStyles = {
    sm: "text-[11px] px-2 py-0.5",
    md: "text-xs px-2.5 py-0.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
