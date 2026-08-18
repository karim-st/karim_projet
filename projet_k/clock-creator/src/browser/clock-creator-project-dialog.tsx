import * as React from 'react';
import { AbstractDialog, DialogError, DialogProps } from '@theia/core/lib/browser/dialogs';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { PROJECT_NAME_INVALID_CHARS, sanitizeProjectName } from './store/clockStore';

export type ProjectCreateRequest = {
  name: string;
  /** URI file:///… du dossier choisi sur le PC */
  folderUri: string;
};

export function validateProjectNameInput(raw: string): string | null {
  const name = String(raw ?? '');
  if (!name.trim()) return 'Saisissez un nom de projet.';
  if (PROJECT_NAME_INVALID_CHARS.test(name)) {
    return 'Le nom contient des caractères non valides dans un nom de fichier (< > : " / \\ | ? *).';
  }
  if (!sanitizeProjectName(name)) {
    return 'Saisissez un nom de projet.';
  }
  return null;
}

export function validateProjectFolder(folderUri: string): string | null {
  if (!String(folderUri ?? '').trim()) {
    return 'Choisissez un dossier sur le PC pour enregistrer le projet.';
  }
  return null;
}

interface ProjectNameFormProps {
  value: string;
  folderLabel: string;
  busy: boolean;
  errorMessage: string;
  onChange: (value: string) => void;
  onBrowseFolder: () => void;
  onEnter: () => void;
}

function ProjectNameForm({
  value,
  folderLabel,
  busy,
  errorMessage,
  onChange,
  onBrowseFolder,
  onEnter
}: ProjectNameFormProps): React.ReactElement {
  const nameInvalid = validateProjectNameInput(value) !== null;
  const folderInvalid = validateProjectFolder(folderLabel) !== null;

  return (
    <div className="clock-creator-dialog">
      <p className="mb-3 text-sm text-gray-600">
        Créez un projet local : cliquez sur <strong>Parcourir…</strong> pour choisir
        un dossier sur votre PC (Bureau, Documents, autre lecteur…).
        Utilisez la flèche ↑ ou la liste de chemins pour changer de dossier.
      </p>

      <label className="mb-1 block text-xs font-semibold text-gray-700" htmlFor="clock-creator-project-name">
        Nom du projet
      </label>
      <input
        id="clock-creator-project-name"
        type="text"
        className={`h-9 w-full rounded-md border px-3 text-sm outline-none transition focus:ring-2 ${
          nameInvalid
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-[#17146E] focus:ring-[#17146E]/20'
        }`}
        placeholder="Ex : mon_horloge"
        value={value}
        disabled={busy}
        autoFocus
        aria-invalid={nameInvalid}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter();
          }
        }}
      />

      <label className="mb-1 mt-3 block text-xs font-semibold text-gray-700" htmlFor="clock-creator-project-folder">
        Emplacement (dossier local)
      </label>
      <div className="flex gap-2">
        <input
          id="clock-creator-project-folder"
          type="text"
          readOnly
          className={`h-9 min-w-0 flex-1 rounded-md border px-3 text-sm outline-none ${
            folderInvalid ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'
          }`}
          placeholder="Aucun dossier sélectionné…"
          value={folderLabel}
          disabled={busy}
          aria-invalid={folderInvalid}
        />
        <button
          type="button"
          disabled={busy}
          className="h-9 shrink-0 rounded-md bg-[#17146E] px-3 text-xs font-semibold text-white hover:bg-[#1f1a8a] disabled:opacity-50"
          onClick={onBrowseFolder}
        >
          Parcourir…
        </button>
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-600" role="status">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#17146E] border-t-transparent" aria-hidden="true" />
          Création du projet sur le disque…
        </div>
      )}

      {!busy && errorMessage && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {errorMessage}
        </div>
      )}

      {!busy && !errorMessage && (
        <p className="mt-2 text-[11px] text-gray-500">
          Structure : <code>{folderLabel || '<dossier>'}/{'{nom}'}/clock.json</code>
        </p>
      )}
    </div>
  );
}

