import { useEffect, useRef } from "react";

export type MenuItem = {
  label: string;
  action: () => void;
  shortcut?: string;
  danger?: boolean;
};

type MenuDropdownProps = {
  items: MenuItem[];
  onClose: () => void;
};

export function MenuDropdown({ items, onClose }: MenuDropdownProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="min-w-[260px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          onClick={() => {
            item.action();
            onClose();
          }}
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${
            item.danger ? "text-red-600" : "text-gray-800"
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-gray-400">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}