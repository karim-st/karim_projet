import { injectable, inject } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry, MessageService } from '@theia/core';
import type { Command } from '@theia/core/lib/common/command';
import {
    AbstractViewContribution,
    FrontendApplication,
    FrontendApplicationContribution,
    StatusBar,
    StatusBarAlignment,
    WidgetManager
} from '@theia/core/lib/browser';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { AbstractDialog, ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { codicon } from '@theia/core/lib/browser/widgets';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog';
import { FileChangesEvent, FileStat } from '@theia/filesystem/lib/common/files';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EnvVariablesServer } from '@theia/core/lib/common/env-variables';
import { FILE_NAVIGATOR_ID, FileNavigatorWidget } from '@theia/navigator/lib/browser/navigator-widget';
import { ClockCreatorWidget } from './clock-creator-widget';
import { CLOCK_CREATOR_MENU, CLOCK_THEME_MENU, ClockCreatorCommands } from './clock-creator-commands';
import { ClockWorkspaceService } from './clock-workspace-service';
import { ClockDocumentSyncService } from './clock-document-sync';
import { useClockStore, sanitizeProjectName } from './store/clockStore';
import type { ClockTreeFile } from './types/clock';
import {
    ClockCreatorProjectDialog,
    ProjectCreateRequest,
    ProjectNameContentWidget
} from './clock-creator-project-dialog';
import {
    ImportedDescriptor,
    isClockDescriptor
} from './clock-load-old-project-dialog';
import { subscribeProjectBridge } from './project-bridge';
import {
    DiagramExportFormat,
    exportDiagramImage
} from './utils/clockImageExport';
import { bindTheiaThemeService, applyTheiaTheme } from './utils/theiaTheme';

const IMAGE_EXPORT_COMMANDS: Array<{ command: Command; format: DiagramExportFormat }> = [
    { command: ClockCreatorCommands.EXPORT_DIAGRAM_PNG, format: 'png' },
    { command: ClockCreatorCommands.EXPORT_DIAGRAM_JPG, format: 'jpg' },
    { command: ClockCreatorCommands.EXPORT_DIAGRAM_SVG, format: 'svg' }
];

@injectable()
export class ClockCreatorContribution extends AbstractViewContribution<ClockCreatorWidget> implements FrontendApplicationContribution {

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(StatusBar)
    protected readonly statusBar!: StatusBar;

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(ClockWorkspaceService)
    protected readonly clockWorkspace!: ClockWorkspaceService;

    @inject(ClockDocumentSyncService)
    protected readonly documentSync!: ClockDocumentSyncService;

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(FileDialogService)
    protected readonly fileDialogService!: FileDialogService;

    @inject(EnvVariablesServer)
    protected readonly environments!: EnvVariablesServer;

    @inject(ThemeService)
    protected readonly themeService!: ThemeService;

    protected projectBridgeDispose: (() => void) | undefined;

    protected filesystemChangeDispose: { dispose(): void } | undefined;

