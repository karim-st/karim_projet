import { ThemeService } from '@theia/core/lib/browser/theming';

let themeService: ThemeService | undefined;

export function bindTheiaThemeService(service: ThemeService): void {
    themeService = service;
}

export function applyTheiaTheme(darkMode: boolean): void {
    if (!themeService) {
        return;
    }
    const targetTheme = darkMode ? 'dark' : 'light';
    if (themeService.getCurrentTheme().id !== targetTheme) {
        themeService.setCurrentTheme(targetTheme, true);
    }
}