import assert from "node:assert";
import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import * as d3 from "../src/index.js";

const require = createRequire(import.meta.url);
const packageData = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

// The d3-* modules are devDependencies here: the build inlines them into dist/.
const moduleNames = Object.keys(packageData.devDependencies).filter(name => name.startsWith("d3-"));

test("bundles all thirty d3 modules", () => {
  assert.strictEqual(moduleNames.length, 30);
});

test("declares no runtime dependencies", () => {
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert.strictEqual(packageData[field], undefined, `package.json has ${field}`);
  }
});

for (const moduleName of moduleNames) {
  test(`d3 exports everything from ${moduleName}`, async () => {
    const module = await import(moduleName);
    for (const propertyName in module) {
      if (propertyName !== "version") {
        assert(propertyName in d3, `${moduleName} exports ${propertyName}`);
      }
    }
  });
}

// The published entry points are the bundles, which only exist after a build.
const expected = Object.keys(d3).sort();

test("the ESM bundle exports exactly what src/index.js does", async () => {
  const bundle = await import("../dist/d3.mjs");
  assert.deepStrictEqual(Object.keys(bundle).sort(), expected);
});

test("the CommonJS bundle exports exactly what src/index.js does", () => {
  const bundle = require("../dist/d3.cjs");
  assert.deepStrictEqual(Object.keys(bundle).sort(), expected);
});

test("the bundles are self-contained", () => {
  for (const file of ["d3.mjs", "d3.cjs", "d3.js"]) {
    const source = readFileSync(new URL(`../dist/${file}`, import.meta.url), "utf-8");
    assert.doesNotMatch(source, /^\s*import\s.*\sfrom\s/m, `${file} imports a module`);
    assert.doesNotMatch(source, /\brequire\(["'][^"']+["']\)/, `${file} requires a module`);
  }
});

test("the bundles keep d3-transition's selection side effects", async () => {
  const bundle = await import("../dist/d3.mjs");
  assert.strictEqual(typeof bundle.selection.prototype.transition, "function");
  assert.strictEqual(typeof require("../dist/d3.cjs").selection.prototype.interrupt, "function");
});

test("the bundles work", async () => {
  for (const bundle of [await import("../dist/d3.mjs"), require("../dist/d3.cjs")]) {
    assert.deepStrictEqual(bundle.extent([3, 1, 2]), [1, 3]);
    assert.strictEqual(bundle.scaleLinear().domain([0, 10]).range([0, 100])(5), 50);
    assert.strictEqual(bundle.interpolateLab("red", "blue")(0), "rgb(255, 0, 0)");
    assert.deepStrictEqual(bundle.csvParse("a,b\n1,2").columns, ["a", "b"]);
  }
});
