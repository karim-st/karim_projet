import { injectable } from '@theia/core/shared/inversify';
import { MenuModelRegistry, CommandRegistry } from '@theia/core';
import { AbstractViewContribution, FrontendApplication } from '@theia/core/lib/browser';
import { ClockPropertiesWidget } from './clock-properties-widget';
import { ClockCreatorCommands } from './clock-creator-commands';

@injectable()
export class ClockPropertiesContribution extends AbstractViewContribution<ClockPropertiesWidget> {

    constructor() {
        super({
            widgetId: ClockPropertiesWidget.ID,
            widgetName: ClockPropertiesWidget.LABEL,
            defaultWidgetOptions: { area: 'right' },
            toggleCommandId: ClockCreatorCommands.OPEN_PROPERTIES.id
        });
    }

    async initializeLayout(_app: FrontendApplication): Promise<void> {
        await this.openView({ activate: false, reveal: true });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(ClockCreatorCommands.OPEN_PROPERTIES, {
            execute: () => this.openView({ activate: true, reveal: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        void menus;
    }
}
