import ModUtils, { insert } from "../modUtils.js"

// Name rendering patches - Display density of other players & Hide bot names features

export default (/** @type {ModUtils} */ { modifyCode, waitForMinification, matchCode, replaceOne, safeDictionary }) => {

  const { Util, numberFormatter, formatNumber } = matchCode(`
    var balanceText = Util.numberFormatter.formatNumber(playerData.playerBalances[player] - outgoingBalance);`,
    { dictionary: {
      playerData: safeDictionary.playerData,
      playerBalances: safeDictionary.playerBalances,
    } })

  // Reuse the interest income the game has already calculated and cache the
  // formatted growth text for humans only. Rendering then only draws the text.
  modifyCode(`
    var interestIncome = integerDivisionObject.integerDivision(interestManager.getInterestIncome(player) * playerBalances[player], 10000);
    ${insert(`if (__fx.utils.isHumanPlayer(player)) {
      var growthValues = __fx.utils.playerGrowth || (__fx.utils.playerGrowth = []);
      growthValues[player] = "+" + Util.numberFormatter.formatNumber(
        Math.max(interestIncome, 1) + playerData.playerTerritories[player] / 10
      );
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
      var statsColor = ctx.fillStyle;
      var statsLine = 1;
      if (!placeBalanceAbove && __fx.settings.showPlayerDensity)
        __fx.settings.coloredDensity && (ctx.fillStyle = __fx.utils.textStyleBasedOnDensity(i)), ctx.fillText(__fx.utils.getDensity(i), x, y + fontSize * statsLine++);
      if (!placeBalanceAbove && __fx.settings.showPlayerGrowth
          && __fx.utils.playerGrowth && __fx.utils.playerGrowth[i] !== undefined) {
        ctx.fillStyle = statsColor;
        ctx.fillText(__fx.utils.playerGrowth[i], x, y + fontSize * statsLine);
      }
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
        if (${placeBalanceAbove} && __fx.settings.showPlayerDensity) {
          __fx.settings.coloredDensity && ($<canvas>.fillStyle = __fx.utils.textStyleBasedOnDensity(___id));
          $<canvas>.fillText(__fx.utils.getDensity(___id), $<x>, ___statsY);
          ___statsY += $<fontSize>;
        }
        if (${placeBalanceAbove} && __fx.settings.showPlayerGrowth
            && __fx.utils.playerGrowth && __fx.utils.playerGrowth[___id] !== undefined) {
          $<canvas>.fillStyle = ___statsColor;
          $<canvas>.fillText(__fx.utils.playerGrowth[___id], $<x>, ___statsY);
        } }`,
    )
  })
}
