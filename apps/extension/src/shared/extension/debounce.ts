interface Debounced<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel(): void;
}

function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number
): Debounced<TArgs> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: TArgs) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return debounced;
}

export { debounce };
export type { Debounced };
