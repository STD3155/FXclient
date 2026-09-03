import ModUtils, { insert } from "../modUtils.js"

// Name rendering patches - Display density of other players & Hide bot names features

export default (/** @type {ModUtils} */ { modifyCode, waitForMinification, matchCode, replaceOne, safeDictionary }) => {

  // Install the growth calculator before Uglify can inline the temporary
  // interest-income variable. The division helper is an object method in the
  // current game code (for example bO.fs), hence the two-part matcher.
  modifyCode(`
    var interestIncome = integerDivisionObject.integerDivision(interestManager.getInterestIncome(player) * playerBalances[player], 10000);
    ${insert(`__fx.utils.getPlayerGrowth = currentPlayer =>
      Math.max(1, integerDivisionObject.integerDivision(
        interestManager.getInterestIncome(currentPlayer) * playerData.playerBalances[currentPlayer], 10000
      )) + playerData.playerTerritories[currentPlayer] / 10;`)}
    balanceManagerObject.balanceManager.addBalance(player, Math.max(interestIncome, 1));`, { dictionary: {
      playerData: safeDictionary.playerData,
      playerBalances: safeDictionary.playerBalances,
      playerTerritories: safeDictionary.playerTerritories,
    } })

  const { placeBalanceAbove } = matchCode(`aLT += Math.floor(0.78 * fontSize);
    if (placeBalanceAbove) {/*...*/}`)
  const { Util, numberFormatter, formatNumber } = matchCode(`
    var balanceText = Util.numberFormatter.formatNumber(playerData.playerBalances[player] - outgoingBalance);`,
    { dictionary: {
      playerData: safeDictionary.playerData,
      playerBalances: safeDictionary.playerBalances,
    } })

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
      if (!placeBalanceAbove && __fx.settings.showPlayerGrowth) {
        ctx.fillStyle = statsColor;
        ctx.fillText("+" + Util.s1.formatNumber(__fx.utils.getPlayerGrowth(i)), x, y + fontSize * statsLine);
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
    { dictionary: { placeBalanceAbove } },
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
        if (${placeBalanceAbove} && __fx.settings.showPlayerGrowth) {
          $<canvas>.fillStyle = ___statsColor;
          $<canvas>.fillText("+" + ${Util}.${numberFormatter}.${formatNumber}(__fx.utils.getPlayerGrowth(___id)), $<x>, ___statsY);
        } }`,
    )
  })
}
