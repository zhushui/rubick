import { toRaw } from 'vue';

const toBridgePayload = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  const rawValue = toRaw(value);

  if (seen.has(rawValue as object)) {
    return seen.get(rawValue as object) as T;
  }

  if (Array.isArray(rawValue)) {
    const clonedArray: unknown[] = [];
    seen.set(rawValue, clonedArray);
    rawValue.forEach((item) => {
      clonedArray.push(toBridgePayload(item, seen));
    });
    return clonedArray as T;
  }

  const clonedObject: Record<string, unknown> = {};
  seen.set(rawValue as object, clonedObject);

  Object.keys(rawValue as Record<string, unknown>).forEach((key) => {
    const nextValue = toBridgePayload(
      (rawValue as Record<string, unknown>)[key],
      seen
    );

    if (nextValue !== undefined) {
      clonedObject[key] = nextValue;
    }
  });

  return clonedObject as T;
};

export { toBridgePayload };
