import { injectable, inject } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { ClockTreeFile } from './types/clock';

export type WorkspaceClockFile = {
    name: string;
    uri: string;
    mtime?: number;
};

/**
 * Système de fichiers pour les descripteurs d'horloge (`*.json`)
 * dans le dossier workspace choisi par l'utilisateur.
 */
@injectable()
export class ClockWorkspaceService {

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    async getRootUri(): Promise<URI | undefined> {
        await this.workspaceService.ready;
        const roots = this.workspaceService.tryGetRoots();
        return roots[0]?.resource;
    }

    async resolveProjectUri(fileName: string, folderUri?: string): Promise<URI | undefined> {
        const safe = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        if (folderUri) {
            return new URI(folderUri).resolve(safe);
        }
        const root = await this.getRootUri();
        if (!root) return undefined;
        return root.resolve(safe);
    }

    async listClockFiles(): Promise<WorkspaceClockFile[]> {
        const root = await this.getRootUri();
        if (!root) return [];

        let stat: FileStat;
        try {
            stat = await this.fileService.resolve(root, { resolveMetadata: true });
        } catch {
            return [];
        }

        if (!stat.children) return [];

        return stat.children
            .filter((child) => !child.isDirectory && child.name.toLowerCase().endsWith('.json'))
            .map((child) => ({
                name: child.name,
                uri: child.resource.toString(),
                mtime: child.mtime
            }))
            .sort((a, b) => {
                if (a.name === 'clock.json') return -1;
                if (b.name === 'clock.json') return 1;
                return a.name.localeCompare(b.name);
            });
    }

    async readProject(fileName: string): Promise<{ fileName: string; text: string; project: ClockTreeFile }> {
        const uri = await this.resolveProjectUri(fileName);
        if (!uri) {
            throw new Error('Aucun dossier d\'espace de travail ouvert.');
        }
        const result = await this.fileService.read(uri);
        const project = JSON.parse(result.value) as ClockTreeFile;
        if (!project?.tree || !Array.isArray(project.tree.elements)) {
            throw new Error(`« ${fileName} » n'est pas un descripteur d'horloge valide.`);
        }
        return { fileName: uri.path.base, text: result.value, project };
    }

    async writeProject(fileName: string, project: ClockTreeFile, create = false): Promise<URI> {
        const uri = await this.resolveProjectUri(fileName);
        if (!uri) {
            throw new Error('Aucun dossier d\'espace de travail ouvert. Créez un projet en choisissant un dossier.');
        }
        return this.writeUri(uri, project, create);
    }

    /**
     * Écrit le projet dans un dossier absolu choisi par l'utilisateur.
     * Crée le sous-dossier `{parent}/{projectName}/clock.json`.
     */
    async createProjectInFolder(
        parentFolderUri: string,
        projectName: string,
        project: ClockTreeFile
    ): Promise<{ projectDir: URI; fileUri: URI; fileName: string }> {
        const parent = new URI(parentFolderUri);
        const projectDir = parent.resolve(projectName);

        if (!(await this.fileService.exists(projectDir))) {
            await this.fileService.createFolder(projectDir);
        }

        const fileName = 'clock.json';
        const fileUri = projectDir.resolve(fileName);
        await this.writeUri(fileUri, project, !(await this.fileService.exists(fileUri)));
        return { projectDir, fileUri, fileName };
    }

    async writeProjectToFolder(
        folderUri: string,
        fileName: string,
        project: ClockTreeFile
    ): Promise<URI> {
        const uri = await this.resolveProjectUri(fileName, folderUri);
        if (!uri) {
            throw new Error('Dossier invalide.');
        }
        return this.writeUri(uri, project, false);
    }

    protected async writeUri(uri: URI, project: ClockTreeFile, create: boolean): Promise<URI> {
        const content = JSON.stringify(project, null, 2);
        if (create) {
            if (await this.fileService.exists(uri)) {
                throw new Error(`Le fichier « ${uri.path.base} » existe déjà.`);
            }
            await this.fileService.create(uri, content);
        } else if (await this.fileService.exists(uri)) {
            await this.fileService.write(uri, content);
        } else {
            await this.fileService.create(uri, content);
        }
        return uri;
    }

    async deleteProject(fileName: string): Promise<void> {
        const uri = await this.resolveProjectUri(fileName);
        if (!uri) {
            throw new Error('Aucun dossier d\'espace de travail ouvert.');
        }
        if (!(await this.fileService.exists(uri))) {
            throw new Error(`Le fichier « ${fileName} » est introuvable.`);
        }
        await this.fileService.delete(uri);
    }

    /**
     * Ouvre le dossier choisi comme workspace Theia (Explorer filesystem).
     */
    openFolderAsWorkspace(folderUri: string | URI): void {
        const uri = typeof folderUri === 'string' ? new URI(folderUri) : folderUri;
        this.workspaceService.open(uri, { preserveWindow: true });
    }

    async ensureDefaultClockJson(_seed: ClockTreeFile): Promise<boolean> {
        // Plus de seed automatique : le projet est créé quand l'utilisateur choisit un dossier.
        return false;
    }
}
