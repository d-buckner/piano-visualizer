export const PianoTheme = {
    natural: {
        shadow: '#9ca3af',
        defaultBase: '#eceff3',
        border: '#111827',
    },
    accidental: {
        deepShadow: '#0a0a0a',
        secondaryShadow: '#151515',
        mainBody: '#1a1a1a',
        defaultSurface: '#2d2d2d',
        leftBevel: '#353535',
        rightBevel: '#303030',
    },
} as const;

export type PianoThemeType = typeof PianoTheme;
