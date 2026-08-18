import * as React from 'react';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { ExplorerPanel } from './components/ide/ExplorerPanel';
import { useClockStore } from './store/clockStore';

function ExplorerApp(): React.ReactElement {
    const darkMode = useClockStore((s) => s.darkMode);
    // Force explorer panel mode (ignore other ActivityBar tabs in this Theia view)
    React.useEffect(() => {
        useClockStore.getState().setActivePanel('explorer');
    }, []);

    return (
        <div className={`clock-creator-root h-full w-full ${darkMode ? 'dark' : ''}`}>
            <ExplorerPanel />
        </div>
    );
}

@injectable()
export class ClockExplorerWidget extends ReactWidget {

    static readonly ID = 'clock-creator:explorer';
    static readonly LABEL = 'Clock Projects';

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = ClockExplorerWidget.ID;
        this.node.id = 'clock-creator-explorer';
        this.title.label = ClockExplorerWidget.LABEL;
        this.title.caption = 'Projets clock.json du workspace';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-folder-open';
        this.addClass('clock-creator-explorer');
        this.update();
    }

    render(): React.ReactElement {
        return <ExplorerApp />;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }
}
