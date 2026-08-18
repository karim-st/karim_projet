import {
  FileText,
  Edit3,
  Grid2X2,
  PanelLeft,
  Eye,
  CornerDownRight,
  Play,
  Terminal,
  HelpCircle,
  MousePointer2
} from "lucide-react";
import type { ComponentType } from "react";
import { useState } from "react";
import { useClockStore } from "../../store/clockStore";
import { MenuDropdown, type MenuItem } from "./MenuDropdown";

type MenuKey =
  | "file"
  | "edit"
  | "clock"
  | "diagram"
  | "selection"
  | "view"
  | "go"
  | "run"
  | "terminal"
  | "help";

type MenuButtonData = {
  label: string;
  icon: ComponentType<any>;
  key: MenuKey;
};

const menuItems: MenuButtonData[] = [
  { label: "File", icon: FileText, key: "file" },
  { label: "Edit", icon: Edit3, key: "edit" },
  { label: "Clock Creator", icon: Grid2X2, key: "clock" },
  { label: "Diagram", icon: PanelLeft, key: "diagram" },
  { label: "Selection", icon: MousePointer2, key: "selection" },
  { label: "View", icon: Eye, key: "view" },
  { label: "Go", icon: CornerDownRight, key: "go" },
  { label: "Run", icon: Play, key: "run" },
  { label: "Terminal", icon: Terminal, key: "terminal" },
  { label: "Help", icon: HelpCircle, key: "help" }
];

