import {
  BrowserView,
  BrowserWindow,
  View,
  WebContentsView,
} from 'electron';

export type ManagedView = (BrowserView | WebContentsView) & {
  inDetach?: boolean;
  inited?: boolean;
};

export const isBrowserView = (
  view: ManagedView | null | undefined
): view is BrowserView & ManagedView => view instanceof BrowserView;

export const isWebContentsView = (
  view: ManagedView | null | undefined
): view is WebContentsView & ManagedView => view instanceof WebContentsView;

export const attachManagedView = (
  window: BrowserWindow,
  view: ManagedView
) => {
  if (isBrowserView(view)) {
    window.setBrowserView(view);
    return;
  }

  window.contentView.addChildView(view);
};

const isWindowAlive = (window: BrowserWindow | null | undefined) => {
  try {
    return !!window && !window.isDestroyed();
  } catch {
    return false;
  }
};

const hasLiveWebContents = (view: ManagedView | null | undefined) => {
  try {
    return !!view?.webContents && !view.webContents.isDestroyed();
  } catch {
    return false;
  }
};

export const detachManagedView = (
  window: BrowserWindow,
  view: ManagedView
) => {
  if (!isWindowAlive(window) || !hasLiveWebContents(view)) {
    return;
  }

  if (isBrowserView(view)) {
    try {
      if (window.getBrowserView?.() === view) {
        window.setBrowserView(null);
      }
    } catch {
      // ignore detached/destroyed browser views during teardown
    }
    return;
  }

  try {
    window.contentView.removeChildView(view as unknown as View);
  } catch {
    // ignore missing attachment during fast dev reloads
  }
};

export const destroyManagedView = (view: ManagedView | null | undefined) => {
  if (!hasLiveWebContents(view)) {
    return;
  }

  try {
    view.webContents.destroy();
  } catch {
    // ignore duplicate destroy attempts during teardown
  }
};

export const getAttachedManagedViews = (window: BrowserWindow): ManagedView[] => {
  const browserViews = window.getBrowserViews?.() || [];
  const childViews = window.contentView.children.filter((child) =>
    isWebContentsView(child as ManagedView)
  ) as ManagedView[];

  return [...browserViews, ...childViews];
};

export const hasManagedView = (window: BrowserWindow) =>
  getAttachedManagedViews(window).length > 0;

export const setManagedViewBounds = (
  window: BrowserWindow,
  view: ManagedView,
  topInset: number
) => {
  const [width, height] = window.getContentSize();
  view.setBounds({
    x: 0,
    y: topInset,
    width,
    height: Math.max(0, height - topInset),
  });
};

export const enableManagedViewAutoResize = (view: ManagedView) => {
  if (isBrowserView(view)) {
    view.setAutoResize({ width: true, height: true });
  }
};
