import * as React from 'react';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser';
import { ClockCreatorApp } from './ClockCreatorApp';

class ClockCreatorErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): { error: Error } {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        if (info.componentStack) {
            (error as Error & { componentStack?: string }).componentStack = info.componentStack;
            this.setState({ error });
        }
    }

    render(): React.ReactNode {
        if (this.state.error) {
            return (
                <div className="clock-creator-root flex h-full w-full flex-col items-center justify-center gap-3 bg-white p-8 text-left dark:bg-[#0d1420]">
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">
                        Erreur d&apos;interface — Clock Creator
                    </div>
                    <pre className="max-h-72 w-full max-w-3xl overflow-auto whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {this.state.error.message}
                        {'\n\n'}
                        {(this.state.error as Error & { componentStack?: string }).componentStack ?? this.state.error.stack}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

@injectable()
export class ClockCreatorWidget extends ReactWidget {

    static readonly ID = 'clock-creator:widget';
    static readonly LABEL = 'Clock Creator';

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = ClockCreatorWidget.ID;
        this.node.id = 'clock-creator-widget';
        this.node.tabIndex = 0;
        this.node.setAttribute('role', 'main');
        this.title.label = ClockCreatorWidget.LABEL;
        this.title.caption = 'STM32 Clock Tree Editor';
        this.title.closable = true;
        this.title.iconClass = 'fa clock-creator-icon';
        this.addClass('clock-creator-widget');
        this.update();
    }

    render(): React.ReactElement {
        return (
            <ClockCreatorErrorBoundary>
                <ClockCreatorApp />
            </ClockCreatorErrorBoundary>
        );
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const monacoInput = this.node.querySelector<HTMLElement>(
            '.clock-monaco-host textarea, .clock-monaco-host .inputarea, .clock-monaco-host [contenteditable="true"]'
        );
        const focusTarget = monacoInput
            ?? this.node.querySelector<HTMLElement>('textarea, input')
            ?? this.node;
        focusTarget.focus();
    }
}
