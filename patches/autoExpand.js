export default (/** @type {import('../modUtils.js').default} */ { insertCode, replaceRawCode }) => {
    // Send early enough for a multiplayer server to process the expansion
    // before income is paid. The controller permits only one send per cycle.
    insertCode(`function n0() {
        b2.ed();
        aH.ed();
        ao.ed();
        /* here */
        af.ed();
        b5.ed();
        aG.ed();
        ap.ed();
        bQ.z.ed();
        am.n1();
        aW.ed();
        b0.ed();
        bY.ed();
        ag.ed();
        ag.n2();
        aX.ed();
        bS.ed();
        aV.ed();
        aQ.ed();
        b9.n3();
        aO.ed();
        b6.ed();
        aS.ed();
        ax.ed();
        bg.ed();
        bk.ed();
        b1.z.ed();
        b1.n4.ed();
        u.ed();
        bX.eQ.ed();
        bC.ed();
        bi.ed();
        }`, `if (__fx.economicAttack.isArmed() && !aE.ha && !aN.hb && bD.gn.hc(1) && bD.gn.hd(aE.fB)
            && bi.kj() % 10 === 3) {
            var fxPlayer = aE.fB;
            var fxTick = bi.kj();
            var fxBalance = ah.hT[fxPlayer];
            var fxTerritory = ah.hF[fxPlayer];
            var fxHasNeutral = false;
            var fxBotCandidates = [];
            var fxSeenBots = new Set();
            var fxBorder = ah.h7[fxPlayer];
            var fxDirections = ad.fT;
            for (var fxBorderIndex = fxBorder.length - 1; fxBorderIndex >= 0; fxBorderIndex--) {
                for (var fxDirection = 3; fxDirection >= 0; fxDirection--) {
                    var fxNeighbor = fxBorder[fxBorderIndex] + fxDirections[fxDirection];
                    if (ad.fI(fxNeighbor)) {
                        fxHasNeutral = true;
                    } else if (ad.h1(fxNeighbor)) {
                        var fxTarget = ad.fJ(fxNeighbor);
                        if (fxTarget >= aE.km && fxTarget < aE.fO && !fxSeenBots.has(fxTarget)
                            && bD.gn.hd(fxTarget) && bD.gn.lQ(fxPlayer, fxTarget)) {
                            fxSeenBots.add(fxTarget);
                            fxBotCandidates.push({
                                id: fxTarget,
                                balance: ah.hT[fxTarget],
                                territory: ah.hF[fxTarget],
                                existingAttack: ae.hU(fxPlayer, fxTarget)
                            });
                        }
                    }
                }
            }
            var fxAutoExpand = __fx.autoExpand.planBot(
                fxTick,
                fxBalance,
                aS.hv(),
                fxBotCandidates
            );
            var fxAutoExpandTarget = fxAutoExpand === null ? aE.fO : fxAutoExpand.target;
            if (fxAutoExpand === null && fxHasNeutral) {
                var fxArmyIncomeScale = aE.data.aIncomeType === 0 ? 0
                    : aE.data.aIncomeType === 1 ? aE.data.aIncomeValue : aE.data.aIncomeData[fxPlayer];
                var fxTerritorialIncomeScale = aE.data.tIncomeType === 0 ? 32
                    : aE.data.tIncomeType === 1 ? aE.data.tIncomeValue : aE.data.tIncomeData[fxPlayer];
                var fxNextIncome = __fx.autoExpand.calculateNextIncome(
                    fxBalance,
                    fxTerritory,
                    af.aCn(fxPlayer),
                    fxTick,
                    fxArmyIncomeScale,
                    fxTerritorialIncomeScale
                );
                fxAutoExpand = __fx.autoExpand.plan(
                    fxTick,
                    fxBalance,
                    fxTerritory,
                    fxNextIncome,
                    aE.fO
                );
            }
            if (fxAutoExpand !== null) {
                if (aE.l6) bB.pg.hy(fxPlayer, fxAutoExpand.encoded, fxAutoExpandTarget);
                else b1.pm.pq(fxAutoExpand.encoded, fxAutoExpandTarget);
            }
        }`)

    // Clear the pending request once the authoritative attack event is
    // applied. This avoids duplicate sends when a server response is delayed.
    replaceRawCode(
        `this.hy=function(player,j4,jv){if(!bD.gn.hc(1)){return}if(!bD.gn.hd(player)){return}if(!bD.gn.qh(player,jv)){return}`,
        `this.hy=function(player,j4,jv){if(!bD.gn.hc(1)){return}if(!bD.gn.hd(player)){return}if(!bD.gn.qh(player,jv)){return}if(player===aE.fB){__fx.autoExpand.acknowledge(jv,j4)}`
    )
}
