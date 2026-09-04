export default (/** @type {import('../modUtils.js').default} */ { insertCode, replaceRawCode }) => {
    // Start a small, land-aware expansion after an income tick when the
    // two-cycle forecast reaches the growth limit. Tick three remains the
    // authoritative safety correction and bot-opportunity pass.
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
            && (bi.kj() % 10 === 0 || bi.kj() % 10 === 3)) {
            var fxPlayer = aE.fB;
            var fxTick = bi.kj();
            var fxIsCorrectionTick = fxTick % 10 === 3;
            var fxBalance = ah.hT[fxPlayer];
            var fxTerritory = ah.hF[fxPlayer];
            var fxSeenNeutral = new Set();
            var fxCompetitorNearby = false;
            var fxBotCandidates = [];
            var fxSeenBots = new Set();
            var fxBorder = ah.h7[fxPlayer];
            var fxDirections = ad.fT;
            for (var fxBorderIndex = fxBorder.length - 1; fxBorderIndex >= 0; fxBorderIndex--) {
                for (var fxDirection = 3; fxDirection >= 0; fxDirection--) {
                    var fxNeighbor = fxBorder[fxBorderIndex] + fxDirections[fxDirection];
                    if (ad.fI(fxNeighbor)) {
                        fxSeenNeutral.add(fxNeighbor);
                    } else if (ad.h1(fxNeighbor)) {
                        var fxTarget = ad.fJ(fxNeighbor);
                        if (fxTarget < aE.km && fxTarget !== fxPlayer && bD.gn.hd(fxTarget)
                            && bD.gn.lQ(fxPlayer, fxTarget)) {
                            fxCompetitorNearby = true;
                        } else if (fxIsCorrectionTick && fxTarget >= aE.km && fxTarget < aE.fO && !fxSeenBots.has(fxTarget)
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
            var fxNeutralLayerSizes = [fxSeenNeutral.size];
            if (!fxIsCorrectionTick && fxSeenNeutral.size > 0) {
                var fxNeutralLayer = Array.from(fxSeenNeutral);
                for (var fxLayerDepth = 1; fxLayerDepth < 5; fxLayerDepth++) {
                    var fxNextNeutralLayer = [];
                    for (var fxLayerIndex = fxNeutralLayer.length - 1; fxLayerIndex >= 0; fxLayerIndex--) {
                        for (var fxLayerDirection = 3; fxLayerDirection >= 0; fxLayerDirection--) {
                            var fxLayerNeighbor = fxNeutralLayer[fxLayerIndex] + fxDirections[fxLayerDirection];
                            if (!ad.fW(fxLayerNeighbor)) continue;
                            if (ad.fI(fxLayerNeighbor)) {
                                if (!fxSeenNeutral.has(fxLayerNeighbor)) {
                                    fxSeenNeutral.add(fxLayerNeighbor);
                                    fxNextNeutralLayer.push(fxLayerNeighbor);
                                }
                            } else if (ad.h1(fxLayerNeighbor)) {
                                var fxLayerTarget = ad.fJ(fxLayerNeighbor);
                                if (fxLayerDepth <= 2 && fxLayerTarget < aE.km && fxLayerTarget !== fxPlayer && bD.gn.hd(fxLayerTarget)
                                    && bD.gn.lQ(fxPlayer, fxLayerTarget)) {
                                    fxCompetitorNearby = true;
                                }
                            }
                        }
                    }
                    fxNeutralLayerSizes.push(fxNextNeutralLayer.length);
                    fxNeutralLayer = fxNextNeutralLayer;
                    if (fxNeutralLayer.length === 0) break;
                }
            }
            var fxArmyIncomeScale = aE.data.aIncomeType === 0 ? 0
                : aE.data.aIncomeType === 1 ? aE.data.aIncomeValue : aE.data.aIncomeData[fxPlayer];
            var fxTerritorialIncomeScale = aE.data.tIncomeType === 0 ? 32
                : aE.data.tIncomeType === 1 ? aE.data.tIncomeValue : aE.data.tIncomeData[fxPlayer];
            var fxAutoExpand = null;
            var fxAutoExpandTarget = aE.fO;
            var fxAttackPercentage = aS.hv();
            var fxExistingNeutralAttack = ae.hU(fxPlayer, aE.fO);
            if (!fxIsCorrectionTick && fxNeutralLayerSizes[0] > 0 && fxExistingNeutralAttack === 0) {
                if (fxTick < 600) {
                    fxAutoExpand = __fx.autoExpand.planOpening(
                        fxTick,
                        fxBalance,
                        fxNeutralLayerSizes,
                        fxAttackPercentage,
                        fxCompetitorNearby,
                        aE.fO
                    );
                } else {
                    var fxProjectedBalance = __fx.autoExpand.projectBalance(
                        fxBalance,
                        fxTerritory,
                        af.aCn(fxPlayer),
                        fxTick,
                        fxArmyIncomeScale,
                        fxTerritorialIncomeScale,
                        2
                    );
                    fxAutoExpand = __fx.autoExpand.planProactive(
                        fxTick,
                        fxBalance,
                        fxTerritory,
                        fxProjectedBalance,
                        fxNeutralLayerSizes[0],
                        aE.fO,
                        fxAttackPercentage
                    );
                }
            } else if (fxIsCorrectionTick) {
                fxAutoExpand = __fx.autoExpand.planBot(
                    fxTick,
                    fxBalance,
                    fxAttackPercentage,
                    fxBotCandidates,
                    fxNeutralLayerSizes[0] > 0
                );
                fxAutoExpandTarget = fxAutoExpand === null ? aE.fO : fxAutoExpand.target;
            }
            if (fxAutoExpand === null && fxIsCorrectionTick && fxNeutralLayerSizes[0] > 0) {
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
                    aE.fO,
                    fxAttackPercentage
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
