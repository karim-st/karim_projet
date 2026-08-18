import * as React from 'react';
import { AbstractDialog, DialogError, DialogProps } from '@theia/core/lib/browser/dialogs';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';

/**
 * Fenêtre d'import d'un projet d'arbre d'horloge existant (spec §5.2).
 *
 * - saisie d'un chemin ou sélection d'un fichier unique ;
 * - vérification que le chemin n'est pas vide ;
 * - acceptation d'un descripteur au format JSON uniquement ;
 * - vérification que le fichier peut être lu (et copié) ;
 * - erreur affichée pour un chemin, un format ou une copie invalide ;
 * - fermeture de la fenêtre après un import réussi.
 */

export function validateProjectPathInput(path: string): string | null {
  const value = String(path ?? '').trim();
  if (!value) return 'Sélectionnez un fichier ou saisissez un chemin.';
  if (!value.toLowerCase().endsWith('.json')) {
    return 'Le descripteur doit être un fichier au format JSON (.json).';
  }
  return null;
}

export function isClockDescriptor(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') return false;
    const value = parsed as Record<string, unknown>;
    return Boolean(value.tree ?? value.nodes ?? value.elements);
  } catch {
    return false;
  }
}

interface LoadProjectFormProps {
  path: string;
  fileName: string | null;
  busy: boolean;
  errorMessage: string;
  onPathChange: (value: string) => void;
  onBrowse: () => void;
  onEnter: () => void;
}

function LoadProjectForm({
  path,
  fileName,
  busy,
  errorMessage,
  onPathChange,
  onBrowse,
  onEnter
}: LoadProjectFormProps): React.ReactElement {
  return (
    <div className="clock-creator-dialog">
      <p className="mb-3 text-sm text-gray-600">
        Importez un descripteur JSON existant ; il sera copié dans l'espace de travail.
      </p>

      <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="clock-creator-load-path">
        Chemin du descripteur
      </label>
      <div className="flex items-center gap-2">
        <input
          id="clock-creator-load-path"
          type="text"
          className="h-9 min-w-0 flex-1 rounded-md border border-gray-300 px-3 text-sm outline-none transition focus:border-[#17146E] focus:ring-2 focus:ring-[#17146E]/20"
          placeholder="C:\\chemin\\vers\\arbres\\projet.json"
          value={path}
          disabled={busy}
          onChange={(event) => onPathChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onEnter();
          }}
        />
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-[#17146E] shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={onBrowse}
        >
          Parcourir…
        </button>
      </div>

      {fileName && (
        <p className="mt-2 text-[11px] text-gray-500">
          Fichier sélectionné : <span className="font-medium text-gray-700">{fileName}</span>
        </p>
      )}

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600" role="status">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#17146E] border-t-transparent" aria-hidden="true" />
          Vérification et copie du descripteur…
        </div>
      )}

      {!busy && errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export class LoadProjectContentWidget extends ReactWidget {

  protected pathInput = '';
  protected selectedFile: File | null = null;
  protected busy = false;
  protected errorMessage = '';
  protected enterHandler: () => void = () => {};
  protected browseHandler: () => void = () => {};

  constructor() {
    super();
    this.id = 'clock-creator-load-project-content';
    this.addClass('clock-creator-dialog-content');
  }

  get value(): string {
    return this.pathInput;
  }

  get file(): File | null {
    return this.selectedFile;
  }

  setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    this.update();
  }

  showError(message: string): void {
    this.errorMessage = message;
    this.update();
  }

  clearError(): void {
    if (!this.errorMessage) return;
    this.errorMessage = '';
    this.update();
  }

  setEnterHandler(handler: () => void): void {
    this.enterHandler = handler;
  }

  setBrowseHandler(handler: () => void): void {
    this.browseHandler = handler;
  }

  setSelectedFile(file: File | null): void {
    this.selectedFile = file;
    this.pathInput = file?.name ?? this.pathInput;
    this.clearError();
    this.update();
  }

  override render(): React.ReactElement {
    return (
      <LoadProjectForm
        path={this.pathInput}
        fileName={this.selectedFile?.name ?? null}
        busy={this.busy}
        errorMessage={this.errorMessage}
        onPathChange={(next) => {
          this.pathInput = next;
          this.selectedFile = null;
          this.clearError();
          this.update();
        }}
        onBrowse={() => this.browseHandler()}
        onEnter={() => this.enterHandler()}
      />
    );
  }
}

export interface ImportedDescriptor {
  text: string;
  fileName: string;
}

export class ClockLoadOldProjectDialog extends AbstractDialog<string> {

  protected readonly content: LoadProjectContentWidget;
  protected readonly onImport: (descriptor: ImportedDescriptor) => Promise<void>;

  constructor(
    content: LoadProjectContentWidget,
    onImport: (descriptor: ImportedDescriptor) => Promise<void>,
    props: DialogProps = { title: 'Importer un projet existant', maxWidth: 460 }
  ) {
    super(props);
    this.content = content;
    this.onImport = onImport;
    this.contentNode.appendChild(content.node);
    this.appendAcceptButton('Importer');
    this.appendCloseButton('Annuler');
    content.setEnterHandler(() => {
      if (this.acceptButton && !this.acceptButton.disabled) {
        void this.accept();
      }
    });
  }

  override get value(): string {
    return this.content.value.trim();
  }

  /**
   * Déclenche l'import du fichier sélectionné (accept() est protégé dans
   * AbstractDialog, d'où ce point d'entrée public).
   */
  importSelectedFile(): void {
    void this.accept();
  }

  protected override async isValid(value: string, mode: 'open' | 'preview'): Promise<DialogError> {
    const error = validateProjectPathInput(value);
    if (error) return { message: error, result: false };
    return true;
  }

  protected override async accept(): Promise<void> {
    const path = this.value;
    const error = validateProjectPathInput(path);
    if (error) {
      this.setErrorMessage(error);
      return;
    }

    let text: string;
    let fileName: string;

    try {
      const file = this.content.file;
      if (file) {
        fileName = file.name;
        text = await file.text();
      } else {
        fileName = path.split(/[\\/]/).pop() ?? 'clock-tree.json';
        text = await this.onReadPath!(path);
      }
    } catch {
      this.content.showError(`Impossible de lire le fichier "${path}". Vérifiez que le chemin est correct.`);
      return;
    }

    if (!isClockDescriptor(text)) {
      this.content.showError('Le fichier sélectionné n\'est pas un descripteur d\'arbre d\'horloge valide (JSON attendu).');
      return;
    }

    this.content.setBusy(true);
    this.content.clearError();
    this.setErrorMessage(true);

    try {
      await this.onImport({ text, fileName });
    } catch (reason) {
      this.content.setBusy(false);
      const message = reason instanceof Error ? reason.message : String(reason);
      this.content.showError(`L'import a échoué : ${message}`);
      return;
    }

    this.content.setBusy(false);
    super.accept();
  }

  onReadPath?: (path: string) => Promise<string>;
}