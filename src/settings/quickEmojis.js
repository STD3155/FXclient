const CELL = 2.35;
const PANEL_STYLE = {
  display: "grid",
  gridAutoRows: CELL + "em",
  gap: CELL / 3 + "em",
  padding: CELL / 6 + "em",
  width: "max-content",
  background: "rgba(0, 0, 0, 0.75)",
  border: "2px solid white",
  transition: "none",
  animation: "none"
};
const CELL_STYLE = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: CELL * 0.89 + "em",
  lineHeight: "1",
  cursor: "pointer",
  userSelect: "none",
  transition: "none",
  animation: "none"
};
const ICON_BASE = 1011;
const ICON_COUNT = 13;
const MORE_CODE = ICON_BASE + ICON_COUNT;
const tileUrls = {};

function tileFor(code) {
  if (code < ICON_BASE || code > MORE_CODE) return "";
  if (!tileUrls[code]) {
    const canvas = window[dictionary.emojiHolder]?.[dictionary.emojiPicker]?.[dictionary.emojiTiles]?.[code - ICON_BASE];
    if (canvas) tileUrls[code] = canvas.toDataURL();
  }
  return tileUrls[code] || "";
}

export function createQuickEmojis(container) {
  const label = document.createElement("label");
  label.className = "checkbox";
  label.append("Use custom quick emojis ");
  const note = document.createElement("small");
  note.textContent = "Choose the 9 emojis shown in the in-game quick-emoji bar, in order. Save settings to apply.";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const checkmark = document.createElement("span");
  checkmark.className = "checkmark";
  label.append(document.createElement("br"), note, checkbox, checkmark);
  container.append(label, document.createElement("br"));

  const picker = document.createElement("div");
  Object.assign(picker.style, { display: "none", margin: "8px 0", transition: "none", animation: "none" });
  const slotsRow = document.createElement("div");
  Object.assign(slotsRow.style, PANEL_STYLE, {
    gridTemplateColumns: "repeat(9, " + CELL + "em)",
    marginBottom: CELL / 3 + "em"
  });
  const grid = document.createElement("div");
  Object.assign(grid.style, PANEL_STYLE, {
    gridTemplateColumns: "repeat(10, " + CELL + "em)",
    display: "none"
  });
  picker.append(slotsRow, grid);
  container.append(picker);

  const slots = [];
  const codes = new Array(9).fill(null);
  let options = [];
  let armed = null;
  let page = 1;
  const quickEmojis = () => window.__fx.quickEmojis || {};
  const isFlag = (code) => code < (quickEmojis().emojiBaseCode ?? 676);
  const glyphFor = (code) => isFlag(code)
    ? String.fromCodePoint(0x1f1e6 + Math.floor(code / 26), 0x1f1e6 + (code % 26))
    : (quickEmojis().emojiList ?? [])[code - (quickEmojis().emojiBaseCode ?? 676)] ?? "";

  function paint(cell, code, round = true) {
    const tile = code >= ICON_BASE && code <= MORE_CODE;
    const tileUrl = tile ? tileFor(code) : "";
    cell.replaceChildren();
    cell.style.backgroundColor = !tile ? "transparent"
      : code === MORE_CODE ? "rgba(0, 180, 0, 0.6)" : "rgba(0, 0, 0, 0.6)";
    if (round) cell.style.borderRadius = tile ? "50%" : "";
    if (tileUrl) {
      const image = document.createElement("img");
      image.src = tileUrl;
      image.alt = "";
      Object.assign(image.style, { width: "100%", height: "100%", objectFit: "contain" });
      cell.append(image);
    } else if (!tile) {
      cell.textContent = glyphFor(code);
    }
  }

  function makeCell(code, onClick) {
    const cell = document.createElement("div");
    Object.assign(cell.style, CELL_STYLE);
    paint(cell, code);
    cell.addEventListener("click", onClick);
    return cell;
  }

  function arm(index) {
    armed = index;
    slots.forEach((slot, i) => {
      slot.style.boxShadow = i === index ? "inset 0 0 0 2px rgb(0, 200, 0)" : "";
    });
  }
  function close() {
    arm(null);
    grid.style.display = "none";
  }
  function select(code) {
    if (armed === null) return;
    codes[armed] = code;
    paint(slots[armed], code, false);
    close();
  }
  function renderPage() {
    grid.replaceChildren();
    if (!options.length) return;
    let end = 49 * page;
    if (end - 49 >= options.length) {
      page = 1;
      end = 49;
    }
    end = Math.min(end, options.length);
    options.slice(Math.max(0, end - 49), end)
      .forEach((code) => grid.append(makeCell(code, () => select(code))));
    grid.append(makeCell(MORE_CODE, () => {
      page++;
      renderPage();
    }));
  }
  function buildOptions() {
    if (options.length) return;
    const { emojiList = [], emojiBaseCode = 676, realFlagCodes = [] } = quickEmojis();
    if (!emojiList.length) return;
    options = Array.from({ length: ICON_COUNT }, (unused, i) => ICON_BASE + i)
      .concat(emojiList.map((unused, i) => emojiBaseCode + i), realFlagCodes);
  }
  function open(index) {
    buildOptions();
    page = 1;
    renderPage();
    arm(index);
    grid.style.display = "grid";
  }
  for (let i = 0; i < 9; i++) {
    const slot = document.createElement("div");
    Object.assign(slot.style, CELL_STYLE, { borderRadius: "0" });
    slot.addEventListener("click", () => armed === i ? close() : open(i));
    slots.push(slot);
    slotsRow.append(slot);
  }
  const updateVisibility = () => picker.style.display = checkbox.checked ? "block" : "none";
  checkbox.addEventListener("change", updateVisibility);

  return {
    save(settings) {
      settings.customQuickEmojisEnabled = checkbox.checked;
      settings.customQuickEmojis = codes.slice();
    },
    update(settings) {
      checkbox.checked = !!settings.customQuickEmojisEnabled;
      (settings.customQuickEmojis || []).forEach((entry, i) => {
        const code = Number(entry?.code ?? entry);
        if (i < 9 && Number.isFinite(code)) codes[i] = code;
      });
      buildOptions();
      slots.forEach((slot, i) => {
        if (codes[i] === null) codes[i] = options[i] ?? ICON_BASE + i;
        paint(slot, codes[i], false);
      });
      updateVisibility();
      close();
    }
  };
}
