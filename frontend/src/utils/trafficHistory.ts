export interface SpeedPoint { up: number; down: number }
export const emptyTrafficHistory = () => Array.from({ length: 30 }, () => ({ up: 0, down: 0 }))
export function appendTraffic(history: SpeedPoint[], upload: number, download: number): SpeedPoint[] {
  const valid = (speed: number) => Number.isFinite(speed) ? Math.max(0, speed) : 0
  return [...history.slice(-29), { up: valid(upload), down: valid(download) }]
}
