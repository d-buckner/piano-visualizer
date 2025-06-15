export default function debounce(callback: Function, wait: number) {
  let timeoutId: number | null = null;

  return (...args: unknown[]) => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback.apply(null, args);
    }, wait);
  };
}
