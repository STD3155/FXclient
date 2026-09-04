export default (/** @type {import('../modUtils.js').default} */ { insertCode }) => {
    // One tick before interest is paid, spend only the projected amount above
    // 100 troops per territory when neutral land is directly reachable.
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
            && bi.kj() % 10 === 8 && bv.hx(aE.fB)) {
            var fxAutoExpand = __fx.autoExpand.calculate(
                ah.hT[aE.fB],
                ah.hF[aE.fB],
                Math.max(bO.fs(af.aCn(aE.fB) * ah.hT[aE.fB], 10000), 1) + ah.hF[aE.fB] / 10
            );
            if (fxAutoExpand !== null) {
                if (aE.l6) bB.pg.hy(aE.fB, fxAutoExpand.encoded, aE.fO);
                else b1.pm.pq(fxAutoExpand.encoded, aE.fO);
            }
        }`)
}
