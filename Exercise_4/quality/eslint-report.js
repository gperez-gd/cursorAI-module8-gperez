#!/usr/bin/env node
/**
 * ESLint Report Generator
 * Runs ESLint across the project and outputs a structured JSON + console summary.
 * Tracks: error count, warning count, files with violations, complexity violations.
 *
 * Usage: node Exercise_4/quality/eslint-report.js
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR   = path.resolve(__dirname, '../reports');
const REPORT_FILE  = path.join(REPORT_DIR, 'eslint-report.json');

const TARGET_DIRS = [
  'Exercise_1',
  'Exercise_2',
  'Exercise_4/page-objects',
  'Exercise_4/tests',
  'Exercise_4/quality',
  'Exercise_4/security',
  'Exercise_4/reports',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function runEsLint() {
  const eslintBin  = path.join(PROJECT_ROOT, 'node_modules/.bin/eslint');
  const configFile = path.resolve(__dirname, '.eslintrc.json');
  const targets    = TARGET_DIRS.map(d => path.join(PROJECT_ROOT, d)).join(' ');

  const cmd = `"${eslintBin}" --format json --config "${configFile}" --no-eslintrc ${targets}`;

  const result = spawnSync('node', [eslintBin, '--format', 'json',
    '--config', configFile, '--no-eslintrc', ...TARGET_DIRS.map(d => path.join(PROJECT_ROOT, d))
  ], { cwd: PROJECT_ROOT, encoding: 'utf-8' });

  return result.stdout || '[]';
}

function parseResults(rawJson) {
  let results;
  try {
    results = JSON.parse(rawJson);
  } catch {
    console.warn('Could not parse ESLint JSON output; returning empty result set.');
    results = [];
  }

  let totalErrors   = 0;
  let totalWarnings = 0;
  const filesWithIssues = [];
  const complexityViolations = [];

  for (const file of results) {
    const relPath = path.relative(PROJECT_ROOT, file.filePath);
    totalErrors   += file.errorCount;
    totalWarnings += file.warningCount;

    if (file.errorCount > 0 || file.warningCount > 0) {
      filesWithIssues.push({
        file:     relPath,
        errors:   file.errorCount,
        warnings: file.warningCount,
        messages: file.messages.map(m => ({
          line:     m.line,
          column:   m.column,
          severity: m.severity === 2 ? 'error' : 'warning',
          rule:     m.ruleId,
          message:  m.message,
        })),
      });

      const complexityMsgs = file.messages.filter(m => m.ruleId === 'complexity');
      complexityMsgs.forEach(m => {
        complexityViolations.push({ file: relPath, line: m.line, message: m.message });
      });
    }
  }

  return { totalErrors, totalWarnings, filesWithIssues, complexityViolations, rawResults: results };
}

function printSummary({ totalErrors, totalWarnings, filesWithIssues, complexityViolations }) {
  const PASS = '\x1b[32m✔\x1b[0m';
  const FAIL = '\x1b[31m✘\x1b[0m';
  const WARN = '\x1b[33m⚠\x1b[0m';

  console.log('\n========================================');
  console.log('  CODE QUALITY REPORT – ESLint');
  console.log('========================================');
  console.log(`  Total errors:   ${totalErrors   === 0 ? PASS : FAIL} ${totalErrors}`);
  console.log(`  Total warnings: ${totalWarnings === 0 ? PASS : WARN} ${totalWarnings}`);
  console.log(`  Files with issues: ${filesWithIssues.length}`);

  if (complexityViolations.length > 0) {
    console.log(`\n  ${FAIL} Complexity violations (target: <10):`);
    complexityViolations.forEach(v => {
      console.log(`     ${v.file}:${v.line} – ${v.message}`);
    });
  } else {
    console.log(`\n  ${PASS} All functions meet complexity target (<10)`);
  }

  if (filesWithIssues.length > 0) {
    console.log('\n  Files with issues:');
    filesWithIssues.forEach(f => {
      const icon = f.errors > 0 ? FAIL : WARN;
      console.log(`    ${icon} ${f.file} (${f.errors} errors, ${f.warnings} warnings)`);
    });
  }

  console.log('========================================\n');

  const meetsQuality = totalErrors === 0 && complexityViolations.length === 0;
  console.log(`  Quality gate: ${meetsQuality ? PASS + ' PASSED' : FAIL + ' FAILED'}`);
  console.log('========================================\n');

  return meetsQuality;
}

function main() {
  ensureDir(REPORT_DIR);

  console.log('Running ESLint analysis...');
  const raw     = runEsLint();
  const parsed  = parseResults(raw);

  const report = {
    timestamp:           new Date().toISOString(),
    summary: {
      totalErrors:         parsed.totalErrors,
      totalWarnings:       parsed.totalWarnings,
      filesAnalyzed:       parsed.rawResults.length,
      filesWithIssues:     parsed.filesWithIssues.length,
      complexityViolations:parsed.complexityViolations.length,
    },
    qualityTargets: {
      maxComplexity:    10,
      maxErrors:        0,
      complexityMet:    parsed.complexityViolations.length === 0,
      errorsMet:        parsed.totalErrors === 0,
    },
    filesWithIssues:     parsed.filesWithIssues,
    complexityViolations:parsed.complexityViolations,
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nReport written to: ${path.relative(PROJECT_ROOT, REPORT_FILE)}`);

  const passed = printSummary(parsed);
  process.exitCode = passed ? 0 : 1;
}

main();
