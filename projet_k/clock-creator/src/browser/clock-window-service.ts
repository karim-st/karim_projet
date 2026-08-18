import { injectable } from '@theia/core/shared/inversify';
import { DefaultWindowService } from '@theia/core/lib/browser/window/default-window-service';
import { useClockStore } from './store/clockStore';

/**
 * Service fenêtre Clock Creator : File → New Window n'ouvre plus de
 * nouvelle fenêtre ; il affiche simplement l'écran d'accueil (image +
 * actions) dans la fenêtre courante.
 */
@injectable()
export class ClockWindowService extends DefaultWindowService {

    override async openNewDefaultWindow(): Promise<number> {
        useClockStore.getState().setWelcomeVisible(true);
        return -1;
    }

}