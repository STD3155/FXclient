// Resolve the game symbols used outside a patch's matched insertion point.
// Those symbols are renamed between Territorial.io releases too.
const cachedBindings = new WeakMap();

export function getAutoExpandBindings(modUtils) {
  if (cachedBindings.has(modUtils)) return cachedBindings.get(modUtils);
  const dictionary = {};
  const bind = (code, names) => {
    const matched = modUtils.matchCode(code);
    for (const name of names.split(' ')) {
      if (!matched[name]) throw new Error(`Missing automatic attack binding: ${name}`);
      if (dictionary[name] && dictionary[name] !== matched[name]) {
        throw new Error(`Conflicting automatic attack binding: ${name}`);
      }
      dictionary[name] = matched[name];
    }
  };
  bind(`this.hZ = function(code) {
    if (aE.ha || aN.hb) { return; }
    if (!bD.gn.hc(0) && !bD.gn.hc(1)) { return; }
    if (!bD.gn.hd(aE.fB)) { return; } /*...*/ }`, 'aE ha aN hb bD gn hc hd fB');
  bind(`this.lQ = function(player, jv) {
    return player !== jv && (bj.fP[player] === 0 || bj.fP[player] !== bj.fP[jv]);
  };`, 'lQ');
  bind(`this.jn = function(player) {
    var fT = ad.fT;
    for (var aC = ah.h7[player].length - 1; aC >= 0; aC--) {
      if (ad.jx(ah.h7[player][aC])) {
        for (var iI = 3; iI >= 0; iI--) {
          if (ad.fI(ah.h7[player][aC] + fT[iI])) {
            ah.gt[player].push(ah.h7[player][aC]); break;
          }
        }
      }
    }
  };`, 'ad fT ah h7 fI');
  bind(`this.aIm = function(f5, player) {
    return this.fI(f5) || this.h1(f5) && player !== this.fJ(f5);
  };`, 'h1 fJ');
  bind(`function aKl(player) {
    if (bD.gn.k9(player) && player < aE.km) { return 0; }
    var eF = aKj[bO.fs((aE.fO - 1) * ah.hF[player], aE.kW)]; /*...*/ }`, 'km fO hF kW');
  bind(`var kD = ah.hT[kC] + ae.hU(kC, player);`, 'hT ae hU');
  bind(`var aKv = bO.fs(af.aCn(gz) * hT[gz], 10000);`, 'af aCn');
  bind(`gL = bO.fs(gJ, gN); if (gL > aE.gl) { return true; }`, 'gl');
  bind(`this.hy = function(j4, jv) {
    if (this.pl) { this.pl = 0; bm.po.pp(182, j4); }
    if (aE.l6) { bB.pg.hy(aE.fB, j4, jv); }
    else { b1.pm.pq(j4, jv); }
  };`, 'l6 bB pg hy b1 pm pq j4');
  bind(`var fG = bP.fH(ho); var ht = ad.fI(fG) ? aE.fO : ad.fJ(fG); bB.hr.hu(aS.hv(), ho, ht);`, 'aS hv');
  bind(`this.ed = function() { this.a1X.adC++; };
    this.kj = function() { return this.a1X.adC; };`, 'kj');
  bind(`this.a1X = null; this.dq = false; this.eY = 0; this.aCo = 56;`, 'aCo');
  bind(`bi.eY = adZ = performance.now(); bi.a1X.ed(); window.requestAnimationFrame(ada);`, 'bi');
  bind(`var jm = ae.k7(player, bR.fN[0]);`, 'bR fN');
  cachedBindings.set(modUtils, dictionary);
  return dictionary;
}