export function MenuBar() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const darkMode = useClockStore((state) => state.darkMode);

  const setActivePanel = useClockStore((s) => s.setActivePanel);
  const setActiveBottomTab = useClockStore((s) => s.setActiveBottomTab);
  const runCommand = useClockStore((s) => s.runCommand);
  const pushLog = useClockStore((s) => s.pushLog);
  const openFiles = useClockStore((s) => s.openFiles);
  const setActiveFileId = useClockStore((s) => s.setActiveFileId);
  const duplicateNode = useClockStore((s) => s.duplicateNode);
  const removeNode = useClockStore((s) => s.removeNode);
  const selectedNodeId = useClockStore((s) => s.selectedNodeId);
  const toggleBottomPanel = useClockStore((s) => s.toggleBottomPanel);
  const clearLogs = useClockStore((s) => s.clearLogs);

  const fileMenu: MenuItem[] = [
    { label: "New Project", action: () => runCommand("newProject"), shortcut: "Ctrl+N" },
    { label: "Open Project", action: () => runCommand("openProject"), shortcut: "Ctrl+O" },
    { label: "Save", action: () => runCommand("saveProject"), shortcut: "Ctrl+S" },
    { label: "Save As", action: () => runCommand("saveProject") },
    { label: "Import JSON", action: () => runCommand("openProject") },
    { label: "Export JSON", action: () => runCommand("exportProject"), shortcut: "Ctrl+E" },
    { label: "Close Tab", action: () => setActiveFileId(openFiles[0]?.id ?? null) },
    { label: "Quit", action: () => pushLog("Quit application command executed", "warn"), danger: true }
  ];

  const editMenu: MenuItem[] = [
    { label: "Undo", action: () => runCommand("undo"), shortcut: "Ctrl+Z" },
    { label: "Redo", action: () => runCommand("redo"), shortcut: "Ctrl+Y" },
    { label: "Cut", action: () => pushLog("Cut executed", "info"), shortcut: "Ctrl+X" },
    { label: "Copy", action: () => pushLog("Copy executed", "info"), shortcut: "Ctrl+C" },
    { label: "Paste", action: () => pushLog("Paste executed", "info"), shortcut: "Ctrl+V" },
    { label: "Delete Node", action: () => selectedNodeId && removeNode(selectedNodeId), shortcut: "Del", danger: true },
    { label: "Duplicate Node", action: () => selectedNodeId && duplicateNode(selectedNodeId), shortcut: "Ctrl+D" },
    { label: "Rename", action: () => pushLog("Rename executed", "info") }
  ];

  const clockMenu: MenuItem[] = [
    { label: "Generate Clock Tree Template", action: () => runCommand("newProject") },
    { label: "Generate Base Project", action: () => runCommand("newProject") },
    { label: "Load STM32-like Example", action: () => setActiveFileId("clock_C5_1M.json") },
    { label: "Validate JSON Structure", action: () => runCommand("validateProject") },
    { label: "Business Rules", action: () => pushLog("Clock Creator rules opened", "info") },
    { label: "Open Assistants", action: () => setActivePanel("settings") }
  ];

  const diagramMenu: MenuItem[] = [
    { label: "Zoom In", action: () => runCommand("zoomIn"), shortcut: "Ctrl++" },
    { label: "Zoom Out", action: () => runCommand("zoomOut"), shortcut: "Ctrl+-" },
    { label: "Fit View", action: () => runCommand("fitView"), shortcut: "Ctrl+0" },
    { label: "Reset Position", action: () => runCommand("resetView") },
    { label: "Show Grid", action: () => pushLog("Show grid toggled", "info") },
    { label: "Enable Connections", action: () => pushLog("Connections enabled", "info") },
    { label: "Navigate Diagram", action: () => pushLog("Diagram navigation opened", "info") }
  ];

  const selectionMenu: MenuItem[] = [
    { label: "Select All", action: () => pushLog("Select all executed", "info"), shortcut: "Ctrl+A" },
    { label: "Deselect", action: () => pushLog("Selection cleared", "info") },
    { label: "Delete Selection", action: () => selectedNodeId && removeNode(selectedNodeId), danger: true },
    { label: "Duplicate Selection", action: () => selectedNodeId && duplicateNode(selectedNodeId) },
    { label: "Edit Properties", action: () => setActivePanel("properties") },
    { label: "Identify Linked Edges", action: () => pushLog("Linked edges identified", "debug") }
  ];

  const viewMenu: MenuItem[] = [
    { label: "Toggle Explorer", action: () => setActivePanel("explorer") },
    { label: "Toggle Properties", action: () => setActivePanel("properties") },
    { label: "Toggle Terminal", action: () => setActiveBottomTab("terminal") },
    { label: "Toggle Bottom Panel", action: () => toggleBottomPanel() },
    { label: "Split View", action: () => pushLog("Split view toggled", "info") },
    { label: "Light / Dark Mode", action: () => pushLog("Theme toggle requested", "info") }
  ];

  const goMenu: MenuItem[] = [
    { label: "Next Element", action: () => pushLog("Go to next element", "info") },
    { label: "Previous Element", action: () => pushLog("Go to previous element", "info") },
    { label: "Find Source", action: () => pushLog("Go to source requested", "info") },
    { label: "Find Output", action: () => pushLog("Go to output requested", "info") },
    { label: "Next Link", action: () => pushLog("Go to next link", "info") }
  ];

  const runMenu: MenuItem[] = [
    { label: "Validate JSON", action: () => runCommand("validateProject") },
    {
      label: "Simulate Clock Tree",
      action: () => pushLog("Simulation started", "debug")
    },
    { label: "Calculate Frequencies", action: () => pushLog("Frequency calculation started", "debug") },
    { label: "Verify Clock Paths", action: () => pushLog("Clock path verification started", "debug") },
    { label: "Run Analysis", action: () => pushLog("Analysis executed", "debug") }
  ];

  const terminalMenu: MenuItem[] = [
    { label: "Open Terminal Panel", action: () => setActiveBottomTab("terminal") },
    { label: "Show Logs", action: () => setActiveBottomTab("output") },
    { label: "Clear Console", action: () => clearLogs() }
  ];

  const helpMenu: MenuItem[] = [
    { label: "Open Documentation", action: () => pushLog("Documentation opened", "info") },
    { label: "Version", action: () => pushLog("Clock Creator v1.0.0", "info") },
    { label: "Examples", action: () => pushLog("Examples gallery opened", "info") },
    { label: "Keyboard Shortcuts", action: () => pushLog("Shortcuts dialog opened", "info") },
    { label: "User Guide", action: () => pushLog("User guide opened", "info") },
    { label: "About", action: () => pushLog("About opened", "info") }
  ];

  const getMenuItems = (key: MenuKey): MenuItem[] => {
    switch (key) {
      case "file":
        return fileMenu;
      case "edit":
        return editMenu;
      case "clock":
        return clockMenu;
      case "diagram":
        return diagramMenu;
      case "selection":
        return selectionMenu;
      case "view":
        return viewMenu;
      case "go":
        return goMenu;
      case "run":
        return runMenu;
      case "terminal":
        return terminalMenu;
      case "help":
        return helpMenu;
    }
  };

  return (
    <div className={`relative flex h-9 items-center gap-4 border-b px-3 text-[12px] text-white ${
      darkMode ? "border-slate-500 bg-[#111827]" : "border-[#0f3a6d] bg-[#17146E]"
    }`}>
      <div className="font-bold tracking-wide text-white/90">MX2</div>

      {menuItems.map((item) => {
        const Icon = item.icon;
        const isOpen = openMenu === item.key;

        return (
          <div key={item.key} className="relative">
            <button
              onClick={() => setOpenMenu(isOpen ? null : item.key)}
              className="flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10"
            >
              <Icon size={13} />
              <span>{item.label}</span>
            </button>

            {isOpen && (
              <div className="absolute left-0 top-9 z-50">
                <MenuDropdown
                  items={getMenuItems(item.key)}
                  onClose={() => setOpenMenu(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}