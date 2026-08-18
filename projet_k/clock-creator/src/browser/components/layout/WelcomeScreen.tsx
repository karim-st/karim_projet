import { useEffect, useRef } from "react";
import { FolderOpen, MousePointerClick, Plus, X } from "lucide-react";
import { useClockStore } from "../../store/clockStore";
import { requestNewProject, requestOpenProject } from "../../project-bridge";
import { Button } from "../ui/Button";
import welcomeImage from "../../../../assets/images/im.jpg";

export function WelcomeScreen() {
  const darkMode = useClockStore((s) => s.darkMode);
  const showWelcome = useClockStore((s) => s.showWelcome);
  const setWelcomeVisible = useClockStore((s) => s.setWelcomeVisible);

  const initialProjectId = useRef(useClockStore.getState().project.tree.id);

  useEffect(() => {
    const unsubscribe = useClockStore.subscribe((state, previous) => {
      if (
        state.project.tree.id !== previous.project.tree.id &&
        state.project.tree.id !== initialProjectId.current
      ) {
        setWelcomeVisible(false);
      }
    });
    return unsubscribe;
  }, [setWelcomeVisible]);

  if (!showWelcome) {
    return null;
  }

  const handleCreate = () => {
    setWelcomeVisible(false);
    requestNewProject();
  };

  const handleOpen = () => {
    // Fermer l'overlay d'abord (sinon z-index bloque le dialogue Theia)
    setWelcomeVisible(false);
    // Laisser React unmount l'overlay avant d'ouvrir le file picker
    window.setTimeout(() => requestOpenProject(), 0);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-6 backdrop-blur-[2px] dark:bg-black/60">
      <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-[#121c2b]">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-4 dark:border-slate-600 dark:bg-[#1e293b]">
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Clock Creator</span>
          <button
            type="button"
            title="Fermer"
            aria-label="Fermer la fenêtre"
            onClick={() => setWelcomeVisible(false)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-5 overflow-y-auto p-6">
          <img
            src={welcomeImage}
            alt="Clock Creator"
            className="max-h-64 w-auto max-w-full rounded-lg object-contain shadow-lg ring-1 ring-gray-200 dark:ring-slate-600"
          />

          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800 dark:text-slate-100">Bienvenue dans Clock Creator</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              Concevez votre arbre d&apos;horloge : créez un nouveau projet ou ouvrez un projet existant.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" variant="primary" onClick={handleCreate}>
              <Plus size={16} />
              Créer un projet
            </Button>
            <Button type="button" variant="secondary" onClick={handleOpen}>
              <FolderOpen size={16} />
              Ouvrir un projet
            </Button>
            <button
              type="button"
              onClick={() => setWelcomeVisible(false)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              <MousePointerClick size={16} />
              Continuer avec le schéma
            </button>
          </div>

          {darkMode && (
            <p className="text-[11px] text-slate-500">
              Le mode sombre est actif — utilisez l&apos;icône en bas de la barre latérale pour basculer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