export class ProjectNameContentWidget extends ReactWidget {
  protected inputValue = 'clock';
  protected folderUri = '';
  protected folderLabel = '';
  protected busy = false;
  protected errorMessage = '';
  protected enterHandler: () => void = () => {};
  protected valueChangeHandler: () => void = () => {};
  protected browseHandler: () => void = () => {};

  constructor(initialName = 'clock') {
    super();
    this.id = 'clock-creator-project-name-content';
    this.addClass('clock-creator-dialog-content');
    this.inputValue = initialName;
  }

  get value(): string {
    return sanitizeProjectName(this.inputValue) ?? '';
  }

  get rawValue(): string {
    return this.inputValue;
  }

  get selectedFolderUri(): string {
    return this.folderUri;
  }

  get request(): ProjectCreateRequest {
    return {
      name: this.value,
      folderUri: this.folderUri
    };
  }

  setFolder(uri: string, label: string): void {
    this.folderUri = uri;
    this.folderLabel = label;
    this.clearError();
    this.update();
    this.valueChangeHandler();
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

  setValueChangeHandler(handler: () => void): void {
    this.valueChangeHandler = handler;
  }

  setBrowseHandler(handler: () => void): void {
    this.browseHandler = handler;
  }

  override render(): React.ReactElement {
    return (
      <ProjectNameForm
        value={this.inputValue}
        folderLabel={this.folderLabel}
        busy={this.busy}
        errorMessage={this.errorMessage}
        onChange={(next) => {
          this.inputValue = next
            .replace(/^ +/, '')
            .replace(/ {2,}/g, ' ');
          this.clearError();
          this.update();
          this.valueChangeHandler();
        }}
        onBrowseFolder={() => this.browseHandler()}
        onEnter={() => this.enterHandler()}
      />
    );
  }
}

export class ClockCreatorProjectDialog extends AbstractDialog<ProjectCreateRequest> {

  protected readonly content: ProjectNameContentWidget;
  protected readonly onCreate: (request: ProjectCreateRequest) => Promise<void>;

  constructor(
    content: ProjectNameContentWidget,
    onCreate: (request: ProjectCreateRequest) => Promise<void>,
    props: DialogProps = { title: 'Nouveau projet d’horloge', maxWidth: 520 }
  ) {
    super(props);
    this.content = content;
    this.onCreate = onCreate;
    this.contentNode.appendChild(content.node);
    this.appendAcceptButton('Créer le projet');
    this.appendCloseButton('Annuler');

    content.setValueChangeHandler(() => {
      void this.validate();
    });
    content.setEnterHandler(() => {
      if (this.acceptButton && !this.acceptButton.disabled) {
        void this.accept();
      }
    });

    queueMicrotask(() => {
      content.update();
      void this.validate();
    });
  }

  override get value(): ProjectCreateRequest {
    return this.content.request;
  }

  protected override async isValid(_value: ProjectCreateRequest, _mode: 'open' | 'preview'): Promise<DialogError> {
    const nameError = validateProjectNameInput(this.content.rawValue);
    if (nameError) {
      return { message: nameError, result: false };
    }
    const folderError = validateProjectFolder(this.content.selectedFolderUri);
    if (folderError) {
      return { message: folderError, result: false };
    }
    return true;
  }

  protected override async accept(): Promise<void> {
    const request = this.value;
    const nameError = validateProjectNameInput(this.content.rawValue);
    if (nameError) {
      this.setErrorMessage(nameError);
      return;
    }
    const folderError = validateProjectFolder(request.folderUri);
    if (folderError) {
      this.setErrorMessage(folderError);
      return;
    }

    this.content.setBusy(true);
    this.content.clearError();
    if (this.acceptButton) {
      this.acceptButton.disabled = true;
    }

    try {
      await this.onCreate(request);
    } catch (reason) {
      this.content.setBusy(false);
      if (this.acceptButton) {
        this.acceptButton.disabled = false;
      }
      const message = reason instanceof Error ? reason.message : String(reason);
      this.content.showError(`La création du projet a échoué : ${message}`);
      void this.validate();
      return;
    }

    this.content.setBusy(false);
    super.accept();
  }
}
