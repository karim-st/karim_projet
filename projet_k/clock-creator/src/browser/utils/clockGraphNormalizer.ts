import { ClockTreeFile } from "../types/clock";

export function normalizeClockGraph(project: ClockTreeFile): ClockTreeFile {
  // Ensure basic arrays exist and match references
  const elements = project.tree.elements || [];
  const transitions = project.tree.transitions || [];
  const groups = project.tree.groups || [];

  return {
    ...project,
    tree: {
      ...project.tree,
      elements,
      transitions,
      groups
    }
  };
}
