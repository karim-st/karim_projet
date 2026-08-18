import { injectable } from '@theia/core/shared/inversify';
import {
    KeybindingContribution,
    KeybindingRegistry,
    KeybindingContext
} from '@theia/core/lib/browser';
import { isClockMonacoFocused } from './monaco-ide-focus';

/**
 * Quand Monaco intégré a le focus, Theia ne doit PAS avaler les raccourcis IDE
 * (Ctrl+C/V/X/Z/F…). `passthrough` laisse l'événement atteindre Monaco.
 */
export const CLOCK_MONACO_KEYBINDING_CONTEXT: KeybindingContext = {
    id: 'clock.monaco.focus',
    isEnabled: () => isClockMonacoFocused()
};

const PASSTHROUGH = KeybindingRegistry.PASSTHROUGH_PSEUDO_COMMAND;
const CTX = CLOCK_MONACO_KEYBINDING_CONTEXT.id;

/** Raccourcis à laisser passer à Monaco (même principe qu'un IDE classique) */
const MONACO_PASSTHROUGH_KEYS = [
    'ctrlcmd+c',
    'ctrlcmd+v',
    'ctrlcmd+x',
    'ctrlcmd+a',
    'ctrlcmd+z',
    'ctrlcmd+y',
    'ctrlcmd+shift+z',
    'ctrlcmd+f',
    'ctrlcmd+h',
    'ctrlcmd+g',
    'ctrlcmd+d',
    'ctrlcmd+shift+k',
    'ctrlcmd+shift+o',
    'ctrlcmd+f2',
    'f1',
    'ctrlcmd+/',
    'ctrlcmd+[',
    'ctrlcmd+]',
    'ctrlcmd+s',
    'ctrlcmd+shift+i',
    'alt+up',
    'alt+down',
    'alt+shift+up',
    'alt+shift+down',
    'alt+shift+f',
    'ctrlcmd+alt+up',
    'ctrlcmd+alt+down',
    'del',
    'backspace',
    'space'
];

@injectable()
export class ClockMonacoKeybindingContribution implements KeybindingContribution {
    registerKeybindings(registry: KeybindingRegistry): void {
        for (const keybinding of MONACO_PASSTHROUGH_KEYS) {
            registry.registerKeybinding({
                command: PASSTHROUGH,
                keybinding,
                context: CTX
            });
        }
    }
}
