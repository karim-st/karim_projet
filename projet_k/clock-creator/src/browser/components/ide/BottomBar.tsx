export function BottomBar() {
  return (
    <div className="flex h-7 items-center justify-between border-t border-gray-200 bg-[#17146E] px-3 text-[11px] text-white">
      <div className="flex items-center gap-4">
        <span>MX2</span>
        <span>Ready</span>
        <span>Clock Creator Workspace</span>
      </div>

      <div className="flex items-center gap-4">
        <span>Ln 1, Col 1</span>
        <span>UTF-8</span>
        <span>Spaces: 2</span>
        <span>JSON</span>
      </div>
    </div>
  );
}