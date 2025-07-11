export const PianoTheme = {
    natural: {
        shadow: '#d0d0d0',
        defaultBase: '#f8f8f8',
        border: '#000000',
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