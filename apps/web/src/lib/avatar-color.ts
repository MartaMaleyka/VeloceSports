/** Color estable derivado del nombre (HSL) para avatares de iniciales. */
export function avatarColorFromName(name: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue} 62% 42%)`,
    fg: '#ffffff',
  };
}
