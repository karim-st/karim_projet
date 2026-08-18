# Clock Creator — Eclipse Theia Extension

Yeoman-generated Theia monorepo that ports the STM32 **Clock Creator** React IDE into Eclipse Theia.

## Structure

```
projet-st/
├── package.json              # Lerna / npm workspaces root
├── workspace/                # Projets utilisateur (clock.json) — ouvert par Theia
├── browser-app/              # Theia browser application
├── electron-app/             # Theia electron application
├── clock-creator/            # Theia extension (ported sources)
│   └── src/browser/
│       ├── ClockCreatorApp.tsx
│       ├── clock-creator-widget.tsx
│       ├── clock-properties-widget.tsx
│       ├── clock-explorer-widget.tsx
│       ├── clock-workspace-service.ts
│       ├── clock-creator-contribution.ts
│       ├── components/       # React UI (diagram, forms, ide, layout, …)
│       ├── store/            # Zustand clock store
│       ├── types/ utils/ hooks/ data/
│       └── style/
└── components/ …             # Original source folders (reference)
```

## Theia mapping

| Original React chrome | Theia replacement |
|----------------------|-------------------|
| `MenuBar` File / Edit | Menus Theia **File** / **Edit** (+ **Clock Creator**) |
| `ActivityBar` / `ExplorerPanel` | Vue gauche **Clock Projects** (`workspace/*.json`) |
| `InfoPanel` | Right view `Clock Properties` |
| `MainTabs` / window chrome | Theia shell tabs |
| `BottomBar` | Status bar (`MX2 Clock Creator`) |
| `Workspace` + diagram + Monaco | Main widget `Clock Creator` |

Domain logic (`store`, `utils`, `types`, React Flow nodes) is preserved inside the extension.

## Commands

- `Clock Creator: Open Clock Creator`
- `New Clock Project` / `Load STM32 Sample`
- `Validate Clock Tree` / `Calculate Frequencies`
- `Export Clock JSON` / `Toggle JSON Editor`

## Extensions Theia ajoutées

Search, Outline, Output, Console, Keymaps, SCM, Debug, Task, File Search, Mini Browser, Property View, Bulk Edit (+ `terser-webpack-plugin`).

Le démarrage ouvre Theia sans dossier forcé ; le workspace est choisi à la création de projet.

Les versions Theia sont alignées via `overrides` (npm) sur **1.74.1** dans le `package.json` racine — équivalent Yarn `resolutions`.

## Develop

On Windows without Visual Studio C++ build tools, native modules (Electron / `drivelist`) can fail. This repo sets `ignore-scripts=true` in `.npmrc` so `npm install` succeeds for the browser target.

```bash
npm install --ignore-scripts
npm run build:extension
npm run build:browser
npm run start:browser
```

Ouvrir : **http://127.0.0.1:3000**

- **Explorer** (Clock Projects) : fichiers `*.json` du dossier `workspace/` (ex. `clock.json`)
- **File** : New / Open / Save / Save As / Export / Delete Project File
- **Edit** : Duplicate Node / Delete Node
- Status bar: **MX2 Clock Creator**

Yeoman (`yo` + `generator-theia-extension`) gère le squelette Theia du monorepo.
