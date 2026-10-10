import type { TabsOptions as Options } from '@/types';

export class TabsIndicator {
  #rootElement: HTMLElement;
  #settings: Options;
  #listElement: HTMLElement | null = null;
  #animation: Animation | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #mutationObserver: MutationObserver | null = null;

  constructor(root: HTMLElement, settings: Options) {
    this.#rootElement = root;
    this.#settings = settings;
    this.#listElement = root.closest(settings.selector.list);

    if (!this.#listElement) {
      return;
    }

    this.#resizeObserver = new ResizeObserver(this.#update);
    this.#resizeObserver.observe(this.#listElement);
    this.#mutationObserver = new MutationObserver(this.#update);
    this.#mutationObserver.observe(this.#listElement, {
      attributeFilter: ['aria-selected'],
      subtree: true,
    });
  }

  #update = (): void => {
    if (!this.#rootElement.checkVisibility()) {
      return;
    }

    if (!this.#listElement) {
      return;
    }

    const isHorizontal = this.#listElement.ariaOrientation !== 'vertical';
    const position = `inset${isHorizontal ? 'Inline' : 'Block'}Start`;
    const size = `${isHorizontal ? 'inline' : 'block'}Size`;
    const tab = this.#listElement.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );

    if (!tab) {
      return;
    }

    const tabRect = tab.getBoundingClientRect();
    const listRect = this.#listElement.getBoundingClientRect();
    const { duration, easing } = this.#settings.animation.indicator;
    this.#animation = this.#rootElement.animate(
      {
        [position]: `${isHorizontal ? tabRect.left - listRect.left : tabRect.top - listRect.top}px`,
        [size]: `${isHorizontal ? tabRect.width : tabRect.height}px`,
      },
      { duration, easing, fill: 'forwards' },
    );
  };

  async destroy(force = false): Promise<void> {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;

    if (!this.#animation) {
      return;
    }

    if (!force) {
      try {
        await this.#animation.finished;
      } catch {}
    }

    this.#animation.cancel();
    this.#animation = null;
    this.#listElement = null;
  }
}
