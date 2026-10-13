import type { TabsOptions as Options } from '@/types';

export const defaults = {
  animation: {
    content: {
      crossFade: true,
      duration: 300,
      easing: 'ease',
      fade: true,
    },
    indicator: {
      duration: 300,
      easing: 'ease',
    },
  },
  avoidDuplicates: false,
  manual: false,
  selector: {
    content: '[role="tablist"] + *',
    indicator: '[data-tabs-indicator]',
    list: '[role="tablist"]',
    panel: '[role="tabpanel"]',
    tab: '[role="tab"]',
  },
  vertical: false,
} as const satisfies Options;
