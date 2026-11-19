export type Chart = { type: 'bar' | 'line'; title: string; unit?: string; labels: string[]; series: { name: string; values: number[] }[] }

export function parseChart(text: string): Chart | null {
  try {
    const c = JSON.parse(text)
    if (!c || !['bar', 'line'].includes(c.type) || typeof c.title !== 'string' || c.title.length > 200 ||
      (c.unit !== undefined && (typeof c.unit !== 'string' || c.unit.length > 30)) ||
      !Array.isArray(c.labels) || c.labels.length < 1 || c.labels.length > 40 || !c.labels.every((l: unknown) => typeof l === 'string' && l.length <= 100) ||
      !Array.isArray(c.series) || !c.series.length || c.series.length > 4 || !c.series.every((s: Chart['series'][number]) =>
        s && typeof s.name === 'string' && s.name.length <= 100 && Array.isArray(s.values) && s.values.length === c.labels.length &&
        s.values.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12))) return null
    return c
  } catch { return null }
}
