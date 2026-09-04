export const section = (title) => ({ kind: "section", title });
export const component = (create, searchText = "") => ({ kind: "component", create, searchText });

function ensureDirtyIndicator(settingsWindow) {
  let indicator = document.getElementById("settingsDirty");
  if (indicator) return indicator;
  indicator = document.createElement("small");
  indicator.id = "settingsDirty";
  indicator.className = "settings-dirty d-none";
  indicator.textContent = "Unsaved changes";
  settingsWindow.querySelector("h1")?.append(" ", indicator);
  return indicator;
}

function createField(definition) {
  const label = document.createElement("label");
  if (definition.tooltip) label.title = definition.tooltip;
  const isValueInput = definition.type.endsWith("Input");
  const element = document.createElement(
    isValueInput || definition.type === "checkbox"
      ? "input"
      : definition.type === "selectMenu"
        ? "select"
        : "button"
  );
  if (definition.type === "textInput") element.type = "text";
  if (definition.placeholder) element.placeholder = definition.placeholder;
  if (definition.text) element.textContent = definition.text;
  if (definition.action) element.addEventListener("click", definition.action);
  if (definition.label) label.append(definition.label + " ");
  if (definition.note) {
    const note = document.createElement("small");
    note.textContent = definition.note;
    label.append(document.createElement("br"), note);
  }
  definition.options?.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    element.append(optionElement);
  });
  label.append(element);
  if (definition.type === "checkbox") {
    element.type = "checkbox";
    const checkmark = document.createElement("span");
    checkmark.className = "checkmark";
    label.className = "checkbox";
    label.append(checkmark);
  } else {
    label.append(document.createElement("br"));
  }
  return { label, element, isValueInput };
}

export function createSettingsUi({ settingsWindow, definitions, componentContext = {} }) {
  const container = settingsWindow.querySelector(".scrollable");
  if (!container) throw new Error("Settings scroll container is missing");
  const dirtyIndicator = ensureDirtyIndicator(settingsWindow);
  const inputFields = {};
  const checkboxFields = {};
  const components = [];
  const rows = [];
  let built = false;

  const setDirty = (dirty) => dirtyIndicator.classList.toggle("d-none", !dirty);

  function build() {
    if (built) return;
    const search = document.createElement("input");
    search.type = "search";
    search.className = "settings-search";
    search.placeholder = "Search settings…";
    search.setAttribute("aria-label", "Search settings");
    const empty = document.createElement("p");
    empty.className = "settings-empty d-none";
    empty.textContent = "No settings found.";
    container.append(search, empty);
    container.addEventListener("change", (event) => {
      if (event.target !== search) setDirty(true);
    });
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      rows.forEach((row) => {
        const matches = !query || row.dataset.search.includes(query);
        row.classList.toggle("d-none", !matches);
        if (matches && !row.classList.contains("settings-section")) visible++;
      });
      empty.classList.toggle("d-none", visible !== 0);
    });

    definitions.forEach((definition) => {
      const row = document.createElement("div");
      row.className = "settings-row";
      if (definition.kind === "section") {
        row.classList.add("settings-section");
        const title = document.createElement("p");
        const heading = document.createElement("b");
        heading.textContent = definition.title;
        title.append(heading);
        row.append(title);
      } else if (definition.kind === "component") {
        const instance = definition.create(row, componentContext) || {};
        components.push(instance);
      } else {
        const { label, element, isValueInput } = createField(definition);
        if (isValueInput || definition.type === "selectMenu") inputFields[definition.for] = element;
        if (definition.type === "checkbox") checkboxFields[definition.for] = element;
        row.append(label);
      }
      row.dataset.search = `${row.textContent} ${definition.searchText || ""}`.toLowerCase();
      rows.push(row);
      container.append(row);
    });
    built = true;
  }

  function applyPreset(values) {
    build();
    Object.entries(values).forEach(([key, value]) => {
      if (inputFields[key]) inputFields[key].value = value;
      if (checkboxFields[key]) checkboxFields[key].checked = value;
    });
    setDirty(true);
  }

  function readInto(settings) {
    build();
    Object.entries(inputFields).forEach(([key, field]) => settings[key] = field.value.trim());
    Object.entries(checkboxFields).forEach(([key, field]) => settings[key] = field.checked);
    components.forEach((instance) => instance.save?.(settings));
  }

  function sync(settings) {
    build();
    Object.entries(inputFields).forEach(([key, field]) => field.value = settings[key]);
    Object.entries(checkboxFields).forEach(([key, field]) => field.checked = settings[key]);
    components.forEach((instance) => {
      try {
        instance.update?.(settings);
      } catch (error) {
        console.warn("Could not load a settings section:", error);
      }
    });
    setDirty(false);
  }

  return { applyPreset, build, readInto, sync };
}
