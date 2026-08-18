import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary: "bg-[#17146E] text-white hover:bg-[#0F0D45] shadow-sm",
    secondary:
      "bg-white text-[#17146E] border border-gray-300 hover:bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-[#1e293b] dark:text-slate-100 dark:hover:bg-[#27354a]",
    ghost: "bg-transparent text-white hover:bg-white/10"
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}