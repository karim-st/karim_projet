import {
  Files,
  Search,
  GitBranch,
  PlayCircle,
  Blocks,
  Settings2
} from "lucide-react";
import { useClockStore } from "../../store/clockStore";

type PanelKey =
  | "explorer"
  | "search"
  | "sourceControl"
  | "run"
  | "extensions"
  | "settings";

const items: { icon: React.ComponentType<any>; key: PanelKey; title: string }[] = [
  { icon: Files, key: "explorer", title: "Explorer" },
  { icon: Search, key: "search", title: "Search" },
  { icon: GitBranch, key: "sourceControl", title: "Source Control" },
  { icon: PlayCircle, key: "run", title: "Run" },
  { icon: Blocks, key: "extensions", title: "Extensions" },
  { icon: Settings2, key: "settings", title: "Settings" }
];

export function ActivityBar() {
  const activePanel = useClockStore((s) => s.activePanel);
  const setActivePanel = useClockStore((s) => s.setActivePanel);
  const sidebarVisible = useClockStore((s) => s.sidebarVisible);
  const setSidebarVisible = useClockStore((s) => s.setSidebarVisible);

  const handleClick = (panel: PanelKey) => {
    if (activePanel === panel && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActivePanel(panel);
      setSidebarVisible(true);
    }
  };

  return (
    <div className="flex w-12 flex-col items-center gap-3 border-r border-gray-200 bg-white py-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activePanel === item.key && sidebarVisible;

        return (
          <button
            key={item.key}
            title={item.title}
            onClick={() => handleClick(item.key)}
            className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
              active ? "bg-[#17146E] text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Icon size={17} />
          </button>
        );
      })}
    </div>
  );
}