import { useClockStore } from "../../store/clockStore";
import { toast } from "sonner";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { PropertiesForm } from "../forms/PropertiesForm";

export function InfoPanel() {
  const selectedNode = useClockStore((s) => s.selectedNode);
  const updateNode = useClockStore((s) => s.updateNode);
  const renameNode = useClockStore((s) => s.renameNode);
  const project = useClockStore((s) => s.project);

  return (
    <aside className="h-full w-80 min-w-[320px] overflow-auto border-l border-gray-200 bg-white p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">
        Clock Properties
      </div>

      <Card className="bg-gray-50 p-4">
        <h3 className="text-lg font-bold text-gray-800">Clock Information</h3>
        <p className="mt-1 text-sm text-gray-500">
          {selectedNode ? "Edit selected node details" : "Edit project settings"}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Project ID</label>
            <Input className="mt-1" value={project.tree.id} disabled />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Schema Version</label>
            <Input className="mt-1" value={project.tree.schema_version} disabled />
          </div>

          {selectedNode ? (
            <>
              <PropertiesForm
                node={selectedNode}
                onChange={(updatedNode) => {
                  const nextNodeId = updatedNode.id.trim();
                  if (!nextNodeId) {
                    toast.error("Node ID cannot be empty");
                    return;
                  }

                  if (
                    nextNodeId !== selectedNode.id &&
                    !renameNode(selectedNode.id, nextNodeId)
                  ) {
                    toast.error("Node ID must be unique");
                    return;
                  }

                  updateNode(nextNodeId, { ...updatedNode, id: nextNodeId });
                }}
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
              Select a node in the diagram to edit its properties.
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}