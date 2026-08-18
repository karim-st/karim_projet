import { injectable } from '@theia/core/shared/inversify';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser';
import { ClockCreatorCommands } from './clock-creator-commands';

/**
 * Raccourcis des commandes Clock Creator.
 * Combinaisons « ctrlcmd+alt+… » / « ctrlcmd+shift+… » volontairement choisies
 * pour ne pas entrer en conflit avec les raccourcis Theia ni le passthrough Monaco.
 */
const KEYBINDINGS: Array<{ command: string; keybinding: string }> = [
    { command: ClockCreatorCommands.OPEN_WIDGET.id, keybinding: 'ctrlcmd+alt+o' },
    { command: ClockCreatorCommands.NEW_PROJECT.id, keybinding: 'ctrlcmd+alt+n' },
    { command: ClockCreatorCommands.IMPORT_PROJECT.id, keybinding: 'ctrlcmd+alt+i' },
    { command: ClockCreatorCommands.SAVE_PROJECT.id, keybinding: 'ctrlcmd+alt+s' },
    { command: ClockCreatorCommands.EXPORT_PROJECT.id, keybinding: 'ctrlcmd+alt+e' },
    { command: ClockCreatorCommands.TOGGLE_EDITOR.id, keybinding: 'ctrlcmd+alt+j' },
    { command: ClockCreatorCommands.VALIDATE.id, keybinding: 'ctrlcmd+alt+v' },
    { command: ClockCreatorCommands.CALCULATE_FREQUENCIES.id, keybinding: 'ctrlcmd+alt+c' },
    { command: ClockCreatorCommands.LOAD_SAMPLE.id, keybinding: 'ctrlcmd+alt+l' },
    { command: ClockCreatorCommands.FIT_VIEW.id, keybinding: 'ctrlcmd+alt+f' },
    { command: ClockCreatorCommands.DUPLICATE_NODE.id, keybinding: 'ctrlcmd+shift+d' },
    { command: ClockCreatorCommands.DELETE_NODE.id, keybinding: 'ctrlcmd+alt+x' }
];

@injectable()
export class ClockCreatorKeybindingContribution implements KeybindingContribution {
    registerKeybindings(registry: KeybindingRegistry): void {
        for (const { command, keybinding } of KEYBINDINGS) {
            registry.registerKeybinding({ command, keybinding });
        }
    }
}