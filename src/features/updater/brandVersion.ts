export type BrandVersionParts = {
  current: string;
  next: string | null;
};

/** Pure helper for the nav brand version line. */
export function getBrandVersionParts(
  currentVersion: string | null,
  availableVersion: string | null | undefined,
): BrandVersionParts | null {
  if (!currentVersion) return null;
  const next =
    availableVersion && availableVersion !== currentVersion ? availableVersion : null;
  return { current: currentVersion, next };
}
