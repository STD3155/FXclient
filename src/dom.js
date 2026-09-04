export function requireElement(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

export function requireElementById(id) {
  return requireElement(`#${id}`);
}
