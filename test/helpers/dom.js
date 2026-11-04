import fs from "node:fs";
import vm from "node:vm";

// Minimal DOM/event fixture for the UI modules; document capture listeners run
// before target handlers and document bubble listeners, as in the browser.
export function createDomContext() {
  class Target {
    listeners = new Map();
    addEventListener(type, callback, options) {
      const listeners = this.listeners.get(type) || [];
      listeners.push({ callback, capture: options === true || options?.capture, once: options?.once });
      this.listeners.set(type, listeners);
    }
    removeEventListener(type, callback) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.callback !== callback));
    }
    fire(type, event, capture = false) {
      for (const item of [...(this.listeners.get(type) || [])]) {
        if (!!item.capture !== capture) continue;
        item.callback(event);
        if (item.once) this.removeEventListener(type, item.callback);
        if (event.stopped) break;
      }
    }
  }
  class Element extends Target {
    constructor(tag = "div") {
      super();
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.attributes = new Map();
      this.className = "";
      this.value = "";
      this.style = { setProperty(key, value) { this[key] = value; }, removeProperty(key) { delete this[key]; } };
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        toggle: (name, force) => {
          const names = new Set(this.className.split(/\s+/).filter(Boolean));
          const add = force ?? !names.has(name);
          if (add) names.add(name); else names.delete(name);
          this.className = [...names].join(" ");
        }
      };
    }
    append(...items) {
      for (const item of items) {
        if (item instanceof Element) {
          item.remove();
          item.parentElement = this;
          this.children.push(item);
        } else this._text = (this._text || "") + String(item);
      }
    }
    appendChild(item) { this.append(item); return item; }
    prepend(...items) { for (const item of items.reverse()) { item.remove(); item.parentElement = this; this.children.unshift(item); } }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this); this.parentElement = null; }
    replaceWith(item) { const parent = this.parentElement; const index = parent.children.indexOf(this); this.remove(); item.parentElement = parent; parent.children.splice(index, 0, item); }
    set textContent(value) { this._text = value; this.children = []; }
    get textContent() { return (this._text || "") + this.children.map(child => child.textContent).join(""); }
    set innerText(value) { this.textContent = value; }
    get innerText() { return this.textContent; }
    set innerHTML(value) { this.textContent = value; }
    setAttribute(name, value) { this.attributes.set(name, value); if (name === "id") this.id = value; }
    hasAttribute(name) { return this.attributes.has(name); }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const matches = element => selector.startsWith("#") ? element.id === selector.slice(1)
        : selector.startsWith(".") ? element.classList.contains(selector.slice(1))
          : selector.split(/,\s*/).some(tag => element.tagName === tag.toUpperCase());
      return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    get isConnected() { return document.body.contains(this); }
    get lastElementChild() { return this.children.at(-1); }
  }
  const document = new Target();
  document.body = new Element("body");
  document.createElement = tag => new Element(tag);
  document.querySelector = selector => document.body.querySelector(selector);
  document.getElementById = id => document.querySelector(`#${id}`);
  document.contains = element => document.body.contains(element);
  const window = new Target();
  window.location = { href: "https://example.test/FXclient/", hash: "" };
  const timers = [];
  const context = vm.createContext({
    document, window, HTMLElement: Element, Element, console, URL, TextEncoder, TextDecoder,
    navigator: {}, sessionStorage: { getItem: () => null, removeItem() {} },
    queueMicrotask, requestAnimationFrame: () => 1,
    setTimeout: callback => { timers.push(callback); return timers.length; },
    setInterval: () => 1, clearInterval() {},
    requireElementById: id => document.getElementById(id)
  });
  const addElement = (id, tag = "div") => {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
    return element;
  };
  const dispatch = (type, target, properties = {}) => {
    const event = { target, key: "", preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...properties };
    document.fire(type, event, true);
    if (!event.stopped) target.fire(type, event);
    if (!event.stopped) document.fire(type, event);
    return event;
  };
  const load = (file, namedExport) => {
    let source = fs.readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8").replace(/^import .*;\n/gm, "");
    source = namedExport ? source.replace(/^export /gm, "") + `\nreturn ${namedExport};` : source.replace(/^export default /m, "return ");
    return vm.runInContext(`(() => {${source}\n})()`, context);
  };
  return { context, document, window, addElement, dispatch, load, timers };
}
