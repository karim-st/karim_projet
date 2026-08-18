import { useMemo } from "react";
import sample from "../data/sampleClock.json";
import { useLocalStorage } from "./useLocalStorage";

const STORAGE_KEY = "clock_creator_project";
type ClockProject = typeof sample;

export function useClockProject() {
  const [project, setProject] = useLocalStorage<ClockProject>(
    STORAGE_KEY,
    sample
  );

  const exportJson = useMemo(() => JSON.stringify(project, null, 2), [project]);

  return {
    project,
    setProject,
    exportJson
  };
}