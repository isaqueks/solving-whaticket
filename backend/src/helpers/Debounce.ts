type DebouncedFunction = {
  (): Promise<void>;
  (...args: never[]): void;
};

/**
 * Debounce global por chave. Chaves de entidades diferentes devem ser
 * namespaced (ex.: "group-123") para não colidir com ids de ticket,
 * que são passados como número puro.
 */
class DebounceManager {
  private timeouts = new Map<number | string, NodeJS.Timeout>();

  private clear(key: number | string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  public debounce(
    func: DebouncedFunction,
    wait: number,
    key: number | string
  ): (...args: never[]) => void {
    return (...args: never[]): void => {
      this.clear(key);
      const timeout = setTimeout(() => {
        this.timeouts.delete(key);
        func(...args);
      }, wait);
      this.timeouts.set(key, timeout);
    };
  }
}

const manager = new DebounceManager();

const debounce = (
  func: DebouncedFunction,
  wait: number,
  key: number | string
): ((...args: never[]) => void) => manager.debounce(func, wait, key);

export { debounce };
