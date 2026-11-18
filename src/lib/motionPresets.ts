export const comicSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
};

export const comicEnter = {
  duration: 0.2,
  ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
};

export const reducedMotionTransition = {
  duration: 0.12,
  ease: "easeOut" as const,
};
