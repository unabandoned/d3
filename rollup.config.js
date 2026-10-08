import {readFileSync} from "fs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const meta = JSON.parse(readFileSync("./package.json", "utf-8"));

// Extract copyrights from the LICENSE.
const copyright = readFileSync("./LICENSE", "utf-8")
  .split(/\n/g)
  .filter(line => /^Copyright\s+/.test(line))
  .map(line => line.replace(/^Copyright\s+/, ""))
  .join(", ");

const banner = `// ${meta.homepage} v${meta.version} Copyright ${copyright}`;

// bundle.js re-exports the package version for the UMD global (d3.version), as
// upstream did. Serve it as a virtual module instead of pulling in a JSON plugin.
const version = {
  name: "version",
  resolveId: id => id === "\0version" ? id : null,
  load: id => id === "\0version" ? `export const version = ${JSON.stringify(meta.version)};` : null
};

const base = {
  // Every d3-* module (and their own dependencies: internmap, delaunator,
  // robust-predicates) is resolved from node_modules and inlined, so the
  // published package has no runtime dependencies at all.
  plugins: [nodeResolve(), version],
  onwarn(message, warn) {
    if (message.code === "CIRCULAR_DEPENDENCY") return;
    warn(message);
  }
};

export default [
  // Module bundles, what `import`/`require("@unabandoned/d3")` resolve to. Built
  // from src/index.js so the export names are exactly upstream's package entry
  // (which never exported `version`).
  {
    ...base,
    input: "src/index.js",
    output: [
      {file: "dist/d3.mjs", format: "esm", indent: false, banner},
      {file: "dist/d3.cjs", format: "cjs", indent: false, banner}
    ]
  },
  // Browser globals bundles, unchanged from upstream (CDN / <script> use).
  {
    ...base,
    input: "bundle.js",
    output: [
      {file: "dist/d3.js", name: "d3", format: "umd", indent: false, extend: true, banner},
      {
        file: "dist/d3.min.js", name: "d3", format: "umd", indent: false, extend: true, banner,
        plugins: [
          terser({
            output: {preamble: banner},
            mangle: {reserved: ["InternMap", "InternSet"]}
          })
        ]
      }
    ]
  }
];
