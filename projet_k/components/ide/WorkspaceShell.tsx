import { ActivityBar } from "./ActivityBar";
import { ExplorerPanel } from "./ExplorerPanel";
import { MenuBar } from "./MenuBar";
import { MainTabs } from "./MainTabs";
import { Workspace } from "../layout/Workspace";
import { InfoPanel } from "../layout/InfoPanel";
import { BottomBar } from "./BottomBar";
import { BottomPanel } from "./BottomPanel";
import { useClockStore } from "../../store/clockStore";

export function WorkspaceShell() {
  const sidebarVisible = useClockStore((s) => s.sidebarVisible);
  const selectedNodeId = useClockStore((s) => s.selectedNodeId);
  const darkMode = useClockStore((s) => s.darkMode);

  return (
    <div className={`flex h-screen w-screen flex-col overflow-hidden bg-[#f5f7fb] ${darkMode ? "dark" : ""}`}>
      <MenuBar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar />
        {sidebarVisible && <ExplorerPanel />}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <MainTabs />
          <Workspace />
        </main>

        {selectedNodeId && <InfoPanel />}
      </div>

      <BottomPanel />
      <BottomBar />
    </div>
  );
}