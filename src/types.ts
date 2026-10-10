export interface TabsOptions {
  animation: {
    content: {
      crossFade: boolean;
      duration: number;
      easing: string;
      fade: boolean;
    };
    indicator: {
      duration: number;
      easing: string;
    };
  };
  avoidDuplicates: boolean;
  manual: boolean;
  selector: {
    content: string;
    indicator: string;
    list: string;
    panel: string;
    tab: string;
  };
  vertical: boolean;
}

export type Binding = {
  animation: Animation | null;
  panel: HTMLElement;
  tabs: HTMLElement[];
};
