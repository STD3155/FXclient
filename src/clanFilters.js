import { getVar } from "./gameInterface.js";

let cachedRawNames = null;
let cachedHumanCount = -1;
let parsedClans = [];

export const leaderboardFilter = new (function() {
    //this.playersToInclude = [0,1,8,20,24,30,32,42,50,69,200,400,500,510,511]; // for testing
    this.playersToInclude = [];
    this.tabLabels = ["ALL", "CLAN", "RIVALS"];
    // these get populated by the modified game code
    this.filteredLeaderboard = [];
    this.tabBarOffset = 0;
    this.windowWidth = 0;
    this.verticalClickThreshold = 1000;
    this.hoveringOverTabs = false;
    this.scrollToTop = () => {};
    this.repaintLeaderboard = () => {};
    this.setUpdateFlag = () => {};
    this.parseClanFromPlayerName = () => { console.warn("parse function not set"); };

    this.selectedTab = 0;
    this.tabHovering = -1;
    this.enabled = false;
    //this.enabled = true;
    this.showingRivals = false;

    this.rivalsData = [];
    this.ownClanIndex = -1;
    let lastRivalsCompute = 0;
    const clanTotals = new Map();

    const refreshClanCache = (force = false) => {
        const rawNames = getVar("rawPlayerNames");
        const gHumans = getVar("gHumans");
        if (!force && rawNames === cachedRawNames && gHumans === cachedHumanCount) return;
        cachedRawNames = rawNames;
        cachedHumanCount = gHumans;
        parsedClans = new Array(gHumans);
        for (let id = 0; id < gHumans; id++) parsedClans[id] = this.parseClanFromPlayerName(rawNames[id]);
    };

    this.computeRivals = (force = false) => {
        const now = performance.now();
        if (!force && now - lastRivalsCompute < 100) return;
        lastRivalsCompute = now;
        refreshClanCache();
        const playerTerritories = getVar("playerTerritories");
        const gHumans = cachedHumanCount;
        clanTotals.clear();
        for (let id = 0; id < gHumans; id++) {
            const clan = parsedClans[id];
            if (clan === null) continue;
            const territory = playerTerritories[id] || 0;
            const entry = clanTotals.get(clan) || { territory: 0, representativeId: id, representativeTerritory: -1 };
            entry.territory += territory;
            if (territory > entry.representativeTerritory) {
                entry.representativeTerritory = territory;
                entry.representativeId = id;
            }
            clanTotals.set(clan, entry);
        }
        this.rivalsData = Array.from(clanTotals.entries())
            .map(([clan, data]) => ({ clan, territory: data.territory, representativeId: data.representativeId }))
            .sort((a, b) => b.territory - a.territory);
        const ownClan = parsedClans[getVar("playerId")];
        this.ownClanIndex = ownClan == null ? -1 : this.rivalsData.findIndex((entry) => entry.clan === ownClan);
    };
    this.getOwnClanIndex = () => this.ownClanIndex;

    this.drawTabs = function(canvas, totalWidth, verticalOffset, colorForSelectedTab) {
        canvas.textBaseline = "middle";
        canvas.textAlign = "center";
        const tabWidth = totalWidth / this.tabLabels.length;
        const textOffsetY = verticalOffset + this.tabBarOffset / 2;
        //console.log(verticalOffset, this.tabBarOffset, textOffsetY);
        this.tabLabels.forEach((label, index) => {
            if (index !== 0) canvas.fillRect(tabWidth * index, verticalOffset, 1, this.tabBarOffset);
            if (this.selectedTab === index) {
                canvas.fillStyle = colorForSelectedTab;
                canvas.fillRect(tabWidth * index, verticalOffset, tabWidth, this.tabBarOffset);
                canvas.fillStyle = "rgb(255,255,255)";
            }
            if (this.tabHovering === index) {
                canvas.fillStyle = "rgba(255,255,255,0.3)";
                canvas.fillRect(tabWidth * index, verticalOffset, tabWidth, this.tabBarOffset);
                canvas.fillStyle = "rgb(255,255,255)";
            }
            canvas.fillText(label, tabWidth * index + tabWidth / 2, textOffsetY);
        });
    }
    this.setHovering = (isHovering, xRelative) => {
        let repaintNeeded = false;
        if (isHovering) {
            const tab = Math.floor(xRelative / (this.windowWidth / this.tabLabels.length));
            if (this.tabHovering !== tab) {
                this.tabHovering = tab;
                repaintNeeded = true;
            }
        }
        if (isHovering !== this.hoveringOverTabs) {
            this.hoveringOverTabs = isHovering;
            if (isHovering === false) this.tabHovering = -1;
            if (!isHovering) repaintNeeded = true;
        }
        if (repaintNeeded) this.repaintLeaderboard();
        return isHovering;
    }
    this.handleMouseDown = (xRelative) => {
        const tab = Math.floor(xRelative / (this.windowWidth / this.tabLabels.length));
        if (this.selectedTab !== tab) {
            this.selectedTab = tab;
            this.showingRivals = false;
            if (this.selectedTab === 0) this.clearFilter();
            else if (this.selectedTab === 1) {
                this.filterByOwnClan();
                this.setUpdateFlag();
            } else if (this.selectedTab === 2) {
                this.enabled = false;
                this.showingRivals = true;
                this.computeRivals(true);
            }
            this.scrollToTop();
            this.repaintLeaderboard();
        }
        return true;
    };
    this.filterByOwnClan = () => {
        this.playersToInclude = [];
        refreshClanCache();
        const playerId = getVar("playerId");
        const ownClan = parsedClans[playerId];
        for (let id = 0; id < cachedHumanCount; id++)
            if (id === playerId || parsedClans[id] === ownClan) this.playersToInclude.push(id);
        this.enabled = true;
        this.scrollToTop();
    };
    this.clearFilter = () => { this.enabled = false; }
    this.reset = () => {
        this.enabled = false;
        this.showingRivals = false;
        this.selectedTab = 0;
        this.ownClanIndex = -1;
        lastRivalsCompute = 0;
        cachedRawNames = null;
        cachedHumanCount = -1;
        parsedClans = [];
        clanFilter.refresh();
    }
});

export const clanFilter = new (function() {
    this.inOwnClan = new Array(512);
    this.inOwnClan.fill(false);
    this.refresh = () => {
        cachedRawNames = null;
        const gHumans = getVar("gHumans");
        const rawNames = getVar("rawPlayerNames");
        cachedRawNames = rawNames;
        cachedHumanCount = gHumans;
        parsedClans = new Array(gHumans);
        for (let id = 0; id < gHumans; id++) parsedClans[id] = leaderboardFilter.parseClanFromPlayerName(rawNames[id]);
        const ownClan = parsedClans[getVar("playerId")];
        this.inOwnClan.fill(false);
        if (ownClan != null)
            for (let id = 0; id < gHumans; id++) this.inOwnClan[id] = parsedClans[id] === ownClan;
    }
});
