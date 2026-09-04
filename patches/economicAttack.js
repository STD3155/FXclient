export default (/** @type {import('../modUtils.js').default} */ { insertCode }) => {
    // Resolve every outgoing land attack in one place. When ECO is armed this
    // caps the required conquest amount at the percentage selected by the user.
    insertCode(`this.hy = function(j4, jv) {
        if (this.pl) { this.pl = 0; bm.po.pp(182, j4); }
        /* here */
        if (aE.l6) { bB.pg.hy(aE.fB, j4, jv); }
        else { b1.pm.pq(j4, jv); }
    }`, `j4 = __fx.economicAttack.resolve(
            j4,
            ah.hT[aE.fB],
            jv < aE.fO ? ah.hT[jv] : null,
            jv < aE.fO ? ah.hF[jv] : null,
            jv < aE.fO ? ae.hU(aE.fB, jv) : 0
        );
        if (j4 === null) return;`)
}
