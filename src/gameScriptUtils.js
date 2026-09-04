import { getSettings } from "./settings.js";
import { getVar } from "./gameInterface.js";

// Example usage from game script: __fx.utils.getMaxTroops(...)

function getMaxTroops(playerTerritories, playerID) {
    return (playerTerritories[playerID] * 150).toString();
};
const densityCache = [];
let playerRanks;
const rankedNameCache = [];

function setPlayerRanks(ranks) {
    if (playerRanks === ranks) return;
    playerRanks = ranks;
    rankedNameCache.length = 0;
}

function getRankedName(playerID, name) {
    const zeroBasedRank = playerRanks?.[playerID];
    if (zeroBasedRank === undefined) return name;
    const rank = zeroBasedRank + 1;
    const cached = rankedNameCache[playerID];
    if (cached?.rank === rank && cached.name === name) return cached.text;
    const text = rank + ". " + name;
    rankedNameCache[playerID] = { rank, name, text };
    return text;
}

function getDensityStats(
    playerID,
    playerBalances = getVar("playerBalances"),
    playerTerritories = getVar("playerTerritories"),
    style = getSettings().densityDisplayStyle
) {
    const balance = playerBalances[playerID];
    const territory = playerTerritories[playerID];
    let cached = densityCache[playerID];

    if (!cached) cached = densityCache[playerID] = {};
    if (cached.balance !== balance || cached.territory !== territory || cached.style !== style) {
        const safeTerritory = territory || 1;
        const density = balance / safeTerritory;
        cached.balance = balance;
        cached.territory = territory;
        cached.style = style;
        cached.text = style === "percentage"
            ? (density / 1.5).toFixed(1) + "%"
            : density.toFixed(1);
        cached.color = `hsl(${territory ? density / 1.5 : 0}, 100%, 50%, 1)`;
    }
    return cached;
}
function getDensity(playerID, playerBalances, playerTerritories) {
    return getDensityStats(playerID, playerBalances, playerTerritories).text;
};
function isPointInRectangle(x, y, rectangleStartX, rectangleStartY, width, height) {
    return x >= rectangleStartX && x <= rectangleStartX + width && y >= rectangleStartY && y <= rectangleStartY + height;
};
function isHumanPlayer(playerID) {
    return playerID < getVar("gHumans");
}
/** @param {CanvasRenderingContext2D} canvas @param {string} text */
function fillTextMultiline(canvas, text, x, y, maxWidth) {
    const lineHeight = parseInt(canvas.font.split(" ").find(part => part.endsWith("px")).slice(0, -2));
    text.split("\n").forEach((line, index) => canvas.fillText(line, x, y + index * lineHeight, maxWidth));
}
function textStyleBasedOnDensity(playerID) {
    return getDensityStats(playerID).color;
}
// specific color pallete so two ips dont have a similar looking color
const duplicateIpColorPalette = [
    "hsla(0, 85%, 50%, 0.5)",
    "hsla(18, 85%, 52%, 0.5)",
    "hsla(36, 90%, 52%, 0.5)",
    "hsla(50, 90%, 48%, 0.5)",
    "hsla(72, 70%, 40%, 0.5)",
    "hsla(95, 65%, 40%, 0.5)",
    "hsla(130, 70%, 45%, 0.5)",
    "hsla(150, 65%, 40%, 0.5)",
    "hsla(165, 70%, 38%, 0.5)",
    "hsla(185, 80%, 48%, 0.5)",
    "hsla(200, 85%, 50%, 0.5)",
    "hsla(215, 85%, 55%, 0.5)",
    "hsla(235, 75%, 60%, 0.5)",
    "hsla(255, 60%, 62%, 0.5)",
    "hsla(270, 70%, 60%, 0.5)",
    "hsla(285, 75%, 58%, 0.5)",
    "hsla(300, 75%, 55%, 0.5)",
    "hsla(315, 80%, 58%, 0.5)",
    "hsla(330, 80%, 58%, 0.5)",
    "hsla(345, 80%, 52%, 0.5)",
];

function hashInt(n) {
    n = (n ^ (n >>> 16)) >>> 0;
    n = Math.imul(n, 0x45d9f3b) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    n = Math.imul(n, 0x45d9f3b) >>> 0;
    return (n ^ (n >>> 16)) >>> 0;
}

let cachedEntries = null;
let cachedEntriesKey = null;
let cachedIpColors = null;
const assignedColorIndexes = new Map();

function getIpColors(entries, ipField) {
    const key = ipField + "|" + entries.length;
    if (cachedEntries === entries && cachedEntriesKey === key) return cachedIpColors;

    const counts = new Map();
    entries.forEach(entry => {
        const ip = entry[ipField];
        if (ip === undefined) return;
        counts.set(ip, (counts.get(ip) || 0) + 1);
    });

    const paletteLength = duplicateIpColorPalette.length;
    const duplicates = [...counts.keys()].filter(ip => counts.get(ip) >= 2).sort();
    const duplicateSet = new Set(duplicates);
    assignedColorIndexes.forEach((_, ip) => {
        if (!duplicateSet.has(ip)) assignedColorIndexes.delete(ip);
    });

    const taken = new Set(assignedColorIndexes.values());
    duplicates.forEach(ip => {
        if (assignedColorIndexes.has(ip)) return;
        let index = hashInt(ip) % paletteLength;
        if (taken.size < paletteLength) {
            while (taken.has(index)) index = (index + 1) % paletteLength;
            taken.add(index);
        }
        assignedColorIndexes.set(ip, index);
    });

    const colors = new Map();
    duplicates.forEach(ip => colors.set(ip, duplicateIpColorPalette[assignedColorIndexes.get(ip)]));

    cachedEntries = entries;
    cachedEntriesKey = key;
    cachedIpColors = colors;
    return colors;
}

function getDuplicateIpHighlightColor(player, entries, ipField) {
    const ip = player[ipField];
    if (ip === undefined) return null;
    return getIpColors(entries, ipField).get(ip) || null;
}

export default {
    getMaxTroops,
    getDensity,
    getDensityStats,
    setPlayerRanks,
    getRankedName,
    isHumanPlayer,
    isPointInRectangle,
    fillTextMultiline,
    textStyleBasedOnDensity,
    getDuplicateIpHighlightColor
}
