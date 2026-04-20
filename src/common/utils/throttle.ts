// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function throttle(func, wait, options?: any): () => void {
  let context: unknown;
  let args: unknown[] | null = null;
  let result;
  let timeout = null;
  let previous = 0;

  if (!options) options = {};

  const later = function () {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout) context = args = null;
  };

  return function throttled(this: unknown, ...nextArgs: unknown[]) {
    const now = Date.now();
    if (!previous && options.leading === false) previous = now;

    const remaining = wait - (now - previous);
    context = this;
    args = nextArgs;

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };
}
