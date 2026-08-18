import clsx from "clsx";
import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-gray-200 bg-white shadow-soft dark:border-slate-700 dark:bg-[#151e2e]",
        className
      )}
    >
      {children}
    </div>
  );
}