import { ContainerModule } from '@theia/core/shared/inversify';
import { ClockCreatorWidget } from './clock-creator-widget';
import { ClockPropertiesWidget } from './clock-properties-widget';
import { ClockExplorerWidget } from './clock-explorer-widget';
import { ClockCreatorContribution } from './clock-creator-contribution';
import { ClockPropertiesContribution } from './clock-properties-contribution';
import { ClockExplorerContribution } from './clock-explorer-contribution';
import { ClockWorkspaceService } from './clock-workspace-service';
import { ClockDocumentSyncService } from './clock-document-sync';
import {
    ClockMonacoKeybindingContribution,
    CLOCK_MONACO_KEYBINDING_CONTEXT
} from './clock-monaco-keybinding-contribution';
import { ClockCreatorKeybindingContribution } from './clock-creator-keybinding-contribution';
import {
    bindViewContribution,
    FrontendApplicationContribution,
    KeybindingContribution,
    KeybindingContext,
    WidgetFactory
} from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';
import '../../src/browser/style/tailwind.css';
import 'reactflow/dist/style.css';

export default new ContainerModule(bind => {
    bind(ClockWorkspaceService).toSelf().inSingletonScope();
    bind(ClockDocumentSyncService).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(ClockDocumentSyncService);

    // Laisse Monaco gérer Ctrl+C/V/Z/F… (Theia passthrough)
    bind(KeybindingContext).toConstantValue(CLOCK_MONACO_KEYBINDING_CONTEXT);
    bind(ClockMonacoKeybindingContribution).toSelf().inSingletonScope();
    bind(KeybindingContribution).toService(ClockMonacoKeybindingContribution);

    bind(ClockCreatorKeybindingContribution).toSelf().inSingletonScope();
    bind(KeybindingContribution).toService(ClockCreatorKeybindingContribution);

    bindViewContribution(bind, ClockCreatorContribution);
    bind(FrontendApplicationContribution).toService(ClockCreatorContribution);

    bindViewContribution(bind, ClockPropertiesContribution);
    bind(FrontendApplicationContribution).toService(ClockPropertiesContribution);

    bindViewContribution(bind, ClockExplorerContribution);
    bind(FrontendApplicationContribution).toService(ClockExplorerContribution);

    bind(ClockCreatorWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ClockCreatorWidget.ID,
        createWidget: () => ctx.container.get<ClockCreatorWidget>(ClockCreatorWidget)
    })).inSingletonScope();

    bind(ClockPropertiesWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ClockPropertiesWidget.ID,
        createWidget: () => ctx.container.get<ClockPropertiesWidget>(ClockPropertiesWidget)
    })).inSingletonScope();

    bind(ClockExplorerWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ClockExplorerWidget.ID,
        createWidget: () => ctx.container.get<ClockExplorerWidget>(ClockExplorerWidget)
    })).inSingletonScope();
});
