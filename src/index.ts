import { addAttributeToken, restoreAttributes, saveAttributes } from '@y14e/attribute-utils';
import { generateBase62Random } from '@y14e/basen';
import { Button } from '@y14e/button';
import { createRovingTabIndex } from '@y14e/roving-tabindex';
import { hasFocusable } from 'power-focusable';
import { defaults } from './defaults';
import { Indicator } from './indicator';
import { resolveOptions } from './options';
import type { Binding, TabsOptions as Options } from './types';

export class Tabs {
  static defaults: Partial<Options> = {};

  #rootElement!: HTMLElement;
  #settings!: Options;
  #listElements!: HTMLElement[];
  #tabElements!: HTMLElement[];
  #indicatorElements!: HTMLElement[];
  #contentElement!: HTMLElement | null;
  #panelElements!: HTMLElement[];
  #bindings = new WeakMap<HTMLElement, Binding>();
  #eventController: AbortController | null = null;
  #animationController: AbortController | null = null;
  #cleanupsRovingTabIndex: (() => void)[] = [];
  #animation: Animation | null = null;
  #buttons: Button[] = [];
  #indicators: Indicator[] = [];
  #isDestroyed = false;

  constructor(root: HTMLElement, options: Partial<Options> = {}) {
    if (!(root instanceof HTMLElement)) {
      throw new TypeError('Invalid root element');
    }

    if (root.hasAttribute('data-tabs-initialized')) {
      console.warn('Already initialized');
      return;
    }

    this.#rootElement = root;
    this.#settings = resolveOptions(resolveOptions(defaults, Tabs.defaults), options);
    matchMedia('(prefers-reduced-motion: reduce)').matches &&
      Object.assign(this.#settings.animation, {
        content: { duration: 0 },
        indicator: { duration: 0 },
      });
    const NOT_NESTED = `:not(:scope ${this.#settings.selector.panel} *)`;
    this.#listElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `${this.#settings.selector.list}${NOT_NESTED}`,
      ),
    ];

    if (!this.#listElements.length) {
      console.warn('Missing list elements');
      return;
    }

    this.#tabElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `${this.#settings.selector.tab}${NOT_NESTED}`,
      ),
    ];

    if (!this.#tabElements.length) {
      console.warn('Missing tab elements');
      return;
    }

    this.#indicatorElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `${this.#settings.selector.indicator}${NOT_NESTED}`,
      ),
    ];

    this.#contentElement = this.#rootElement.querySelector<HTMLElement>(
      this.#settings.selector.content,
    );

    if (!this.#contentElement) {
      console.warn('Missing content element');
      return;
    }

    this.#panelElements = [
      ...this.#rootElement.querySelectorAll<HTMLElement>(
        `${this.#settings.selector.panel}${NOT_NESTED}`,
      ),
    ];

    const { length } = this.#panelElements;

    if (!length) {
      console.warn('Missing panel elements');
      return;
    }

    const tabs: HTMLElement[][] = [];

    this.#tabElements.forEach((tab, i) => {
      const index = i % length;
      const tabsByIndex = tabs[index] ?? [];
      tabsByIndex.push(tab);
      tabs[index] = tabsByIndex;
      const panel = this.#panelElements[index];

      if (!panel) {
        return;
      }

      const binding = this.#createBinding(tabsByIndex, panel);
      this.#bindings.set(tab, binding);
      i < length && this.#bindings.set(panel, binding);
    });

    this.#initialize();
  }

  activate(tab: HTMLElement): void {
    if (this.#isDestroyed) {
      return;
    }

    if (!(tab instanceof HTMLElement) || !this.#bindings.has(tab)) {
      console.warn('Invalid tab element');
      return;
    }

    this.#activate(tab);
  }

  async destroy(force = false): Promise<void> {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    this.#eventController?.abort();
    this.#eventController = null;

    for (const cleanup of this.#cleanupsRovingTabIndex) {
      cleanup();
    }

    this.#cleanupsRovingTabIndex.length = 0;

    for (const button of this.#buttons) {
      button.destroy();
    }

    this.#buttons.length = 0;

    for (const indicator of this.#indicators) {
      indicator.destroy(force);
    }

    this.#indicators.length = 0;

    if (this.#animation) {
      if (!force) {
        try {
          await this.#animation.finished;
        } catch {}
      }

      this.#animation.cancel();
    }

    if (!force) {
      await Promise.all(
        this.#panelElements.map((p) => this.#bindings.get(p)?.animation?.finished.catch(() => {})),
      );
    }

    for (const panel of this.#panelElements) {
      this.#bindings.get(panel)?.animation?.cancel();
    }

    this.#onContentAnimationFinish();
    this.#animationController?.abort();
    this.#animationController = null;
    restoreAttributes([
      ...this.#listElements,
      ...this.#tabElements,
      ...this.#indicatorElements,
      ...this.#panelElements,
    ]);
    this.#contentElement && restoreAttributes(this.#contentElement);
    this.#listElements.length = 0;
    this.#tabElements.length = 0;
    this.#contentElement = null;
    this.#panelElements.length = 0;
    this.#rootElement.removeAttribute('data-tabs-initialized');
  }

  #initialize(): void {
    saveAttributes(this.#listElements, ['aria-hidden', 'role', 'style']);
    saveAttributes(this.#tabElements, ['aria-controls', 'id', 'role', 'style', 'tabindex']);
    saveAttributes(this.#indicatorElements, 'style');
    this.#contentElement && saveAttributes(this.#contentElement, 'style');
    saveAttributes(this.#panelElements, [
      'aria-controls',
      'aria-labelledby',
      'id',
      'role',
      'style',
      'tabindex',
    ]);
    const {
      avoidDuplicates,
      manual,
      selector: { tab },
    } = this.#settings;
    this.#eventController = new AbortController();
    const { signal } = this.#eventController;

    this.#listElements.forEach((list, i) => {
      avoidDuplicates && i && list.setAttribute('aria-hidden', 'true');
      list.setAttribute('role', 'tablist');
    });

    this.#tabElements.forEach((tab, i) => {
      const id = generateBase62Random(4);
      const panel = this.#panelElements[i % this.#panelElements.length];

      if (!panel) {
        return;
      }

      panel.id ||= `tabs-panel-${id}`;
      addAttributeToken(tab, 'aria-controls', panel.id);
      !tab.hasAttribute('aria-selected') && tab.setAttribute('aria-selected', 'false');
      tab.id ||= `tabs-tab-${id}`;
      tab.setAttribute('role', 'tab');
      !this.#isFocusable(tab) && tab.style.setProperty('pointer-events', 'none');
      addAttributeToken(panel, 'aria-labelledby', tab.id);
      tab.addEventListener('click', this.#onTabClick, { signal });
      tab.addEventListener('focus', this.#onTabFocus, { signal });
      !manual && tab.addEventListener('mousedown', this.#onTabMouseDown, { signal });
      this.#buttons.push(new Button(tab));
    });

    for (const indicator of this.#indicatorElements) {
      indicator
        .closest<HTMLElement>(this.#settings.selector.list)?.style.setProperty('position', 'relative');
      const { style } = indicator;
      style.setProperty('display', 'block');
      style.setProperty('position', 'absolute');
      this.#indicators.push(new Indicator(indicator, this.#settings));
    }

    if (!this.#contentElement) {
      return;
    }

    const { style } = this.#contentElement;
    style.setProperty('align-items', 'start');
    style.setProperty('display', 'grid');

    for (const panel of this.#panelElements) {
      panel.setAttribute('role', 'tabpanel');
      panel.style.setProperty('grid-area', '1 / 1');
      !panel.hasAttribute('hidden') &&
        !this.#hasFocusable(panel) &&
        panel.setAttribute('tabindex', '0');
      panel.addEventListener('beforematch', this.#onPanelBeforeMatch, { signal });
    }

    for (const list of this.#listElements) {
      this.#cleanupsRovingTabIndex.push(
        createRovingTabIndex(list, {
          direction: () => {
            const orientation = list.ariaOrientation;
            return orientation === 'vertical'
              ? 'vertical'
              : orientation === 'undefined'
                ? 'both'
                : 'horizontal';
          },
          selector: tab,
          wrap: true,
        }),
      );

      for (const t of list.querySelectorAll<HTMLElement>(tab)) {
        t.setAttribute(
          'tabindex',
          t.ariaSelected === 'true' && !this.#isAvoidedTab(t) ? '0' : '-1',
        );
      }
    }

    this.#rootElement.setAttribute('data-tabs-initialized', '');
  }

  #onTabClick = (event: MouseEvent): void => {
    event.preventDefault();
    const tab = event.currentTarget;

    if (!(tab instanceof HTMLElement)) {
      return;
    }

    this.#activate(tab);
  };

  #onTabFocus = (event: FocusEvent): void => {
    const tab = event.currentTarget;

    if (!(tab instanceof HTMLElement)) {
      return;
    }

    !this.#settings.manual && tab.click();
    this.#isAvoidedTab(tab) && tab.blur();
  };

  #onTabMouseDown = (event: MouseEvent): void => {
    if (event.button === 2) {
      event.preventDefault();
    }
  };

  #onContentAnimationFinish(): void {
    for (const name of ['block-size', 'overflow']) {
      this.#contentElement?.style.removeProperty(name);
    }

    for (const panel of this.#panelElements) {
      for (const name of ['content-visibility', 'opacity']) {
        panel.style.removeProperty(name);
      }
    }

    this.#rootElement.removeAttribute('data-tabs-animating');
  }

  #onPanelBeforeMatch = (event: Event): void => {
    const panel = event.currentTarget;

    if (!(panel instanceof HTMLElement)) {
      return;
    }

    const tab = this.#bindings.get(panel)?.tabs[0];
    tab && this.#activate(tab, true);
  };

  #activate(tab: HTMLElement, isMatch = false): void {
    if (tab.ariaSelected === 'true') {
      return;
    }

    for (const t of this.#tabElements) {
      const isSelected = this.#bindings.get(t)?.tabs.some((t) => t === tab);
      t.setAttribute('aria-selected', `${isSelected}`);
      t.setAttribute('tabindex', isSelected && !this.#isAvoidedTab(t) ? '0' : '-1');
    }

    if (!this.#contentElement) {
      return;
    }

    const size = this.#contentElement.offsetHeight;
    this.#rootElement.setAttribute('data-tabs-animating', '');
    const { style } = this.#contentElement;
    style.setProperty('overflow', 'clip');
    const { crossfade, fade } = this.#settings.animation.content;
    const panel = this.#bindings.get(tab)?.panel;

    if (!panel) {
      return;
    }

    for (const p of this.#panelElements) {
      const { style } = p;

      if (fade) {
        style.setProperty('content-visibility', 'visible');
        style.setProperty('opacity', !p.hidden ? '1' : '0');
      }

      p === panel && !this.#hasFocusable(p)
        ? p.setAttribute('tabindex', '0')
        : p.removeAttribute('tabindex');
    }

    this.#panelElements.forEach((p, i) => {
      if (p === panel) {
        p.removeAttribute('hidden');
      } else {
        const tab = this.#tabElements[i];
        tab && p.setAttribute('hidden', this.#isFocusable(tab) ? 'until-found' : '');
      }
    });

    // Content
    this.#animation?.cancel();
    const { duration, easing } = this.#settings.animation.content;
    const animation = this.#contentElement.animate(
      { blockSize: [`${size}px`, getComputedStyle(panel).getPropertyValue('block-size')] },
      { duration: !isMatch ? duration : 0, easing: easing },
    );
    this.#animation = animation;

    const cleanup = (): void => {
      if (animation === this.#animation) {
        this.#animation = null;
      }
    };

    this.#animationController = new AbortController();
    const { signal } = this.#animationController;
    this.#animation.addEventListener('cancel', cleanup, { once: true, signal });

    this.#animation.addEventListener(
      'finish',
      () => {
        if (this.#animation === animation) {
          this.#onContentAnimationFinish();
          cleanup();
        }
      },
      { once: true, signal },
    );

    // Panel
    for (const p of this.#panelElements) {
      const binding = this.#bindings.get(p);

      if (!binding) {
        return;
      }

      const opacity = getComputedStyle(p).getPropertyValue('opacity');
      binding.animation?.cancel();
      const isSelected = p === panel;
      const animation = p.animate(
        {
          opacity:
            crossfade || !fade
              ? isSelected
                ? [opacity, '1']
                : [opacity, '0']
              : isSelected
                ? [opacity, opacity, '1']
                : [opacity, '0', '0'],
        },
        {
          duration:
            !isMatch && fade
              ? this.#settings.animation.content.duration * (crossfade ? 1 : 1.5)
              : 0,
          easing: 'ease',
        },
      );
      binding.animation = animation;

      const cleanup = (): void => {
        if (binding.animation === animation) {
          binding.animation = null;
        }
      };

      this.#animationController = new AbortController();
      const { signal } = this.#animationController;

      ['cancel', 'finish'].forEach((event) => {
        animation.addEventListener(event, cleanup, { once: true, signal });
      });
    }
  }

  #createBinding(tabs: HTMLElement[], panel: HTMLElement): Binding {
    return { animation: null, panel, tabs };
  }

  #hasFocusable(container: HTMLElement): boolean {
    return hasFocusable(container, { skipVisibilityCheck: true });
  }

  #isAvoidedTab(tab: HTMLElement): boolean {
    const tabs = this.#bindings.get(tab)?.tabs;
    return !!tabs && this.#settings.avoidDuplicates && tabs.indexOf(tab) > 0;
  }

  #isFocusable(element: HTMLElement): boolean {
    return !element.hasAttribute('disabled');
  }
}

export type { Options as TabsOptions };
