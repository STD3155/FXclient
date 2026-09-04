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
            var fxBorder = ah.h7[fxPlayer];
            var fxDirections = ad.fT;
            var fxAnalysis = __fx.autoExpand.analyzeFrontier({
                border: fxBorder,
                directions: fxDirections,
                isNeutral: function(fxCell) { return ad.fI(fxCell); },
                getOwner: function(fxCell) { return ad.h1(fxCell) ? ad.fJ(fxCell) : null; },
                maxDepth: fxIsCorrectionTick ? 1 : 5,
                ownerSearchDepth: 2
            });
            var fxNeutralLayerSizes = fxAnalysis.neutralLayerSizes;
            var fxCompetitorNearby = false;
            for (var fxOwnerIndex = fxAnalysis.nearbyOwners.length - 1; fxOwnerIndex >= 0; fxOwnerIndex--) {
                var fxOwner = fxAnalysis.nearbyOwners[fxOwnerIndex];
                if (fxOwner < aE.km && fxOwner !== fxPlayer && bD.gn.hd(fxOwner)
                    && bD.gn.lQ(fxPlayer, fxOwner)) {
                    fxCompetitorNearby = true;
                    break;
                }
            }
            var fxBotCandidates = [];
            if (fxIsCorrectionTick) {
                for (var fxBotIndex = fxAnalysis.adjacentOwners.length - 1; fxBotIndex >= 0; fxBotIndex--) {
                    var fxBotTarget = fxAnalysis.adjacentOwners[fxBotIndex];
                    if (fxBotTarget >= aE.km && fxBotTarget < aE.fO && bD.gn.hd(fxBotTarget)
                        && bD.gn.lQ(fxPlayer, fxBotTarget)) {
                        fxBotCandidates.push({
                            id: fxBotTarget,
                            balance: ah.hT[fxBotTarget],
                            territory: ah.hF[fxBotTarget],
                            existingAttack: ae.hU(fxPlayer, fxBotTarget)
                        });
                    }
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
                        aE.fO,
                        aE.gl
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
                        fxAttackPercentage,
                        aE.gl
                    );
                }
            } else if (fxIsCorrectionTick) {
                var fxNextIncome = fxNeutralLayerSizes[0] > 0
                    ? __fx.autoExpand.calculateNextIncome(
                        fxBalance,
                        fxTerritory,
                        af.aCn(fxPlayer),
                        fxTick,
                        fxArmyIncomeScale,
                        fxTerritorialIncomeScale
                    )
                    : 0;
                fxAutoExpand = __fx.autoExpand.planCorrection(
                    fxTick,
                    fxBalance,
                    fxTerritory,
                    fxNextIncome,
                    fxNeutralLayerSizes[0],
                    aE.fO,
                    fxAttackPercentage,
                    fxBotCandidates,
                    aE.gl
                );
                fxAutoExpandTarget = fxAutoExpand === null ? aE.fO : fxAutoExpand.target;
            }
            if (fxAutoExpand !== null) {
                if (aE.l6) bB.pg.hy(fxPlayer, fxAutoExpand.encoded, fxAutoExpandTarget);
                else b1.pm.pq(fxAutoExpand.encoded, fxAutoExpandTarget);
            }
        }`)

    // Clear the pending request only after the authoritative event passed all
    // validation and created or reinforced the attack.
    replaceRawCode(
        `if(!ap.jX.jl(player,jm)){return}bD.gn.mw(player)`,
        `if(!ap.jX.jl(player,jm)){return}if(player===aE.fB){__fx.autoExpand.acknowledge(bR.fN[0],j4)}bD.gn.mw(player)`
    )
}
