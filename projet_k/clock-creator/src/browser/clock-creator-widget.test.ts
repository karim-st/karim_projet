import 'reflect-metadata';
import { ContainerModule, Container } from '@theia/core/shared/inversify';
import { ClockCreatorWidget } from './clock-creator-widget';
import { render } from '@testing-library/react';
import { act } from 'react';

describe('ClockCreatorWidget', () => {

    let widget: ClockCreatorWidget;

    beforeEach(async () => {
        const module = new ContainerModule(bind => {
            bind(ClockCreatorWidget).toSelf();
        });
        const container = new Container();
        container.load(module);
        await act(async () => {
            widget = container.resolve<ClockCreatorWidget>(ClockCreatorWidget);
        });
    });

    it('should render Clock Creator app', async () => {
        const element = render(widget.render());
        expect(element.container.querySelector('.clock-creator-root')).toBeTruthy();
    });

    it('should expose widget metadata', () => {
        expect(ClockCreatorWidget.ID).toBe('clock-creator:widget');
        expect(ClockCreatorWidget.LABEL).toBe('Clock Creator');
    });

});
