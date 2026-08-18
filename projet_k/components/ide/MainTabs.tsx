import { FileCode2, X } from "lucide-react";
import { useClockStore } from "../../store/clockStore";

type TabItem = {
  id: string;
  name: string;
  content: string;
};

export function MainTabs() {
  const openFiles = useClockStore((s) => s.openFiles);
  const activeFileId = useClockStore((s) => s.activeFileId);
  const setActiveFileId = useClockStore((s) => s.setActiveFileId);
  const closeFile = useClockStore((s) => s.closeFile);

  return (
    <div className="flex h-9 items-center border-b border-gray-200 bg-white px-2">
      {openFiles.map((tab: TabItem) => {
        const active = tab.id === activeFileId;

        return (
          <div
            key={tab.id}
            onClick={() => setActiveFileId(tab.id)}
            className={`mx-1 flex h-7 cursor-pointer items-center gap-2 rounded-t-md border px-3 text-[12px] ${
              active
                ? "border-gray-300 bg-[#f7f8fc] text-gray-800"
                : "border-transparent text-gray-500 hover:bg-gray-100"
            }`}
          >
            <FileCode2 size={13} />
            {tab.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(tab.id);
              }}
              className="ml-1 rounded hover:bg-gray-200"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}