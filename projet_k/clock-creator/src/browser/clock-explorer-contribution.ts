import { injectable } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry } from '@theia/core';
import { AbstractViewContribution, FrontendApplication, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { ClockExplorerWidget } from './clock-explorer-widget';
import { ClockCreatorCommands } from './clock-creator-commands';

@injectable()
export class ClockExplorerContribution extends AbstractViewContribution<ClockExplorerWidget> implements FrontendApplicationContribution {

    constructor() {
        super({
            widgetId: ClockExplorerWidget.ID,
            widgetName: ClockExplorerWidget.LABEL,
            // Rank > File Navigator (100) pour ne pas masquer l'Explorer filesystem
            defaultWidgetOptions: { area: 'left', rank: 250 },
            toggleCommandId: ClockCreatorCommands.OPEN_EXPLORER.id
        });
    }

    async initializeLayout(_app: FrontendApplication): Promise<void> {
        // Vue visible par défaut dans la sidebar gauche : elle contient le basculeur clair/sombre.
        await this.openView({ activate: true, reveal: true });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ClockCreatorCommands.OPEN_EXPLORER, {
            execute: () => this.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, {
            commandId: ClockCreatorCommands.OPEN_EXPLORER.id,
            label: 'Clock Projects',
            order: '1'
        });
    }
}
