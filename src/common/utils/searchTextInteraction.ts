const SEARCH_INPUT_SELECTOR = '.main-input';
const SEARCH_TEXT_FIELD_SELECTOR = 'input, textarea';
const SEARCH_IGNORE_SELECTOR = [
  '.suffix-tool',
  '.icon-more',
  '.ant-input-suffix',
  '.ant-input-prefix',
  '.ant-input-clear-icon',
].join(', ');

const textMeasureCanvas = document.createElement('canvas');
const textMeasureContext = textMeasureCanvas.getContext('2d');

const getSearchTextField = (target: Element | null) =>
  target
    ?.closest(SEARCH_INPUT_SELECTOR)
    ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      SEARCH_TEXT_FIELD_SELECTOR
    ) || null;

const measureInputTextWidth = (
  input: HTMLInputElement | HTMLTextAreaElement,
  text: string
) => {
  if (!textMeasureContext) {
    return 0;
  }

  const styles = window.getComputedStyle(input);
  textMeasureContext.font = [
    styles.fontStyle,
    styles.fontVariant,
    styles.fontWeight,
    styles.fontSize,
    styles.fontFamily,
  ]
    .filter(Boolean)
    .join(' ');

  return textMeasureContext.measureText(text).width;
};

const isPointerOverSearchText = (
  event: Pick<MouseEvent, 'clientX' | 'clientY'>,
  target: Element | null
) => {
  const input = getSearchTextField(target);
  if (!input) {
    return false;
  }

  const value = input.value || '';
  if (!value) {
    return false;
  }

  const rect = input.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    return false;
  }

  const styles = window.getComputedStyle(input);
  const paddingLeft = Number.parseFloat(styles.paddingLeft || '0') || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight || '0') || 0;
  const availableWidth = Math.max(0, rect.width - paddingLeft - paddingRight);
  const textWidth = Math.min(measureInputTextWidth(input, value), availableWidth);
  const textLeft = rect.left + paddingLeft - input.scrollLeft;
  const textRight = Math.min(rect.right - paddingRight, textLeft + textWidth);

  return event.clientX >= textLeft && event.clientX <= textRight;
};

const isSearchInputInteractiveElement = (target: Element | null) =>
  !!target?.closest(SEARCH_IGNORE_SELECTOR);

export {
  SEARCH_INPUT_SELECTOR,
  isPointerOverSearchText,
  isSearchInputInteractiveElement,
};
