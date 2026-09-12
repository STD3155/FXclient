import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import UglifyJS from 'uglify-js';
import ModUtils, { minifyCode } from '../modUtils.js';
import autoExpandPatch from '../patches/autoExpand.js';
import economicAttackPatch from '../patches/economicAttack.js';
import { getAutoExpandBindings } from '../scripts/autoExpandBindings.js';

const fixture = fs.readFileSync(new URL('./fixtures/autoExpandGame.txt', import.meta.url), 'utf8');
const originalBindings = getAutoExpandBindings(new ModUtils(minifyCode(fixture)));

// Change every external game binding, including properties not present in the
// tick-loop insertion point. Unit tests with old-name mocks missed this case.
const renamedBindings = Object.fromEntries(Object.keys(originalBindings).map((name, i) => [name, `changed${i}`]));
const rename = code => code.replace(/\b\w+\b/g, word => renamedBindings[word] ?? word);

function patchedFunctions() {
  const utils = new ModUtils(minifyCode(rename(fixture)));
  autoExpandPatch(utils);
  economicAttackPatch(utils);
  const functions = {};
  UglifyJS.parse(`function fixture(){${utils.script}}`).walk(new UglifyJS.TreeWalker(node => {
    if (node instanceof UglifyJS.AST_Defun) functions[node.name.name] = node.print_to_string();
    if (node instanceof UglifyJS.AST_Assign && node.left.print_to_string() === `this.${renamedBindings.hy}`) {
      functions.send = node.right.print_to_string();
    }
  }));
  return functions;
}

function contextFor(tick, singleplayer) {
  const context = {};
  const assign = (path, value) => {
    const parts = rename(path).split('.');
    let target = context;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = value;
  };
  const noop = () => {};
  const tickCalls = fixture.match(/function n0\(\)\{([^}]+)\}/)[1];
  for (const [, path] of tickCalls.matchAll(/([\w.]+)\(\)/g)) assign(path, noop);
  for (const [path, value] of Object.entries({
    'aE.ha': false, 'aN.hb': false, 'aE.fB': 0, 'aE.fO': 512, 'aE.km': 1,
    'aE.l6': singleplayer, 'aE.gl': 2, 'aE.kW': 1000000,
    'aE.data': { aIncomeType: 0, tIncomeType: 0, iIncomeType: 0 },
    'bD.gn.hc': () => true, 'bD.gn.hd': () => true, 'bD.gn.lQ': () => true,
    'ah.hT': [864, 50], 'ah.hF': [12, 10], 'ah.h7': [[0]],
    'ad.fT': [1], 'ad.fI': cell => cell > 0, 'ad.h1': () => false, 'ad.fJ': () => 1,
    'ae.hU': () => 0, 'aS.hv': () => 511, 'af.aCn': () => 700,
    'bi.kj': () => tick, 'bi.aCo': 56, 'bR.fN': [512],
    'ap.jX.jl': () => true, 'bD.gn.mw': noop
  })) assign(path, value);
  const sends = [];
  assign('bB.pg.hy', (...args) => sends.push(['local', ...args]));
  assign('b1.pm.pq', (...args) => sends.push(['server', ...args]));
  return { context, sends };
}

test('renamed game symbols support the first tick and automatic local/server attacks', () => {
  const functions = patchedFunctions();
  for (const singleplayer of [false, true]) {
    const { context, sends } = contextFor(70, singleplayer);
    const planning = [];
    context.__fx = {
      economicAttack: { isArmed: () => true },
      autoExpand: {
        openingEndTick: 600, openingFrontierDepth: 48, openingFrontierTileLimit: 32768,
        update: (tick, duration) => assert.deepEqual([tick, duration], [70, 56]),
        canPlan: () => true, shouldPlanOpening: () => true,
        analyzeFrontier: ({border, directions, isNeutral, getOwner}) => {
          assert.deepEqual(border, [0]); assert.deepEqual(directions, [1]);
          assert.equal(isNeutral(1), true); assert.equal(getOwner(1), null);
          return { neutralLayerSizes: [16], adjacentOwners: [1], nearbyOwners: [1] };
        },
        calculateInterestIncome: (balance, rate) => {
          assert.deepEqual([balance, rate], [864, 700]); return 60;
        },
        planOpening: (...args) => { planning.push(args); return { encoded: 127 }; }
      }
    };
    vm.runInNewContext(`${functions.n0}; n0();`, context);
    assert.equal(planning.length, 1);
    assert.equal(planning[0][1], 864);
    assert.equal(planning[0][7].territory, 12);
    assert.equal(planning[0][7].commandDelayTicks, singleplayer ? 0 : 10);
    assert.deepEqual(sends, [singleplayer ? ['local', 0, 127, 512] : ['server', 127, 512]]);
  }
});

test('renamed balances and attack handlers support manual ECO attacks and acknowledgements', () => {
  const functions = patchedFunctions();
  for (const singleplayer of [false, true]) {
    const { context, sends } = contextFor(80, singleplayer);
    let resolved, acknowledged;
    context.__fx = {
      economicAttack: { resolve: (...args) => { resolved = args; return 127; } },
      autoExpand: { acknowledge: (...args) => { acknowledged = args; } }
    };
    vm.runInNewContext(`(${functions.send}).call({},511,1); ${functions.acceptedAttack}; acceptedAttack(0,127,1);`, context);
    assert.deepEqual(resolved, [511, 864, 50, 10, 0]);
    assert.deepEqual(acknowledged, [512, 127, 80]);
    assert.deepEqual(sends, [singleplayer ? ['local', 0, 127, 1] : ['server', 127, 1]]);
  }
});
