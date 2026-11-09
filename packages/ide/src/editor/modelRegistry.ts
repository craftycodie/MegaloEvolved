/**
 * Monaco model → document key (LSP URI). Language providers receive a model
 * and need the URI the LSP knows it by; Monaco's own `model.uri.toString()`
 * encodes paths differently (`c%3A`), so the key is looked up here instead.
 */
const keys = new WeakMap<object, string>();

export function registerModelKey(model: object, key: string): void {
  keys.set(model, key);
}

export function unregisterModelKey(model: object): void {
  keys.delete(model);
}

export function documentKeyForModel(model: object): string | undefined {
  return keys.get(model);
}
