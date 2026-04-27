#!/usr/bin/env node
/**
 * Complexity Checker
 * Scans JavaScript files and reports cyclomatic complexity per function.
 * Uses a lightweight AST-based approach without requiring external parsers.
 * Target: complexity < 10 per function (aligns with ESLint rule).
 *
 * Usage: node Exercise_4/quality/complexity-check.js [--threshold <n>] [--dir <path>]
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT  = path.resolve(__dirname, '../..');
const REPORT_DIR    = path.resolve(__dirname, '../reports');
const REPORT_FILE   = path.join(REPORT_DIR, 'complexity-report.json');
const DEFAULT_THRESHOLD = 10;

// Parse CLI args
const args      = process.argv.slice(2);
const threshold = parseInt(args[args.indexOf('--threshold') + 1] || DEFAULT_THRESHOLD, 10);
const targetDir = args[args.indexOf('--dir') + 1] || PROJECT_ROOT;

const SCAN_DIRS = [
  'Exercise_1',
  'Exercise_2',
  'Exercise_4/page-objects',
  'Exercise_4/tests',
  'Exercise_4/quality',
  'Exercise_4/security',
  'Exercise_4/reports',
];

const SKIP_PATTERNS = ['node_modules', '.git', 'venv', '__pycache__'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function collectJsFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_PATTERNS.some(p => entry.name.includes(p))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Estimates cyclomatic complexity of a function body using token counting.
 * Complexity = 1 + count of branching keywords.
 */
function estimateComplexity(src) {
  const branchTokens = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bdo\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\b\?\s*:/g,        // ternary
    /&&/g,
    /\|\|/g,
    /\?\?/g,            // nullish coalescing
  ];
  let count = 1;
  for (const pattern of branchTokens) {
    const matches = src.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

/**
 * Extracts function definitions from source code with approximate line numbers.
 * Matches: function foo(), const foo = () =>, const foo = function()
 */
function extractFunctions(src, filePath) {
  const lines     = src.split('\n');
  const functions = [];

  const patterns = [
    /^(?:async\s+)?function\s+(\w+)\s*\(/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?function/,
    /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        // Grab up to 60 subsequent lines as the function "body"
        const body = lines.slice(i, Math.min(i + 60, lines.length)).join('\n');
        const complexity = estimateComplexity(body);
        functions.push({
          name:       match[1] || '(anonymous)',
          line:       i + 1,
          complexity,
          file:       path.relative(PROJECT_ROOT, filePath),
          exceeds:    complexity > threshold,
        });
        break;
      }
    }
  }
  return functions;
}

function analyzeFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8');
  return extractFunctions(src, filePath);
}

function printReport(allFunctions) {
  const PASS = '\x1b[32m✔\x1b[0m';
  const FAIL = '\x1b[31m✘\x1b[0m';

  const violations = allFunctions.filter(f => f.exceeds);
  const maxFound   = allFunctions.reduce((m, f) => Math.max(m, f.complexity), 0);

  console.log('\n========================================');
  console.log('  COMPLEXITY ANALYSIS REPORT');
  console.log('========================================');
  console.log(`  Threshold:         ${threshold}`);
  console.log(`  Functions scanned: ${allFunctions.length}`);
  console.log(`  Max complexity:    ${maxFound}`);
  console.log(`  Violations:        ${violations.length}`);

  if (violations.length === 0) {
    console.log(`\n  ${PASS} All functions meet complexity target (<${threshold})`);
  } else {
    console.log(`\n  ${FAIL} Functions exceeding threshold:`);
    violations.forEach(v => {
      console.log(`    ${FAIL} ${v.file}:${v.line} – ${v.name}() complexity=${v.complexity}`);
    });
  }

  console.log('\n  Top 5 most complex functions:');
  [...allFunctions]
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 5)
    .forEach((f, i) => {
      const icon = f.exceeds ? FAIL : PASS;
      console.log(`    ${i + 1}. ${icon} ${f.name}() [${f.file}:${f.line}] complexity=${f.complexity}`);
    });

  console.log('\n========================================');
  const passed = violations.length === 0;
  console.log(`  Quality gate: ${passed ? PASS + ' PASSED' : FAIL + ' FAILED'}`);
  console.log('========================================\n');

  return passed;
}

function main() {
  ensureDir(REPORT_DIR);

  console.log('Running complexity analysis...');

  const allFunctions = [];
  for (const dir of SCAN_DIRS) {
    const files = collectJsFiles(path.join(PROJECT_ROOT, dir));
    files.forEach(f => {
      allFunctions.push(...analyzeFile(f));
    });
  }

  const violations  = allFunctions.filter(f => f.exceeds);
  const maxFound    = allFunctions.reduce((m, f) => Math.max(m, f.complexity), 0);

  const report = {
    timestamp:   new Date().toISOString(),
    threshold,
    summary: {
      functionsScanned: allFunctions.length,
      violations:       violations.length,
      maxComplexity:    maxFound,
      averageComplexity: allFunctions.length
        ? (allFunctions.reduce((s, f) => s + f.complexity, 0) / allFunctions.length).toFixed(2)
        : 0,
    },
    qualityTarget: {
      maxAllowed: threshold,
      met:        violations.length === 0,
    },
    violations,
    allFunctions,
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Report written to: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);

  const passed = printReport(allFunctions);
  process.exit(passed ? 0 : 1);
}

main();
