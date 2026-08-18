import * as React from 'react';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { InfoPanel } from './components/layout/InfoPanel';
import { Toaster } from 'sonner';
import { useClockStore } from './store/clockStore';

function PropertiesApp(): React.ReactElement {
    const darkMode = useClockStore((s) => s.darkMode);
    return (
        <div className={`clock-creator-root ${darkMode ? 'dark' : ''}`}>
            <Toaster richColors position="top-right" />
            <InfoPanel />
        </div>
    );
}

@injectable()
export class ClockPropertiesWidget extends ReactWidget {

    static readonly ID = 'clock-creator:properties';
    static readonly LABEL = 'Clock Properties';

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = ClockPropertiesWidget.ID;
        this.node.id = 'clock-creator-properties';
        this.title.label = ClockPropertiesWidget.LABEL;
        this.title.caption = ClockPropertiesWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-sliders';
        this.update();
    }

    render(): React.ReactElement {
        return <PropertiesApp />;
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }
}