    protected filesystemRefreshTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        super({
            widgetId: ClockCreatorWidget.ID,
            widgetName: ClockCreatorWidget.LABEL,
            defaultWidgetOptions: { area: 'main' },
            toggleCommandId: ClockCreatorCommands.OPEN_WIDGET.id
        });
    }

    async onStart(app: FrontendApplication): Promise<void> {
        bindTheiaThemeService(this.themeService);
        this.watchThemeSync();
        this.syncThemeStatusBar();
        this.listenForThemeIconClick();
        void app.shell.initialized.then(() => this.addThemeSidebarMenu());
        this.statusBar.setElement('clock-creator-status', {
            text: '$(sitemap) MX2 Clock Creator',
            alignment: StatusBarAlignment.LEFT,
            priority: 1,
            tooltip: 'STM32 Clock Tree IDE — workspace/*.json',
            command: ClockCreatorCommands.OPEN_WIDGET.id
        });

        this.watchPendingOpenFile();
        // Ne pas await : un reveal Explorer ici bloque l'écran de chargement Theia
        void this.bootstrapWorkspaceFiles();
        this.watchFilesystemChanges();
        this.projectBridgeDispose?.();
        this.projectBridgeDispose = subscribeProjectBridge((action) => {
            if (action === 'new-project') {
                this.openNewProjectDialog();
            } else if (action === 'open-project') {
                void this.openLoadProjectDialog();
            } else if (action === 'save-project') {
                void this.saveClockProject();
            }
        });
    }

    onStop(): void {
        this.projectBridgeDispose?.();
        this.projectBridgeDispose = undefined;
        this.filesystemChangeDispose?.dispose();
        this.filesystemChangeDispose = undefined;
        if (this.filesystemRefreshTimer !== undefined) {
            clearTimeout(this.filesystemRefreshTimer);
            this.filesystemRefreshTimer = undefined;
        }
        document.removeEventListener('mousedown', this.handleThemeIconMouseDown, true);
    }

    /**
     * Surveille le filesystem (rename / création / suppression via l'Explorer Theia)
     * pour que le nom de fichier affiché dans la zone du diagramme reste correct.
     */
    protected watchFilesystemChanges(): void {
        this.filesystemChangeDispose?.dispose();
        this.filesystemChangeDispose = this.fileService.onDidFilesChange(
            (event: FileChangesEvent) => this.handleFilesystemChange(event)
        );
    }

    protected handleFilesystemChange(event: FileChangesEvent): void {
        const deleted = event.getDeleted();
        const added = event.getAdded();
        if (deleted.length === 0 && added.length === 0) {
            return;
        }

        const state = useClockStore.getState();
        const activeName = state.activeProjectFile;

        void this.clockWorkspace.getRootUri().then((root) => {
            if (!root) {
                return;
            }
            const rootStr = root.toString();
            const jsonNames = (change: { resource: { toString(): string } }): string | undefined => {
                const uri = change.resource.toString();
                if (!uri.startsWith(rootStr)) {
                    return undefined;
                }
                const base = uri.slice(rootStr.length).replace(/^\//, '');
                return base.toLowerCase().endsWith('.json') ? base : undefined;
            };

            const deletedNames = deleted
                .map(jsonNames)
                .filter((name): name is string => !!name);
            const addedNames = added
                .map(jsonNames)
                .filter((name): name is string => !!name);

            if (activeName && deletedNames.includes(activeName) && addedNames.length > 0) {
                // Renommage du fichier actif : adopter le nouveau nom immédiatement.
                const nextName = addedNames[0];
                if (nextName !== activeName) {
                    useClockStore.getState().setActiveProjectFile(nextName);
                    this.messageService.info(`Fichier renommé : ${activeName} → ${nextName}`);
                }
            } else if (activeName && deletedNames.includes(activeName) && addedNames.length === 0) {
                // Suppression du fichier actif sans remplacement.
                useClockStore.getState().setActiveProjectFile(null);
            }

            if (deletedNames.length > 0 || addedNames.length > 0) {
                this.scheduleWorkspaceRefresh();
            }
        });
    }

    protected scheduleWorkspaceRefresh(): void {
        if (this.filesystemRefreshTimer !== undefined) {
            clearTimeout(this.filesystemRefreshTimer);
        }
        this.filesystemRefreshTimer = setTimeout(() => {
            this.filesystemRefreshTimer = undefined;
            void this.refreshWorkspaceFiles();
        }, 400);
    }

    protected watchPendingOpenFile(): void {
        useClockStore.subscribe((state, prev) => {
            if (!state.pendingOpenFile || state.pendingOpenFile === prev.pendingOpenFile) {
                return;
            }
            const fileName = state.pendingOpenFile;
            useClockStore.getState().clearPendingOpenFile();
            if (fileName === '__refresh__') {
                void this.refreshWorkspaceFiles();
                return;
            }
            void this.openWorkspaceClockFile(fileName);
        });
    }

    protected watchThemeSync(): void {
        useClockStore.subscribe((state, prev) => {
            if (state.darkMode === prev.darkMode) {
                return;
            }
            // Chaque étape est isolée : une erreur ne doit jamais bloquer les autres abonnés.
            try {
                applyTheiaTheme(state.darkMode);
            } catch (error) {
                useClockStore.getState().pushLog(`Thème Theia: ${String(error)}`, 'warn');
            }
            try {
                this.syncThemeStatusBar();
            } catch {
                // non bloquant
            }
            try {
                this.syncThemeSidebarMenu();
            } catch {
                // non bloquant
            }
        });
    }

    /**
     * Clic direct sur l'icône clair/sombre en bas de sidebar (sans menu contextuel).
     * L'écoute est en phase capture sur document, ciblée uniquement sur les classes
     * codicon de notre icône située dans la sidebar.
     */
    protected listenForThemeIconClick(): void {
        document.addEventListener('mousedown', this.handleThemeIconMouseDown, true);
    }

    protected handleThemeIconMouseDown = (event: MouseEvent): void => {
        const target = event.target as HTMLElement | null;
        if (!target?.classList?.contains) {
            return;
        }
        const isOurIcon = target.classList.contains('codicon-color-mode');
        if (!isOurIcon || !target.closest('.theia-sidebar-menu')) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        useClockStore.getState().toggleDarkMode();
    };

    protected addThemeSidebarMenu(): void {
        const darkMode = useClockStore.getState().darkMode;
        this.shell.leftPanelHandler.addBottomMenu({
            id: 'clock-creator-theme-menu',
            // Glyphe fixe (moitié clair/sombre) : design identique et lisible dans les deux modes.
            iconClass: codicon('color-mode'),
            title: darkMode ? 'Mode clair (bascule globale)' : 'Mode sombre (bascule globale)',
            menuPath: CLOCK_THEME_MENU,
            // order 0 = engrenage Settings (en bas) ; 1 = juste au-dessus.
            order: 1
        });
    }

    protected syncThemeSidebarMenu(): void {
        this.shell.leftPanelHandler.removeBottomMenu('clock-creator-theme-menu');
        this.addThemeSidebarMenu();
    }

    protected syncThemeStatusBar(): void {
        this.statusBar.setElement('clock-creator-theme', {
            text: useClockStore.getState().darkMode ? '$(color-mode) Mode clair' : '$(color-mode) Mode sombre',
            alignment: StatusBarAlignment.RIGHT,
            priority: 100,
            tooltip: 'Basculer entre le mode clair et le mode sombre (tout le système)',
            command: ClockCreatorCommands.TOGGLE_DARK_MODE.id
        });
    }

    /**
     * Toujours exécuté après l'initialisation du shell (layout restauré OU défaut),
     * contrairement à initializeLayout qui n'est appelé que si aucun layout n'était
     * stocké — sans cela, un layout vide restauré laissait la zone principale vide
     * avec uniquement la barre de menus.
     */
    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        await this.openView({ activate: true, reveal: true });
        // Aligner Monaco intégré et l'onglet Theia dès le démarrage
        setTimeout(() => {
            void this.documentSync.openAndSyncProjectEditor();
        }, 300);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ClockCreatorCommands.OPEN_WIDGET, {
            execute: async () => {
                await this.openView({ activate: true, reveal: true });
                await this.documentSync.openAndSyncProjectEditor();
            }
        });

        commands.registerCommand(ClockCreatorCommands.TOGGLE_EDITOR, {
            execute: async () => {
                useClockStore.getState().toggleEditor();
                await this.documentSync.openAndSyncProjectEditor();
            }
        });

        commands.registerCommand(ClockCreatorCommands.TOGGLE_DARK_MODE, {
            execute: () => useClockStore.getState().toggleDarkMode()
        });

        commands.registerCommand(ClockCreatorCommands.NEW_PROJECT, {
            execute: () => this.openNewProjectDialog()
        });

        commands.registerCommand(ClockCreatorCommands.CREATE_PROJECT, {
            execute: () => this.openNewProjectDialog()
        });

        commands.registerCommand(ClockCreatorCommands.IMPORT_PROJECT, {
            execute: () => void this.openLoadProjectDialog()
        });

        commands.registerCommand(ClockCreatorCommands.SAVE_PROJECT, {
            execute: () => this.saveClockProject()
        });

        commands.registerCommand(ClockCreatorCommands.SAVE_AS_PROJECT, {
            execute: () => this.openSaveAsDialog()
        });

        commands.registerCommand(ClockCreatorCommands.DELETE_PROJECT_FILE, {
            execute: () => this.deleteActiveProjectFile()
        });

        commands.registerCommand(ClockCreatorCommands.REFRESH_WORKSPACE_FILES, {
            execute: () => this.refreshWorkspaceFiles()
        });

        commands.registerCommand(ClockCreatorCommands.DUPLICATE_NODE, {
            isEnabled: () => !!useClockStore.getState().selectedNodeId,
            execute: () => {
                const id = useClockStore.getState().selectedNodeId;
                if (!id) {
                    return;
                }
                useClockStore.getState().duplicateNode(id);
            }
        });

        commands.registerCommand(ClockCreatorCommands.DELETE_NODE, {
            isEnabled: () => !!useClockStore.getState().selectedNodeId,
            execute: () => {
                const id = useClockStore.getState().selectedNodeId;
                if (!id) {
                    return;
                }
                useClockStore.getState().removeNode(id);
            }
        });

        for (const { command, storeCmd } of ClockCreatorCommands.STORE_COMMANDS) {
            commands.registerCommand(command, {
                execute: () => {
                    useClockStore.getState().runCommand(storeCmd);
                    if (command.label) {
                        this.messageService.info(`Clock Creator: ${command.label}`);
                    }
                }
            });
        }

        for (const { command, format } of IMAGE_EXPORT_COMMANDS) {
            commands.registerCommand(command, {
                execute: async () => {
                    try {
                        const fileName = await exportDiagramImage(format);
                        this.messageService.info(`Diagramme exporté : ${fileName}`);
                    } catch (reason) {
                        const message = reason instanceof Error ? reason.message : String(reason);
                        this.messageService.warn(`Export impossible : ${message}`);
                    }
                }
            });
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        // —— File (Theia) : uniquement les actions propres à ce menu.
        // Create Project : premier élément du menu File (groupe « New »), avec choix
        // de l'emplacement de stockage sur le PC via le sélecteur de dossier.
        menus.registerMenuAction(CommonMenus.FILE_NEW_TEXT, {
            commandId: ClockCreatorCommands.CREATE_PROJECT.id,
            label: 'Create Project',
            order: '0'
        });
        // New/Open/Save/Export existent déjà dans le sous-menu « Clock Creator ».
        menus.registerMenuAction(CommonMenus.FILE_OPEN, {
            commandId: ClockCreatorCommands.REFRESH_WORKSPACE_FILES.id,
            label: 'Refresh Workspace Files',
            order: '1'
        });
        menus.registerMenuAction(CommonMenus.FILE_SAVE, {
            commandId: ClockCreatorCommands.SAVE_AS_PROJECT.id,
            label: 'Save Clock Project As…',
            order: '1'
        });
        menus.registerMenuAction(CommonMenus.FILE_CLOSE, {
            commandId: ClockCreatorCommands.DELETE_PROJECT_FILE.id,
            label: 'Delete Project File',
            order: '9'
        });

        // —— Edit (Theia) ——
        menus.registerMenuAction(CommonMenus.EDIT_CLIPBOARD, {
            commandId: ClockCreatorCommands.DUPLICATE_NODE.id,
            label: 'Duplicate Node',
            order: '9'
        });
        menus.registerMenuAction(CommonMenus.EDIT_CLIPBOARD, {
            commandId: ClockCreatorCommands.DELETE_NODE.id,
            label: 'Delete Node',
            order: 'a'
        });

        // —— Clock Creator submenu ——
        menus.registerSubmenu(CLOCK_CREATOR_MENU, 'Clock Creator');

        const EXPORT_MENU = [...CLOCK_CREATOR_MENU, 'clock-creator-export'];
        menus.registerSubmenu(EXPORT_MENU, 'Export', { sortString: '8' });

        const entries: Array<{ id: string; label?: string; order: string }> = [
            { id: ClockCreatorCommands.OPEN_WIDGET.id, label: 'Open Editor', order: '0' },
            { id: ClockCreatorCommands.OPEN_EXPLORER.id, label: 'Open Explorer', order: '1' },
            { id: ClockCreatorCommands.OPEN_PROPERTIES.id, label: 'Open Properties', order: '2' },
            { id: ClockCreatorCommands.NEW_PROJECT.id, label: 'New Clock Project', order: '3' },
            { id: ClockCreatorCommands.IMPORT_PROJECT.id, label: 'Open Clock Project', order: '4' },
            { id: ClockCreatorCommands.LOAD_SAMPLE.id, label: 'Load STM32 Sample', order: '5' },
            { id: ClockCreatorCommands.VALIDATE.id, label: 'Validate Clock Tree', order: '6' },
            { id: ClockCreatorCommands.CALCULATE_FREQUENCIES.id, label: 'Calculate Frequencies', order: '7' },
            { id: ClockCreatorCommands.SAVE_PROJECT.id, label: 'Save Clock Project', order: '9' },
            { id: ClockCreatorCommands.TOGGLE_EDITOR.id, label: 'Toggle JSON Editor', order: '10' },
            { id: ClockCreatorCommands.FIT_VIEW.id, label: 'Fit Diagram View', order: '11' }
        ];

        for (const entry of entries) {
            menus.registerMenuAction(CLOCK_CREATOR_MENU, {
                commandId: entry.id,
                label: entry.label,
                order: entry.order
            });
        }

        menus.registerMenuAction(EXPORT_MENU, {
            commandId: ClockCreatorCommands.EXPORT_PROJECT.id,
            label: 'Export Clock JSON',
            order: '0'
        });
        menus.registerMenuAction(EXPORT_MENU, {
            commandId: ClockCreatorCommands.EXPORT_DIAGRAM_PNG.id,
            label: 'Export Diagram as PNG',
            order: '1'
        });
        menus.registerMenuAction(EXPORT_MENU, {
            commandId: ClockCreatorCommands.EXPORT_DIAGRAM_JPG.id,
            label: 'Export Diagram as JPG',
            order: '2'
        });
        menus.registerMenuAction(EXPORT_MENU, {
            commandId: ClockCreatorCommands.EXPORT_DIAGRAM_SVG.id,
            label: 'Export Diagram as SVG',
            order: '3'
        });

        // —— Basculeur clair/sombre (icône bas de sidebar gauche) ——
        menus.registerMenuAction(CLOCK_THEME_MENU, {
            commandId: ClockCreatorCommands.TOGGLE_DARK_MODE.id,
            label: 'Basculer entre mode clair et sombre (tout le système)'
        });

        menus.registerMenuAction(CommonMenus.VIEW, {
            commandId: ClockCreatorCommands.OPEN_WIDGET.id,
            label: 'Clock Creator'
        });
    }

    protected async bootstrapWorkspaceFiles(): Promise<void> {
        try {
            const project = useClockStore.getState().project;
            await this.clockWorkspace.ensureDefaultClockJson(project);
            await this.refreshWorkspaceFiles();

            const files = useClockStore.getState().workspaceFiles;
            if (files.some((f) => f.name === 'clock.json')) {
                await this.openWorkspaceClockFile('clock.json');
            }
            // Explorer filesystem : uniquement après création de projet (pas au démarrage)
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            useClockStore.getState().pushLog(`Workspace bootstrap: ${message}`, 'warn');
        }
    }

    protected async refreshWorkspaceFiles(): Promise<void> {
        const files = await this.clockWorkspace.listClockFiles();
        useClockStore.getState().setWorkspaceFiles(files);
        useClockStore.getState().pushLog(
            files.length
                ? `Explorer: ${files.length} projet(s) — ${files.map((f) => f.name).join(', ')}`
                : 'Explorer: aucun fichier clock.json dans le workspace',
            'info'
        );
    }

    protected openNewProjectDialog(): void {
        const content = new ProjectNameContentWidget('clock');
        const dialog = new ClockCreatorProjectDialog(content, (request) => this.createClockProject(request));
        content.setBrowseHandler(() => void this.browseProjectFolder(content));
        content.update();
        this.attachDialogContentWiring(dialog);
        dialog.open();
    }

    protected openSaveAsDialog(): void {
        const content = new ProjectNameContentWidget('clock');
        const dialog = new ClockCreatorProjectDialog(content, async (request) => {
            const sanitized = sanitizeProjectName(request.name);
            if (!sanitized) throw new Error('Le nom du projet est invalide.');
            if (!request.folderUri) throw new Error('Choisissez un dossier.');

            const { projectDir, fileName } = await this.clockWorkspace.createProjectInFolder(
                request.folderUri,
                sanitized,
                useClockStore.getState().project
            );
            useClockStore.getState().setActiveProjectFile(fileName);
            useClockStore.getState().setActiveProjectFolder(projectDir.toString());
            await this.refreshWorkspaceFiles();
            this.messageService.info(`Projet enregistré sous « ${projectDir.path.toString()}/${fileName} ».`);
            this.clockWorkspace.openFolderAsWorkspace(projectDir);
        }, { title: 'Enregistrer le projet sous…', maxWidth: 520 });
        content.setBrowseHandler(() => void this.browseProjectFolder(content));
        content.update();
        this.attachDialogContentWiring(dialog);
        dialog.open();
    }

    /**
     * Point de départ du sélecteur : dossier utilisateur / Bureau / lecteur,
     * PAS le workspace actuel (sinon impossible de sortir de workspace/).
     */
    protected async resolveBrowseStartFolder(): Promise<FileStat | undefined> {
        const tryResolve = async (uri: URI): Promise<FileStat | undefined> => {
            try {
                if (await this.fileService.exists(uri)) {
                    return await this.fileService.resolve(uri);
                }
            } catch {
                /* ignore */
            }
            return undefined;
        };

        // 1) Bureau de l'utilisateur
        try {
            const home = new URI(await this.environments.getHomeDirUri());
            const desktop = await tryResolve(home.resolve('Desktop'))
                ?? await tryResolve(home.resolve('OneDrive').resolve('Desktop'))
                ?? await tryResolve(home.resolve('Documents'))
                ?? await tryResolve(home);
            if (desktop) {
                return desktop;
            }
        } catch {
            /* ignore */
        }

        // 2) Premier lecteur (ex. C:/) pour parcourir tout le PC
        try {
            const drives = await this.environments.getDrives();
            for (const drive of drives) {
                const stat = await tryResolve(new URI(drive));
                if (stat) {
                    return stat;
                }
            }
        } catch {
            /* ignore */
        }

        return undefined;
    }

    protected async browseProjectFolder(content: ProjectNameContentWidget): Promise<void> {
        try {
            // Ne pas utiliser le workspace courant comme racine (bloque la navigation)
            const start = await this.resolveBrowseStartFolder();
            const selected = await this.fileDialogService.showOpenDialog({
                title: 'Choisir le dossier du projet sur le PC',
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            }, start);

            if (!selected) {
                return;
            }
            const folderUri = Array.isArray(selected) ? selected[0] : selected;
            if (!folderUri) {
                return;
            }
            const label = folderUri.path.toString() || folderUri.toString();
            content.setFolder(folderUri.toString(), label);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            content.showError(`Impossible d'ouvrir le sélecteur de dossier : ${message}`);
        }
    }

    protected attachDialogContentWiring(dialog: AbstractDialog<unknown>): void {
        dialog.node.addEventListener('input', () => dialog.update());
    }

    protected async saveClockProject(options?: { silent?: boolean }): Promise<void> {
        const silent = options?.silent === true;
        const state = useClockStore.getState();
        const fileName = state.activeProjectFile || 'clock.json';
        const folder = state.activeProjectFolder;

        try {
            if (folder) {
                await this.clockWorkspace.writeProjectToFolder(folder, fileName, state.project);
            } else {
                await this.clockWorkspace.writeProject(fileName, state.project, false);
            }
            state.setActiveProjectFile(fileName);
            // localStorage only — pas de log "Project saved" bruyant en auto
            try {
                window.localStorage.setItem('clock_creator_saved', JSON.stringify(state.project));
            } catch {
                /* ignore */
            }
            await this.refreshWorkspaceFiles();
            await this.documentSync.openAndSyncProjectEditor();
            // Pas d'alerte MessageService : la sauvegarde (auto ou manuelle) est silencieuse
            if (!silent) {
                this.statusBar.setElement('clock-creator-save', {
                    text: `$(check) ${fileName} saved`,
                    alignment: StatusBarAlignment.RIGHT,
                    priority: 1
                });
                setTimeout(() => this.statusBar.removeElement('clock-creator-save'), 2000);
            }
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            try {
                window.localStorage.setItem('clock_creator_saved', JSON.stringify(state.project));
            } catch {
                /* ignore */
            }
            // Erreur réelle uniquement (pas pour l'auto-save silencieux)
            if (!silent) {
                this.messageService.warn(`Sauvegarde locale uniquement : ${message}`);
            }
        }
    }

    protected async createClockProject(request: ProjectCreateRequest): Promise<void> {
        const sanitized = sanitizeProjectName(request.name);
        if (!sanitized) {
            throw new Error('Le nom du projet est invalide.');
        }
        if (!request.folderUri) {
            throw new Error('Choisissez un dossier sur le PC.');
        }

        useClockStore.getState().createProject(sanitized);
        useClockStore.getState().setActiveProjectFile('clock.json');

        try {
            const { projectDir, fileName, fileUri } = await this.clockWorkspace.createProjectInFolder(
                request.folderUri,
                sanitized,
                useClockStore.getState().project
            );
            useClockStore.getState().setActiveProjectFile(fileName);
            useClockStore.getState().setActiveProjectFolder(projectDir.toString());
            await this.refreshWorkspaceFiles();
            this.messageService.info(
                `Projet créé : ${fileUri.path.toString()} — ouverture du workspace…`
            );
            // Ouvre le dossier projet dans l'Explorer filesystem Theia
            this.clockWorkspace.openFolderAsWorkspace(projectDir);
            await this.documentSync.openAndSyncProjectEditor();
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            throw new Error(message);
        }
    }

    /**
     * Ouvre l'Explorer Theia (fichier système / workspace) et sélectionne le projet créé.
     * À appeler uniquement après que l'UI est déjà affichée (jamais dans onStart).
     */
    protected async revealInFilesystemExplorer(fileName: string): Promise<void> {
        try {
            // Laisser le dialogue se fermer et le shell se stabiliser
            await new Promise<void>((resolve) => setTimeout(resolve, 50));

            const uri = await this.clockWorkspace.resolveProjectUri(fileName);
            if (!uri) {
                return;
            }

            let navigator = this.widgetManager.tryGetWidget<FileNavigatorWidget>(FILE_NAVIGATOR_ID);
            if (!navigator) {
                navigator = await this.widgetManager.getOrCreateWidget<FileNavigatorWidget>(FILE_NAVIGATOR_ID);
            }

            if (!navigator.isAttached) {
                this.shell.addWidget(navigator, { area: 'left', rank: 100 });
            }

            this.shell.activateWidget(navigator.id);

            await navigator.model.refresh();
            const node = await navigator.model.revealFile(uri);
            if (node && 'selected' in node) {
                navigator.model.selectNode(node as Parameters<typeof navigator.model.selectNode>[0]);
            }
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            useClockStore.getState().pushLog(`Reveal explorer: ${message}`, 'warn');
        }
    }

    /**
     * Ouvre un projet JSON via le sélecteur de fichiers Theia (fiable sous browser).
     * Remplace l'ancien dialogue + <input type=file> qui ne s'ouvrait pas depuis Welcome.
     */
    protected async openLoadProjectDialog(): Promise<void> {
        useClockStore.getState().setWelcomeVisible(false);

        try {
            const start = await this.resolveBrowseStartFolder();
            const selected = await this.fileDialogService.showOpenDialog({
                title: 'Ouvrir un projet Clock Creator',
                openLabel: 'Ouvrir',
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Clock JSON': ['json']
                }
            }, start);

            if (!selected) {
                return;
            }

            const uri = Array.isArray(selected) ? selected[0] : selected;
            if (!uri) {
                return;
            }

            const baseName = uri.path.base || uri.path.name || 'clock.json';
            const fileName = baseName.toLowerCase().endsWith('.json')
                ? baseName
                : `${baseName}.json`;

            const result = await this.fileService.read(uri);
            await this.importClockProject({
                text: result.value,
                fileName
            }, uri);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            this.messageService.error(`Ouverture impossible : ${message}`);
        }
    }

    protected async importClockProject(descriptor: ImportedDescriptor, sourceUri?: URI): Promise<void> {
        if (!isClockDescriptor(descriptor.text)) {
            throw new Error('Le fichier n\'est pas un descripteur d\'arbre d\'horloge JSON valide.');
        }

        const parsed = JSON.parse(descriptor.text) as unknown as ClockTreeFile;
        const fileName = descriptor.fileName.endsWith('.json')
            ? descriptor.fileName
            : `${descriptor.fileName}.json`;

        useClockStore.getState().importProject(fileName, parsed);
        useClockStore.getState().setActiveProjectFile(fileName);

        const folderUri = sourceUri ? sourceUri.parent.toString() : undefined;
        if (folderUri) {
            useClockStore.getState().setActiveProjectFolder(folderUri);
        }

        try {
            let writtenToWorkspace = false;
            if (folderUri) {
                await this.clockWorkspace.writeProjectToFolder(folderUri, fileName, parsed);
                writtenToWorkspace = true;

                // Le projet ouvert vit dans ce dossier : il devient le workspace Theia,
                // pour que l'Explorer et les sauvegardes suivantes s'y réfèrent.
                try {
                    this.clockWorkspace.openFolderAsWorkspace(folderUri);
                    await new Promise((resolve) => setTimeout(resolve, 300));
                } catch {
                    /* le dossier s'ouvrira quand même à la sauvegarde suivante */
                }
            } else {
                await this.clockWorkspace.writeProject(fileName, parsed, false);
                writtenToWorkspace = true;
            }

            if (writtenToWorkspace) {
                await this.refreshWorkspaceFiles();
                await this.revealInFilesystemExplorer(fileName);
            }
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            this.messageService.warn(`Import mémoire OK, écriture workspace échouée : ${message}`);
            await this.revealInFilesystemExplorer(fileName).catch(() => undefined);
        }
        this.messageService.info(`Projet « ${fileName} » ouvert.`);
        await this.documentSync.openAndSyncProjectEditor();
    }

    protected async openWorkspaceClockFile(fileName: string): Promise<void> {
        try {
            const { project, fileName: resolved } = await this.clockWorkspace.readProject(fileName);
            useClockStore.getState().importProject(resolved, project);
            useClockStore.getState().setActiveProjectFile(resolved);
            await this.documentSync.openAndSyncProjectEditor();
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            this.messageService.error(`Ouverture impossible : ${message}`);
        }
    }

    protected async deleteActiveProjectFile(): Promise<void> {
        const fileName = useClockStore.getState().activeProjectFile || 'clock.json';
        const confirmed = await new ConfirmDialog({
            title: 'Supprimer le projet',
            msg: `Supprimer définitivement « ${fileName} » du workspace ?`,
            ok: 'Supprimer',
            cancel: 'Annuler'
        }).open();
        if (!confirmed) {
            return;
        }
        try {
            await this.clockWorkspace.deleteProject(fileName);
            useClockStore.getState().closeFile(fileName);
            await this.refreshWorkspaceFiles();
            this.messageService.info(`Fichier « ${fileName} » supprimé du workspace.`);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            this.messageService.error(`Suppression impossible : ${message}`);
        }
    }
}
