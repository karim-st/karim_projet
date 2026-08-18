import { Command } from '@theia/core/lib/common/command';
import type { MenuPath } from '@theia/core/lib/common/menu';
import type { CommandName } from './store/clockStore';

/** Menu contextuel du basculeur clair/sombre (icône en bas de la sidebar gauche). */
export const CLOCK_THEME_MENU: MenuPath = ['clock-creator-theme'];

export namespace ClockCreatorCommands {
    export const OPEN_WIDGET: Command = {
        id: 'clock-creator:open',
        label: 'Open Clock Creator'
    };

    export const OPEN_PROPERTIES: Command = {
        id: 'clock-creator:open-properties',
        label: 'Open Clock Properties'
    };

    export const OPEN_EXPLORER: Command = {
        id: 'clock-creator:open-explorer',
        label: 'Open Clock Explorer'
    };

    export const NEW_PROJECT: Command = {
        id: 'clock-creator:new-project',
        label: 'New Clock Project',
        category: 'Clock Creator'
    };

    export const CREATE_PROJECT: Command = {
        id: 'clock-creator:create-project',
        label: 'Create Project',
        category: 'Clock Creator'
    };

    export const IMPORT_PROJECT: Command = {
        id: 'clock-creator:import-project',
        label: 'Open Clock Project',
        category: 'Clock Creator'
    };

    export const SAVE_PROJECT: Command = {
        id: 'clock-creator:save-project',
        label: 'Save Clock Project',
        category: 'Clock Creator'
    };

    export const SAVE_AS_PROJECT: Command = {
        id: 'clock-creator:save-as-project',
        label: 'Save Clock Project As',
        category: 'Clock Creator'
    };

    export const DELETE_PROJECT_FILE: Command = {
        id: 'clock-creator:delete-project-file',
        label: 'Delete Project File',
        category: 'Clock Creator'
    };

    export const REFRESH_WORKSPACE_FILES: Command = {
        id: 'clock-creator:refresh-workspace-files',
        label: 'Refresh Workspace Files',
        category: 'Clock Creator'
    };

    export const VALIDATE: Command = {
        id: 'clock-creator:validate',
        label: 'Validate Clock Tree',
        category: 'Clock Creator'
    };

    export const CALCULATE_FREQUENCIES: Command = {
        id: 'clock-creator:calculate-frequencies',
        label: 'Calculate Frequencies',
        category: 'Clock Creator'
    };

    export const EXPORT_PROJECT: Command = {
        id: 'clock-creator:export',
        label: 'Export Clock JSON',
        category: 'Clock Creator'
    };

    export const EXPORT_DIAGRAM_PNG: Command = {
        id: 'clock-creator:export-diagram-png',
        label: 'Export Diagram as PNG',
        category: 'Clock Creator'
    };

    export const EXPORT_DIAGRAM_JPG: Command = {
        id: 'clock-creator:export-diagram-jpg',
        label: 'Export Diagram as JPG',
        category: 'Clock Creator'
    };

    export const EXPORT_DIAGRAM_SVG: Command = {
        id: 'clock-creator:export-diagram-svg',
        label: 'Export Diagram as SVG',
        category: 'Clock Creator'
    };

    export const LOAD_SAMPLE: Command = {
        id: 'clock-creator:load-sample',
        label: 'Load STM32 Sample',
        category: 'Clock Creator'
    };

export const TOGGLE_EDITOR: Command = {
        id: 'clock-creator:toggle-editor',
        label: 'Toggle Editor'
    };

    export const TOGGLE_DARK_MODE: Command = {
        id: 'clock-creator:toggle-dark-mode',
        label: 'Toggle Dark / Light Mode',
        category: 'Clock Creator'
    };

    export const FIT_VIEW: Command = {
        id: 'clock-creator:fit-view',
        label: 'Fit Diagram View',
        category: 'Clock Creator'
    };

    export const DUPLICATE_NODE: Command = {
        id: 'clock-creator:duplicate-node',
        label: 'Duplicate Node',
        category: 'Clock Creator'
    };

    export const DELETE_NODE: Command = {
        id: 'clock-creator:delete-node',
        label: 'Delete Node',
        category: 'Clock Creator'
    };

    export const STORE_COMMANDS: Array<{ command: Command; storeCmd: CommandName }> = [
        { command: VALIDATE, storeCmd: 'validateProject' },
        { command: CALCULATE_FREQUENCIES, storeCmd: 'calculateFrequencies' },
        { command: EXPORT_PROJECT, storeCmd: 'exportProject' },
        { command: LOAD_SAMPLE, storeCmd: 'loadSampleStm32' },
        { command: FIT_VIEW, storeCmd: 'fitView' }
    ];
}

export const CLOCK_CREATOR_MENU = ['clock-creator'];
