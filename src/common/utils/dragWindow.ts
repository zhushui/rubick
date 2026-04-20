import {
  SEARCH_INPUT_SELECTOR,
  isPointerOverSearchText,
  isSearchInputInteractiveElement,
} from './searchTextInteraction';

const DRAG_REGION_SELECTOR = '.rubick-select';
const IGNORE_DRAG_SELECTOR = [
  'button',
  'select',
  'option',
  'a',
  '[contenteditable="true"]',
  '.suffix-tool',
  '.icon-more',
  '.rubick-logo',
  '.rubick-tag',
  '.select-tag',
  '.clipboard-tag',
  '.clipboard-img',
  '.op-item',
  '.history-item',
  '.empty-state',
  '.ant-list',
  '.ant-list-item',
  '.ant-tag',
].join(', ');
const DRAG_THRESHOLD = 4;

const hasTextSelection = () => {
  const selection = window.getSelection();
  return !!selection && selection.type === 'Range' && !!selection.toString().trim();
};

const shouldIgnoreDrag = (event: MouseEvent) => {
  const { target } = event;
  if (!(target instanceof Element)) {
    return true;
  }

  if (!target.closest(DRAG_REGION_SELECTOR)) {
    return true;
  }

  if (target.closest(SEARCH_INPUT_SELECTOR)) {
    if (isSearchInputInteractiveElement(target)) {
      return true;
    }

    return isPointerOverSearchText(event, target);
  }

  return !!target.closest(IGNORE_DRAG_SELECTOR);
};

const useDrag = () => {
  let animationId = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDownX = 0;
  let mouseDownY = 0;
  let clientWidth = 0;
  let clientHeight = 0;
  let dragging = false;
  let pending = false;

  const cleanup = () => {
    pending = false;
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    cancelAnimationFrame(animationId);
  };

  const moveWindow = () => {
    window.rubick.windowMoving({
      mouseX,
      mouseY,
      width: clientWidth,
      height: clientHeight,
    });
    if (dragging) {
      animationId = requestAnimationFrame(moveWindow);
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!pending || dragging) {
      return;
    }

    const hasMovedEnough =
      Math.abs(e.clientX - mouseDownX) >= DRAG_THRESHOLD ||
      Math.abs(e.clientY - mouseDownY) >= DRAG_THRESHOLD;

    if (!hasMovedEnough) {
      return;
    }

    dragging = true;
    animationId = requestAnimationFrame(moveWindow);
  };

  const onMouseUp = () => {
    cleanup();
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 2 || hasTextSelection() || shouldIgnoreDrag(e)) {
      return;
    }

    pending = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;

    if (Math.abs(document.body.clientWidth - clientWidth) > 5) {
      clientWidth = document.body.clientWidth;
    }
    if (Math.abs(document.body.clientHeight - clientHeight) > 5) {
      clientHeight = document.body.clientHeight;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return {
    onMouseDown,
  };
};

export default useDrag;
