/**
 * packaging gate: does the built output actually resolve as ESM?
 *
 * tsc emits relative import specifiers exactly as written in the source. with
 * `moduleResolution: "bundler"` that means extensionless ones, and node's ESM
 * resolver refuses those — including `./Visualization` for a directory, which
 * is a "directory import" it will not guess. the result is a package that works
 * in every bundler and nowhere else, which is exactly how 2.0.0-beta.1 shipped.
 *
 * a bundler will not catch this. the consumer that hit it was on Vite. so this
 * checks the emitted files directly instead of resolving them through a
 * bundler-shaped tool, which would repeat the same wrong assumption.
 *
 * run after `npm run build`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DIST = 'dist';
const OPTIONAL_PEERS = ['d-piano', 'tone'];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const problems = [];
const files = walk(DIST).filter((f) => f.endsWith('.js'));

/**
 * matches `from '...'`, `export ... from '...'` and dynamic `import('...')`.
 * bare specifiers like 'tone' are a consumer concern, not ours; only relative
 * ones have to point at a real file we shipped.
 */
const SPECIFIER = /(?:\bfrom\s+|import\s*\(\s*)(['"])([^'"]+)\1/g;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const [, , spec] of source.matchAll(SPECIFIER)) {
    if (!spec.startsWith('.')) continue;

    if (!spec.endsWith('.js')) {
      problems.push(`${file}: "${spec}" has no .js extension — node cannot resolve it`);
      continue;
    }
    if (!existsSync(resolve(dirname(file), spec))) {
      problems.push(`${file}: "${spec}" does not exist`);
    }
  }
}

/**
 * every target in the exports map has to be a file we actually shipped, or the
 * entry point 404s at install time.
 */
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const [subpath, map] of Object.entries(pkg.exports ?? {})) {
  // a subpath may map straight to a file ("./package.json": "./package.json")
  // or to a conditions object ({ ".": { types: ..., default: ... } }).
  const targets = typeof map === 'string' ? [map] : Object.values(map);
  for (const target of targets) {
    if (typeof target !== 'string' || target.startsWith('node:')) continue;
    if (!existsSync(target.replace(/^\.\//, ''))) {
      problems.push(`exports "${subpath}" -> ${target} is missing`);
    }
  }
}

/**
 * optional peers must stay optional: importing them at module scope would make
 * the render-only bundle require them.
 */
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const peer of OPTIONAL_PEERS) {
    const staticImport = new RegExp(`^\\s*import[^\\n]*['"]${peer}['"]`, 'm');
    if (staticImport.test(source) && !file.includes('audio')) {
      problems.push(`${file}: statically imports optional peer "${peer}"`);
    }
  }
}

if (problems.length) {
  console.error(`packaging broken (${problems.length} problem(s)):\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `packaging intact — ${files.length} modules resolve as ESM, ` +
    `${Object.keys(pkg.exports ?? {}).length} entry points present, optional peers stay optional`
);
