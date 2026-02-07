/**
 * 版本号展示截断规则：
 * - RCS/OPS：取前三段 A.B.C，如 "4.2.10.20250702103654" → "4.2.10"
 * - IWMS/WMS：取 A.B + C 的第一位，如 "4.1.2018.20260123140219" → "4.1.2"
 */
export type VersionComponent = 'rcs' | 'iwms' | 'ops';

export function formatVersionForDisplay(version: string | undefined, component: VersionComponent): string {
  if (!version || typeof version !== 'string') return version ?? '';
  const raw = version.trim();
  if (!raw) return raw;
  const segments = raw.split('.');
  if (component === 'iwms') {
    const a = segments[0] ?? '';
    const b = segments[1] ?? '';
    const cFirst = segments[2]?.charAt(0) ?? '';
    if (!a && !b && !cFirst) return raw;
    return [a, b, cFirst].filter(Boolean).join('.');
  }
  const firstThree = segments.slice(0, 3).filter(Boolean);
  return firstThree.length ? firstThree.join('.') : raw;
}
