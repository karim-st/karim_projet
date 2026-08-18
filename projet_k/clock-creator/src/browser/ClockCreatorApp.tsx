import * as React from 'react';
import { Toaster } from 'sonner';
import { Workspace } from './components/layout/Workspace';
import { WelcomeScreen } from './components/layout/WelcomeScreen';
import { useClockStore } from './store/clockStore';

/**
 * Application Clock Creator — vue organisée :
 *   Projet (génération FS)  ↔  JSON Editor  ↔  Diagramme (workflow)
 *
 * La barre d'outils du Workspace pilote New / Open / Save via project-bridge
 * (contribution Theia) et la sync JSON↔diagramme via useWorkspaceSync.
 */
export function ClockCreatorApp(): React.ReactElement {
    const darkMode = useClockStore((s) => s.darkMode);

    return (
        <div className={`clock-creator-root relative flex h-full min-h-0 w-full flex-col overflow-hidden ${darkMode ? 'dark' : ''}`}>
            <Toaster richColors position="top-right" />
            <Workspace />
            <WelcomeScreen />
        </div>
    );
}
