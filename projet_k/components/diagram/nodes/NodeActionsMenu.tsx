import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GitBranch, LocateFixed, Lock, MoreVertical, Route } from "lucide-react";
import { useClockStore, type PathHighlightMode } from "../../../store/clockStore";

type NodeActionsMenuProps = {
  nodeId: string;
  isLocked?: boolean;
  className?: string;
  style?: CSSProperties;
};

const actions: Array<{
  mode: PathHighlightMode;
  label: string;
  icon: typeof Route;
}> = [
  { mode: "path", label: "Highlight all path", icon: Route },
  { mode: "endpoints", label: "Highlight endpoint(s)", icon: LocateFixed },
  { mode: "source", label: "Highlight source", icon: GitBranch }
];

export function NodeActionsMenu({
  nodeId,
  isLocked = false,
  className = "",
  style
}: NodeActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathHighlight = useClockStore((state) => state.pathHighlight);
  const setPathHighlight = useClockStore((state) => state.setPathHighlight);
  const updateNode = useClockStore((state) => state.updateNode);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    const flowNode = rootRef.current?.closest<HTMLElement>(".react-flow__node");
    if (!flowNode || !open) return;

    const previousZIndex = flowNode.style.zIndex;
    flowNode.style.zIndex = "1000";
    return () => {
      flowNode.style.zIndex = previousZIndex;
    };
  }, [open]);

  const chooseHighlight = (mode: PathHighlightMode) => {
    const active = pathHighlight?.nodeId === nodeId && pathHighlight.mode === mode;
    setPathHighlight(active ? null : { nodeId, mode });
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`nodrag nopan absolute right-0 top-0 z-50 ${className}`}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Component actions"
        aria-expanded={open}
        title="Component actions"
        onClick={() => setOpen((value) => !value)}
        className="flex h-5 w-5 items-center justify-center text-[#536273] hover:bg-[#e8edf3] hover:text-[#1f334a]"
      >
        <MoreVertical size={13} />
      </button>

      {open ? (
        <div className="absolute right-0 top-5 z-[100] w-[178px] border border-[#aeb8c5] bg-white py-[2px] text-[11px] text-[#3f4f61] shadow-md">
          {actions.map(({ mode, label, icon: Icon }) => {
            const active = pathHighlight?.nodeId === nodeId && pathHighlight.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => chooseHighlight(mode)}
                className={`flex h-6 w-full items-center gap-2 px-2 text-left ${
                  active ? "bg-[#35afe4] text-white" : "hover:bg-[#e8f4fb]"
                }`}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              updateNode(nodeId, { isLocked: !isLocked });
              setOpen(false);
            }}
            className={`flex h-6 w-full items-center gap-2 px-2 text-left hover:bg-[#e8f4fb] ${
              isLocked ? "text-[#087fdb]" : ""
            }`}
          >
            <Lock size={12} />
            <span>{isLocked ? "Unlock config" : "Lock config"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}