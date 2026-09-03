import ModUtils, { insert } from "../modUtils.js"

// Name rendering patches - Display density of other players & Hide bot names features

export default (/** @type {ModUtils} */ { modifyCode, waitForMinification, matchCode, replaceOne, safeDictionary }) => {

  const { Util, numberFormatter, formatNumber } = matchCode(`
    var balanceText = Util.numberFormatter.formatNumber(playerData.playerBalances[player] - outgoingBalance);`,
    { dictionary: {
      playerData: safeDictionary.playerData,
      playerBalances: safeDictionary.playerBalances,
    } })

  // Reuse the interest income the game has already calculated. Store only the
  // numeric value here; formatting is deferred until a label is actually drawn.
  modifyCode(`
    var interestIncome = integerDivisionObject.integerDivision(interestManager.getInterestIncome(player) * playerBalances[player], 10000);
    ${insert(`if (__fx.utils.isHumanPlayer(player)) {
      var growthValues = __fx.utils.playerGrowth || (__fx.utils.playerGrowth = []);
      growthValues[player] = Math.max(interestIncome, 1) + playerData.playerTerritories[player] / 10;
      (__fx.utils.playerGrowthText || (__fx.utils.playerGrowthText = []))[player] = undefined;
    }`)}
    balanceManagerObject.balanceManager.addBalance(player, Math.max(interestIncome, 1));`, { dictionary: {
      playerBalances: safeDictionary.playerBalances,
      playerData: safeDictionary.playerData,
      playerTerritories: safeDictionary.playerTerritories,
      Util,
      numberFormatter,
      formatNumber,
    } })

  const { placeBalanceAbove } = matchCode(`aLT += Math.floor(0.78 * fontSize);
    if (placeBalanceAbove) {/*...*/}`)

  // Balance rendering; Renders density when the "Reverse Name/Balance" setting is off (default)
  modifyCode(
    `function aLY(ctx, i, fontSize, x, y, aLU) {
    var a4f = playerData.a4f[i];
    var aLe = Util.s1.formatNumber(playerData.playerBalances[i] - a4f);
    ${insert(`function drawPlayerStats() {
      if (__fx.settings.adaptivePlayerStats
          && fontSize < 9 * (__fx.hoveringTooltip.canvasPixelScale || 1)) return;
      var statsColor = ctx.fillStyle;
      var statsLine = 1;
      var statsMode = __fx.settings.playerStatsMode;
      var showDensity = statsMode === "both" || statsMode === "density";
      var showGrowth = statsMode === "both" || statsMode === "growth";
      if (!placeBalanceAbove && showDensity) {
        var densityStats = __fx.utils.getDensityStats(
          i, playerData.playerBalances, playerData.playerTerritories, __fx.settings.densityDisplayStyle
        );
        __fx.settings.coloredDensity && (ctx.fillStyle = densityStats.color);
        ctx.fillText(densityStats.text, x, y + fontSize * statsLine++);
      }
      if (!placeBalanceAbove && showGrowth
          && __fx.utils.playerGrowth && __fx.utils.playerGrowth[i] !== undefined) {
        ctx.fillStyle = statsColor;
        var growthText = __fx.utils.playerGrowthText || (__fx.utils.playerGrowthText = []);
        var growthLabel = growthText[i];
        if (growthLabel === undefined)
          growthLabel = growthText[i] = "+" + Util.s1.formatNumber(__fx.utils.playerGrowth[i]);
        ctx.fillText(growthLabel, x, y + fontSize * statsLine);
      }
      ctx.fillStyle = statsColor;
    }`)}
    if (a4f) {
      var eY = ctx.fillStyle;
      ctx.fillStyle = aLX(fontSize, 2 + aLU % 2);
      ctx.fillText(aLe, x, y);
      ctx.fillStyle = eY;
      ${insert(`drawPlayerStats();`)}
      return;
    }
    if (((aLU >> 1) & 1)) {
      ctx.lineWidth = 0.05 * fontSize;
      ctx.strokeStyle = aLX(fontSize, aLU % 2);
      ctx.strokeText(aLe, x, y);
      ${insert(`drawPlayerStats();`)}
      return;
    }
    if (aLU > 1) {
      ctx.lineWidth = 0.12 * fontSize;
      ctx.strokeStyle = aLX(fontSize, aLU);
      ctx.strokeText(aLe, x, y);
    }
    ctx.fillText(aLe, x, y);
    ${insert(`drawPlayerStats();`)}
  }`,
    { dictionary: {
      placeBalanceAbove,
      playerData: safeDictionary.playerData,
      playerBalances: safeDictionary.playerBalances,
      playerTerritories: safeDictionary.playerTerritories,
    } },
  )

  waitForMinification(() => {
    // Name rendering; Renders density when the "Reverse Name/Balance" setting is on
    // also powers the feature for hiding bot names
    replaceOne(
      /(function \w+\((?<i>\w+),(?<fontSize>\w+),(?<x>\w+),(?<y>\w+),(?<canvas>\w+)\){)(\6\.fillText\((?<playerData>\w+)\.(?<playerNames>\w+)\[\2\],\4,\5\)),(\2<(?<game>\w+)\.(?<gHumans>\w+)&&2!==\8\.(?<playerStates>\w+)\[[^}]+)}/g,
      `$1 var ___id = $2;
        var showName = $<i> < $<game>.$<gHumans> || !__fx.settings.hideBotNames;
        if (showName) $7, $10;
        var ___statsY = showName ? $<y> + $<fontSize> : $<y>;
        var ___statsColor = $<canvas>.fillStyle;
        var ___showStats = !__fx.settings.adaptivePlayerStats
          || $<fontSize> >= 9 * (__fx.hoveringTooltip.canvasPixelScale || 1);
        var ___statsMode = __fx.settings.playerStatsMode;
        var ___showDensity = ___statsMode === "both" || ___statsMode === "density";
        var ___showGrowth = ___statsMode === "both" || ___statsMode === "growth";
        if (___showStats && ${placeBalanceAbove} && ___showDensity) {
          var ___densityStats = __fx.utils.getDensityStats(
            ___id,
            $<playerData>.${safeDictionary.playerBalances},
            $<playerData>.${safeDictionary.playerTerritories},
            __fx.settings.densityDisplayStyle
          );
          __fx.settings.coloredDensity && ($<canvas>.fillStyle = ___densityStats.color);
          $<canvas>.fillText(___densityStats.text, $<x>, ___statsY);
          ___statsY += $<fontSize>;
        }
        if (___showStats && ${placeBalanceAbove} && ___showGrowth
            && __fx.utils.playerGrowth && __fx.utils.playerGrowth[___id] !== undefined) {
          $<canvas>.fillStyle = ___statsColor;
          var ___growthText = __fx.utils.playerGrowthText || (__fx.utils.playerGrowthText = []);
          var ___growthLabel = ___growthText[___id];
          if (___growthLabel === undefined)
            ___growthLabel = ___growthText[___id] = "+" + ${Util}.${numberFormatter}.${formatNumber}(__fx.utils.playerGrowth[___id]);
          $<canvas>.fillText(___growthLabel, $<x>, ___statsY);
        }
        $<canvas>.fillStyle = ___statsColor; }`,
    )
  })
}
