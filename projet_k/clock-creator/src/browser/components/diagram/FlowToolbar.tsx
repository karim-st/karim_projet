import { useClockStore } from "../../store/clockStore";

export function FlowToolbar() {
  const activeProjectFile = useClockStore((s) => s.activeProjectFile);
  const activeProjectFolder = useClockStore((s) => s.activeProjectFolder);

  const fileName = activeProjectFile || "clock.json";
  const fullPath = activeProjectFolder
    ? `${activeProjectFolder.replace(/^file:\/\//, "")}/${fileName}`
    : fileName;

  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-slate-300">
        Diagram Tools
      </h3>
      <span
        title={fullPath}
        className="max-w-[240px] truncate rounded-md bg-white px-2 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200 dark:bg-[#1e293b] dark:text-slate-300 dark:ring-slate-600"
      >
        {fileName}
      </span>
    </div>
  );
}
