import type { TabsOptions as Options } from '@/types';

export function resolveOptions(
  defaults: Options,
  source: Partial<Options>,
): Options {
  const merged = {
    ...defaults,
    ...source,
    animation: {
      content: {
        ...defaults.animation.content,
        ...(source.animation?.content ?? {}),
      },
      indicator: {
        ...defaults.animation.indicator,
        ...(source.animation?.indicator ?? {}),
      },
    },
    selector: { ...defaults.selector, ...(source.selector ?? {}) },
  };
  const animation = merged.animation;
  const mergedContentAnimation = animation.content;
  const defaultContentAnimation = defaults.animation.content;

  if (typeof mergedContentAnimation.crossFade !== 'boolean') {
    const crossFade = defaultContentAnimation.crossFade;
    console.warn(
      `Invalid content animation crossFade option. Fallback: ${crossFade}.`,
    );
    mergedContentAnimation.crossFade = crossFade;
  }

  const contentDuration = mergedContentAnimation.duration;

  if (typeof contentDuration !== 'number' || Number.isNaN(contentDuration)) {
    const duration = defaultContentAnimation.duration;
    console.warn(
      `Invalid content animation duration. Fallback: ${duration} (ms).`,
    );
    mergedContentAnimation.duration = duration;
  }

  if (contentDuration < 0) {
    console.warn('Invalid content animation duration. Fallback: 0 (ms).');
    mergedContentAnimation.duration = 0;
  }

  if (
    !CSS.supports('animation-timing-function', mergedContentAnimation.easing)
  ) {
    const easing = defaultContentAnimation.easing;
    console.warn(`Invalid content animation easing. Fallback: '${easing}'.`);
    mergedContentAnimation.easing = easing;
  }

  if (typeof mergedContentAnimation.fade !== 'boolean') {
    const fade = defaultContentAnimation.fade;
    console.warn(`Invalid content animation fade option. Fallback: ${fade}.`);
    mergedContentAnimation.fade = fade;
  }

  const mergedIndicatorAnimation = animation.indicator;
  const indicatorDuration = mergedIndicatorAnimation.duration;
  const defaultIndicatorAnimation = defaults.animation.indicator;

  if (
    typeof indicatorDuration !== 'number' ||
    Number.isNaN(indicatorDuration)
  ) {
    const duration = defaultIndicatorAnimation.duration;
    console.warn(
      `Invalid indicator animation duration. Fallback: ${duration} (ms).`,
    );
    mergedIndicatorAnimation.duration = duration;
  }

  if (indicatorDuration < 0) {
    console.warn('Invalid indicator animation duration. Fallback: 0 (ms).');
    mergedIndicatorAnimation.duration = 0;
  }

  if (
    !CSS.supports('animation-timing-function', mergedIndicatorAnimation.easing)
  ) {
    const easing = defaultIndicatorAnimation.easing;
    console.warn(`Invalid indicator animation easing. Fallback: '${easing}'.`);
    mergedIndicatorAnimation.easing = easing;
  }

  if (typeof merged.avoidDuplicates !== 'boolean') {
    const avoidDuplicates = defaults.avoidDuplicates;
    console.warn(
      `Invalid avoidDuplicates option. Fallback: ${avoidDuplicates}.`,
    );
    merged.avoidDuplicates = avoidDuplicates;
  }

  if (typeof merged.manual !== 'boolean') {
    const manual = defaults.manual;
    console.warn(`Invalid manual option. Fallback: ${manual}.`);
    merged.manual = manual;
  }

  for (const [name, value] of Object.entries(defaults.selector)) {
    const { selector } = merged;
    const n = name as keyof typeof selector;

    try {
      document.querySelector(selector[n]);
    } catch {
      console.warn(
        `Invalid ${n.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)} selector. Fallback: '${value}'.`,
      );
      selector[n] = value;
    }
  }

  if (typeof merged.vertical !== 'boolean') {
    const vertical = defaults.vertical;
    console.warn(`Invalid vertical option. Fallback: ${vertical}.`);
    merged.vertical = vertical;
  }

  return merged;
}
