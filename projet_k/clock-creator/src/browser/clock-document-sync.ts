import { injectable, inject } from '@theia/core/shared/inversify';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import {
    FrontendApplicationContribution,
    Saveable
} from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { useClockStore } from './store/clockStore';
import { ClockWorkspaceService } from './clock-workspace-service';
import { parseJsonSafe } from './utils/jsonParser';
import type { ClockTreeFile } from './types/clock';

/**
 * Unifie les deux vues JSON :
 *  - Monaco intégré (Clock Creator)
 *  - Onglet Theia `clock.json`
 *
 * Auto-save disque : silencieux (pas d'alerte MessageService / dialog Theia).
 */
@injectable()
export class ClockDocumentSyncService implements FrontendApplicationContribution {

    @inject(EditorManager)
    protected readonly editorManager!: EditorManager;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(ClockWorkspaceService)
    protected readonly clockWorkspace!: ClockWorkspaceService;

    protected readonly toDispose = new DisposableCollection();
    protected editorListener: Disposable | undefined;
    protected syncingFromStore = false;
    protected syncingFromEditor = false;
    protected pushTimer: ReturnType<typeof setTimeout> | undefined;
    protected boundUri: string | undefined;

    onStart(): void {
        this.toDispose.push(
            Disposable.create(
                useClockStore.subscribe((state, prev) => {
                    const projectChanged = state.project !== prev.project;
                    const fileChanged =
                        state.activeProjectFile !== prev.activeProjectFile ||
                        state.activeProjectFolder !== prev.activeProjectFolder;
                    if (!projectChanged && !fileChanged) {
                        return;
                    }
                    if (this.syncingFromEditor) {
                        return;
                    }
                    this.scheduleSilentAutoSave();
                })
            )
        );
    }

    onStop(): void {
        if (this.pushTimer) {
            clearTimeout(this.pushTimer);
        }
        this.editorListener?.dispose();
        this.toDispose.dispose();
    }

    /**
     * Ouvre (ou révèle) clock.json dans Theia et aligne le contenu avec le store.
     * Sans notification.
     */
    async openAndSyncProjectEditor(): Promise<URI | undefined> {
        const uri = await this.resolveActiveUri();
        if (!uri) {
            return undefined;
        }

        await this.writeStoreToDisk(uri);

        const widget = await this.editorManager.open(uri, {
            mode: 'reveal',
            widgetOptions: { area: 'main' }
        });
        this.bindEditor(widget, uri);
        await this.alignEditorWithDisk(widget);
        return uri;
    }

    /** Auto-save silencieux (debounce) — aucune alerte */
    protected scheduleSilentAutoSave(): void {
        if (this.pushTimer) {
            clearTimeout(this.pushTimer);
        }
        this.pushTimer = setTimeout(() => {
            void this.pushStoreToTheiaAndDiskSilent();
        }, 400);
    }

    protected async pushStoreToTheiaAndDiskSilent(): Promise<void> {
        if (this.syncingFromEditor) {
            return;
        }
        const uri = await this.resolveActiveUri();
        if (!uri) {
            return;
        }

        const text = JSON.stringify(useClockStore.getState().project, null, 2);
        await this.writeStoreToDisk(uri, text);

        try {
            window.localStorage.setItem('clock_creator_saved', text);
            window.localStorage.setItem('clock_creator_draft', text);
        } catch {
            /* ignore */
        }

        const widget = await this.editorManager.getByUri(uri);
        if (!widget) {
            return;
        }
        this.bindEditor(widget, uri);
        await this.alignEditorWithDisk(widget);
    }

    protected async writeStoreToDisk(uri: URI, text?: string): Promise<void> {
        const content = text ?? JSON.stringify(useClockStore.getState().project, null, 2);
        try {
            if (await this.fileService.exists(uri)) {
                await this.fileService.write(uri, content);
            } else {
                await this.fileService.create(uri, content);
            }
        } catch {
            // auto-save silencieux
        }
    }

    /**
     * Aligne l'onglet Theia sans le marquer dirty
     * (évite dialogs / auto-save Theia + alertes).
     */
    protected async alignEditorWithDisk(widget: EditorWidget): Promise<void> {
        const saveable = Saveable.get(widget);
        this.syncingFromStore = true;
        try {
            if (saveable?.revert) {
                await saveable.revert();
                return;
            }
            await this.pushStoreTextIntoEditor(widget);
        } catch {
            await this.pushStoreTextIntoEditor(widget);
        } finally {
            setTimeout(() => {
                this.syncingFromStore = false;
            }, 80);
        }
    }

    protected async pushStoreTextIntoEditor(widget: EditorWidget, text?: string): Promise<void> {
        const content = text ?? JSON.stringify(useClockStore.getState().project, null, 2);
        const current = widget.editor.document.getText();
        if (current === content) {
            const saveable = Saveable.get(widget);
            if (saveable?.dirty && saveable.revert) {
                try {
                    await saveable.revert({ soft: true });
                } catch {
                    /* ignore */
                }
            }
            return;
        }

        this.syncingFromStore = true;
        try {
            const doc = widget.editor.document;
            const lastLine = Math.max(0, doc.lineCount - 1);
            const lastChar = doc.getLineMaxColumn(lastLine + 1) - 1;
            await widget.editor.replaceText({
                source: 'clock-creator-sync',
                replaceOperations: [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: lastLine, character: Math.max(0, lastChar) }
                        },
                        text: content
                    }
                ]
            });
            const saveable = Saveable.get(widget);
            if (saveable?.revert) {
                try {
                    await saveable.revert({ soft: true });
                } catch {
                    /* ignore */
                }
            }
        } catch {
            try {
                await this.fileService.write(widget.editor.uri, content);
            } catch {
                /* ignore */
            }
        } finally {
            setTimeout(() => {
                this.syncingFromStore = false;
            }, 80);
        }
    }

    protected bindEditor(widget: EditorWidget, uri: URI): void {
        const key = uri.toString();
        if (this.boundUri === key && this.editorListener) {
            return;
        }
        this.editorListener?.dispose();
        this.boundUri = key;

        this.editorListener = widget.editor.onDocumentContentChanged(() => {
            if (this.syncingFromStore) {
                return;
            }
            const text = widget.editor.document.getText();
            const parsed = parseJsonSafe<ClockTreeFile>(text);
            if (!parsed.data) {
                return;
            }
            const current = JSON.stringify(useClockStore.getState().project);
            const next = JSON.stringify(parsed.data);
            if (current === next) {
                return;
            }
            this.syncingFromEditor = true;
            try {
                useClockStore.getState().updateProjectFromJson(text);
            } finally {
                setTimeout(() => {
                    this.syncingFromEditor = false;
                }, 80);
            }
        });
    }

    protected async resolveActiveUri(): Promise<URI | undefined> {
        const state = useClockStore.getState();
        const fileName = state.activeProjectFile || 'clock.json';
        if (state.activeProjectFolder) {
            return new URI(state.activeProjectFolder).resolve(fileName);
        }
        return this.clockWorkspace.resolveProjectUri(fileName);
    }
}
