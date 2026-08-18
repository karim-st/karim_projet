import { FileText, FolderTree, Settings2, Clock3, Shapes, Plus, Search } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const items = [
  { icon: FolderTree, label: "Workspace", active: true },
  { icon: FileText, label: "JSON Files", active: false },
  { icon: Clock3, label: "Clocks", active: false },
  { icon: Shapes, label: "Schemas", active: false },
  { icon: Settings2, label: "Settings", active: false }
];

export function Sidebar() {
  return (
    <aside className="h-full w-64 border-r border-gray-200 bg-white">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold text-gray-700">Explorer</h2>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1 text-xs">
            <Plus size={14} />
            New
          </Button>
          <Button variant="secondary" className="px-3">
            <Search size={14} />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-3">
        <Card className="bg-slate-50 p-2">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-gray-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Workspace
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Projet Clock Creator avec édition JSON et schémas.
          </p>
        </Card>
      </div>
    </aside>
  );
}