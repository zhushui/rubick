import { BrowserWindow } from 'electron';
import type { OleDropEvent, OleDropPoint } from './windowsOleDrop';

type OverlayRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

class HostDropOverlay {
  private parentWindow?: BrowserWindow;
  private rect?: OverlayRect;
  private onFiles?: (files: string[]) => void;
  private onState?: (payload: {
    phase: OleDropEvent['phase'];
    inside: boolean;
    active: boolean;
  }) => void;

  private isPointInside(point?: OleDropPoint) {
    if (
      !point ||
      !this.parentWindow ||
      this.parentWindow.isDestroyed() ||
      !this.rect
    ) {
      return false;
    }

    const parentBounds = this.parentWindow.getBounds();
    const left = parentBounds.x + this.rect.x;
    const top = parentBounds.y + this.rect.y;
    const right = left + this.rect.width;
    const bottom = top + this.rect.height;

    return (
      point.x >= left &&
      point.x <= right &&
      point.y >= top &&
      point.y <= bottom
    );
  }

  update(
    parentWindow: BrowserWindow,
    rect?: OverlayRect | null,
    onFiles?: (files: string[]) => void,
    onState?: (payload: {
      phase: OleDropEvent['phase'];
      inside: boolean;
      active: boolean;
    }) => void
  ) {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      this.hide();
      return false;
    }

    this.parentWindow = parentWindow;
    this.rect = rect;
    this.onFiles = onFiles;
    this.onState = onState;

    return true;
  }

  handleOleEvent(parentWindow: BrowserWindow, event: OleDropEvent) {
    if (
      !this.parentWindow ||
      this.parentWindow.isDestroyed() ||
      this.parentWindow !== parentWindow
    ) {
      return false;
    }

    const accepted = this.isPointInside(event.point);
    const active =
      accepted &&
      (event.phase === 'drag-enter' || event.phase === 'drag-over');

    this.onState?.({
      phase: event.phase,
      inside: accepted,
      active,
    });

    if (accepted && event.phase === 'drop' && event.files.length) {
      this.onFiles?.(event.files);
    }

    return accepted;
  }

  hide() {
    this.parentWindow = undefined;
    this.rect = undefined;
    this.onFiles = undefined;
    this.onState = undefined;
    return true;
  }
}

export default new HostDropOverlay();
