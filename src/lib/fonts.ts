import fs from 'node:fs';
import path from 'node:path';
import fontData from '../content/fonts.json';

const fontsDir = path.join(process.cwd(), 'public', 'fonts');
const FORMATS: [ext: string, format: string][] = [
  ['woff2', 'woff2'],
  ['woff', 'woff'],
  ['otf', 'opentype'],
  ['ttf', 'truetype'],
];

export interface FontFile {
  url: string;
  format: string;
  name: string;
}

/** First file in /public/fonts matching one of the names, in any supported format. */
export function findFontFile(names: string[]): FontFile | undefined {
  for (const name of names) {
    for (const [ext, format] of FORMATS) {
      const file = `${name}.${ext}`;
      if (fs.existsSync(path.join(fontsDir, file))) return { url: `/fonts/${encodeURI(file)}`, format, name: file };
    }
  }
  return undefined;
}

export const fonts = fontData.fonts;

/** True when the real display font (Rushford Printed) has been added. */
export const hasDisplayFont = () => {
  const display = fonts.find((f) => f.cssVar === '--ff-display');
  return !!display?.files.some((f) => findFontFile(f.names));
};
