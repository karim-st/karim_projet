import { FolderOpen, Save, Play, LayoutDashboard } from "lucide-react";
import { Button } from "../ui/Button";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-white/10 bg-primary px-4 text-white shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-sm font-bold">
          MX
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-wide">
            Clock Creator
          </h1>
          <p className="text-[11px] text-white/70">
            Design & Diagram Workspace
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" className="text-white hover:bg-white/10">
          <FolderOpen size={16} />
          Ouvrir
        </Button>
        <Button variant="ghost" className="text-white hover:bg-white/10">
          <Save size={16} />
          Sauver
        </Button>
        <Button className="bg-white text-primary hover:bg-gray-100">
          <Play size={16} />
          Exécuter
        </Button>
        <Button variant="ghost" className="text-white hover:bg-white/10">
          <LayoutDashboard size={16} />
          Layout
        </Button>
      </div>
    </header>
  );
}