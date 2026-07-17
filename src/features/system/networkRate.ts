/** Shared rate rules mirrored by the Rust collector. */
export function bytesPerSecond(
  previousTotal: number,
  currentTotal: number,
  elapsedSeconds: number,
): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  if (!Number.isFinite(previousTotal) || !Number.isFinite(currentTotal)) return 0;
  if (currentTotal < previousTotal) return 0;
  return Math.round((currentTotal - previousTotal) / elapsedSeconds);
}
