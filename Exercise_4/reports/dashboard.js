#!/usr/bin/env node
/**
 * Quality Dashboard Generator
 * Aggregates results from all QA tools and produces a rich HTML report
 * with metrics visualization, quality gates, and trend data.
 *
 * Reads:
 *   - reports/jest-coverage-summary.json  (Jest --coverage output)
 *   - reports/eslint-report.json          (ESLint report)
 *   - reports/complexity-report.json      (Complexity checker)
 *   - reports/zap-security-report.json    (OWASP ZAP)
 *   - reports/snyk-security-report.json   (Snyk)
 *   - reports/k6-summary.json             (k6 performance)
 *   - reports/k6-api-summary.json         (k6 API performance)
 *
 * Outputs:
 *   - reports/qa-dashboard.html           (main HTML dashboard)
 *   - reports/qa-metrics.json             (machine-readable metrics)
 *
 * Usage: node Exercise_4/reports/dashboard.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIR   = path.resolve(__dirname);
const OUTPUT_HTML  = path.join(REPORT_DIR, 'qa-dashboard.html');
const OUTPUT_JSON  = path.join(REPORT_DIR, 'qa-metrics.json');

// ── Report file paths ─────────────────────────────────────────────────────────

const REPORT_FILES = {
  coverage:    path.join(REPORT_DIR, 'jest-coverage-summary.json'),
  eslint:      path.join(REPORT_DIR, 'eslint-report.json'),
  complexity:  path.join(REPORT_DIR, 'complexity-report.json'),
  zap:         path.join(REPORT_DIR, 'zap-security-report.json'),
  snyk:        path.join(REPORT_DIR, 'snyk-security-report.json'),
  k6:          path.join(REPORT_DIR, 'k6-summary.json'),
  k6Api:       path.join(REPORT_DIR, 'k6-api-summary.json'),
};

// ── Quality targets ───────────────────────────────────────────────────────────

const TARGETS = {
  coverage:         80,    // % – test coverage
  maxComplexity:    10,    // cyclomatic complexity
  maxCriticalVulns: 0,     // security vulnerabilities (critical)
  maxResponseTime:  500,   // ms – p95 response time
  maxErrorRate:     1,     // % – error rate
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

// ── Data aggregation ──────────────────────────────────────────────────────────

function aggregateMetrics() {
  const raw = {
    coverage:   safeReadJson(REPORT_FILES.coverage),
    eslint:     safeReadJson(REPORT_FILES.eslint),
    complexity: safeReadJson(REPORT_FILES.complexity),
    zap:        safeReadJson(REPORT_FILES.zap),
    snyk:       safeReadJson(REPORT_FILES.snyk),
    k6:         safeReadJson(REPORT_FILES.k6),
    k6Api:      safeReadJson(REPORT_FILES.k6Api),
  };

  // ── Coverage ────────────────────────────────────────────────────────────────
  let coveragePct = null;
  if (raw.coverage && raw.coverage.total) {
    const lines = raw.coverage.total.lines;
    coveragePct = lines ? lines.pct : null;
  }
  const coverageMet  = coveragePct !== null ? coveragePct >= TARGETS.coverage : null;

  // ── Code quality ────────────────────────────────────────────────────────────
  const eslintErrors       = raw.eslint?.summary?.totalErrors        ?? null;
  const eslintWarnings     = raw.eslint?.summary?.totalWarnings       ?? null;
  const complexityViolations = raw.complexity?.summary?.violations    ?? null;
  const maxComplexity      = raw.complexity?.summary?.maxComplexity   ?? null;
  const complexityMet      = complexityViolations !== null ? complexityViolations === 0 : null;
  const eslintMet          = eslintErrors !== null ? eslintErrors === 0 : null;

  // ── Security ─────────────────────────────────────────────────────────────────
  const zapCritical        = raw.zap?.summary?.criticalCount         ?? null;
  const zapTotal           = raw.zap?.summary?.totalAlerts            ?? null;
  const snykCritical       = raw.snyk?.summary?.critical              ?? null;
  const snykTotal          = raw.snyk?.summary?.total                 ?? null;
  const totalCritical      = (zapCritical ?? 0) + (snykCritical ?? 0);
  const securityMet        = totalCritical === TARGETS.maxCriticalVulns;

  // ── Performance ───────────────────────────────────────────────────────────────
  const p95ResponseTime    = raw.k6?.responseTimeP95
    || raw.k6?.qualityTargets?.responseTime?.actual
    || null;
  const errorRatePct       = raw.k6?.errorRate !== undefined
    ? raw.k6.errorRate * 100
    : null;
  const performanceMet     = p95ResponseTime !== null ? p95ResponseTime < TARGETS.maxResponseTime : null;
  const errorRateMet       = errorRatePct    !== null ? errorRatePct    < TARGETS.maxErrorRate    : null;

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      coverage:      { value: coveragePct,         target: TARGETS.coverage,         met: coverageMet,    unit: '%' },
      eslintErrors:  { value: eslintErrors,         target: 0,                        met: eslintMet,      unit: 'errors' },
      eslintWarnings:{ value: eslintWarnings,                                                              unit: 'warnings' },
      complexity:    { value: maxComplexity,        target: TARGETS.maxComplexity,    met: complexityMet,  unit: '' },
      complexityViolations: { value: complexityViolations, target: 0, met: complexityMet, unit: 'violations' },
      zapCritical:   { value: zapCritical,          target: 0,                        met: zapCritical === 0, unit: 'critical' },
      snykCritical:  { value: snykCritical,         target: 0,                        met: snykCritical === 0, unit: 'critical' },
      totalCriticalVulns: { value: totalCritical,   target: 0,                        met: securityMet,   unit: 'critical' },
      responseTimeP95:    { value: p95ResponseTime, target: TARGETS.maxResponseTime,  met: performanceMet, unit: 'ms' },
      errorRate:     { value: errorRatePct,         target: TARGETS.maxErrorRate,     met: errorRateMet,   unit: '%' },
    },
    qualityGates: {
      coverage:    { label: 'Test Coverage ≥80%',           met: coverageMet },
      complexity:  { label: 'Code Complexity <10',          met: complexityMet },
      security:    { label: '0 Critical Vulnerabilities',   met: securityMet },
      performance: { label: 'Response Time <500ms (p95)',   met: performanceMet },
      errorRate:   { label: 'Error Rate <1%',               met: errorRateMet },
    },
    overallPassed: [coverageMet, complexityMet, securityMet, performanceMet, errorRateMet]
      .filter(v => v !== null)
      .every(Boolean),
    rawData: { coverage: raw.coverage, eslint: raw.eslint, complexity: raw.complexity, zap: raw.zap, snyk: raw.snyk, k6: raw.k6 },
  };
}

// ── HTML generation ───────────────────────────────────────────────────────────

function metricCard(label, value, unit, target, met, note = '') {
  const displayValue = value !== null && value !== undefined
    ? (typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 1) : value)
    : 'N/A';
  const statusClass  = met === null ? 'unknown' : met ? 'pass' : 'fail';
  const statusIcon   = met === null ? '—' : met ? '✔' : '✘';
  const targetStr    = target !== undefined ? `Target: ${target}${unit}` : '';
  return `
    <div class="metric-card ${statusClass}">
      <div class="metric-status">${statusIcon}</div>
      <div class="metric-value">${displayValue}<span class="metric-unit">${unit}</span></div>
      <div class="metric-label">${label}</div>
      ${targetStr ? `<div class="metric-target">${targetStr}</div>` : ''}
      ${note ? `<div class="metric-note">${note}</div>` : ''}
    </div>`;
}

function gateRow(label, met) {
  const statusClass = met === null ? 'gate-unknown' : met ? 'gate-pass' : 'gate-fail';
  const icon        = met === null ? '—' : met ? '✔' : '✘';
  const text        = met === null ? 'No data' : met ? 'PASSED' : 'FAILED';
  return `
    <tr class="${statusClass}">
      <td class="gate-icon">${icon}</td>
      <td class="gate-label">${label}</td>
      <td class="gate-status">${text}</td>
    </tr>`;
}

function generateHTML(data) {
  const { metrics, qualityGates, overallPassed, timestamp } = data;
  const overallClass = overallPassed ? 'overall-pass' : 'overall-fail';
  const overallText  = overallPassed ? '✔ ALL QUALITY GATES PASSED' : '✘ QUALITY GATES FAILED';
  const formattedTs  = new Date(timestamp).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Dashboard – Module 8 Exercise 4</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e2e8f0; min-height: 100vh; }
    header { background: linear-gradient(135deg, #1a1d2e 0%, #252840 100%); padding: 32px 40px; border-bottom: 1px solid #2d3748; }
    header h1 { font-size: 1.8rem; font-weight: 700; color: #f7fafc; letter-spacing: -0.5px; }
    header p  { color: #a0aec0; margin-top: 4px; font-size: 0.9rem; }
    .overall-banner { padding: 16px 40px; font-size: 1.1rem; font-weight: 700; text-align: center; letter-spacing: 0.5px; }
    .overall-pass { background: #1a3a2a; color: #68d391; border-bottom: 2px solid #38a169; }
    .overall-fail { background: #3a1a1a; color: #fc8181; border-bottom: 2px solid #e53e3e; }
    main { max-width: 1200px; margin: 0 auto; padding: 40px; }
    section { margin-bottom: 48px; }
    h2 { font-size: 1.1rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #90cdf4; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #2d3748; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .metric-card { background: #1a202c; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #2d3748; transition: transform 0.1s; }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-card.pass  { border-color: #38a169; }
    .metric-card.fail  { border-color: #e53e3e; }
    .metric-card.unknown { border-color: #4a5568; opacity: 0.7; }
    .metric-status { font-size: 1.4rem; margin-bottom: 8px; }
    .metric-card.pass  .metric-status { color: #68d391; }
    .metric-card.fail  .metric-status { color: #fc8181; }
    .metric-card.unknown .metric-status { color: #718096; }
    .metric-value { font-size: 2rem; font-weight: 800; color: #f7fafc; line-height: 1; }
    .metric-unit  { font-size: 0.9rem; font-weight: 400; color: #a0aec0; margin-left: 2px; }
    .metric-label { font-size: 0.8rem; color: #a0aec0; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-target{ font-size: 0.75rem; color: #718096; margin-top: 4px; }
    .metric-note  { font-size: 0.7rem; color: #718096; margin-top: 4px; font-style: italic; }
    .gates-table { width: 100%; border-collapse: collapse; background: #1a202c; border-radius: 12px; overflow: hidden; border: 1px solid #2d3748; }
    .gates-table th { background: #252d3d; padding: 12px 16px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #90cdf4; }
    .gates-table td { padding: 14px 16px; border-top: 1px solid #2d3748; }
    .gate-icon    { font-size: 1.1rem; width: 40px; }
    .gate-label   { color: #e2e8f0; }
    .gate-status  { font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px; }
    .gate-pass .gate-icon   { color: #68d391; }
    .gate-pass .gate-status { color: #68d391; }
    .gate-fail .gate-icon   { color: #fc8181; }
    .gate-fail .gate-status { color: #fc8181; }
    .gate-unknown .gate-icon   { color: #718096; }
    .gate-unknown .gate-status { color: #718096; }
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .tool-card  { background: #1a202c; border-radius: 10px; padding: 18px; border: 1px solid #2d3748; }
    .tool-card h3 { font-size: 0.9rem; color: #90cdf4; margin-bottom: 8px; }
    .tool-card p  { font-size: 0.8rem; color: #a0aec0; line-height: 1.5; }
    .tool-card code { background: #2d3748; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: #fbb6ce; }
    footer { text-align: center; padding: 24px 40px; color: #4a5568; font-size: 0.8rem; border-top: 1px solid #2d3748; }
    @media (max-width: 600px) { main { padding: 20px; } .metrics-grid { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>📊 QA Automation Dashboard</h1>
    <p>Module 8 – Exercise 4 · Generated: ${formattedTs}</p>
  </header>

  <div class="overall-banner ${overallClass}">${overallText}</div>

  <main>

    <!-- Quality Gates -->
    <section>
      <h2>Quality Gates</h2>
      <table class="gates-table">
        <thead>
          <tr><th>Status</th><th>Gate</th><th>Result</th></tr>
        </thead>
        <tbody>
          ${Object.values(qualityGates).map(g => gateRow(g.label, g.met)).join('')}
        </tbody>
      </table>
    </section>

    <!-- Test Coverage -->
    <section>
      <h2>Test Coverage</h2>
      <div class="metrics-grid">
        ${metricCard('Line Coverage', metrics.coverage.value, '%', `≥${TARGETS.coverage}`, metrics.coverage.met)}
        ${metricCard('Total Errors (ESLint)', metrics.eslintErrors.value, '', 0, metrics.eslintErrors.met)}
        ${metricCard('Warnings (ESLint)', metrics.eslintWarnings.value, '', undefined, null)}
      </div>
    </section>

    <!-- Code Complexity -->
    <section>
      <h2>Code Quality</h2>
      <div class="metrics-grid">
        ${metricCard('Max Complexity', metrics.complexity.value, '', `<${TARGETS.maxComplexity}`, metrics.complexity.met)}
        ${metricCard('Complexity Violations', metrics.complexityViolations.value, '', 0, metrics.complexityViolations.met)}
        ${metricCard('ESLint Errors', metrics.eslintErrors.value, '', 0, metrics.eslintErrors.met)}
      </div>
    </section>

    <!-- Security -->
    <section>
      <h2>Security Scanning</h2>
      <div class="metrics-grid">
        ${metricCard('Critical Vulns (Total)', metrics.totalCriticalVulns.value, '', 0, metrics.totalCriticalVulns.met)}
        ${metricCard('ZAP Critical', metrics.zapCritical.value, '', 0, metrics.zapCritical.met, 'OWASP ZAP')}
        ${metricCard('Snyk Critical', metrics.snykCritical.value, '', 0, metrics.snykCritical.met, 'Snyk')}
      </div>
    </section>

    <!-- Performance -->
    <section>
      <h2>Performance Testing</h2>
      <div class="metrics-grid">
        ${metricCard('p95 Response Time', metrics.responseTimeP95.value, 'ms', `<${TARGETS.maxResponseTime}ms`, metrics.responseTimeP95.met)}
        ${metricCard('Error Rate', metrics.errorRate.value !== null ? metrics.errorRate.value?.toFixed(2) : null, '%', `<${TARGETS.maxErrorRate}%`, metrics.errorRate.met)}
      </div>
    </section>

    <!-- Tooling -->
    <section>
      <h2>QA Tooling Reference</h2>
      <div class="tools-grid">
        <div class="tool-card">
          <h3>Page Object Model</h3>
          <p>Playwright E2E tests with POM pattern. Unit tests run without a browser.</p>
          <p><code>npm run test:pom</code></p>
        </div>
        <div class="tool-card">
          <h3>ESLint</h3>
          <p>Code style, error detection, and complexity enforcement (max 10).</p>
          <p><code>npm run qa:lint</code></p>
        </div>
        <div class="tool-card">
          <h3>Complexity Checker</h3>
          <p>Custom AST-based cyclomatic complexity scanner for all JS files.</p>
          <p><code>npm run qa:complexity</code></p>
        </div>
        <div class="tool-card">
          <h3>OWASP ZAP</h3>
          <p>Dynamic application security testing (DAST). Requires ZAP daemon.</p>
          <p><code>npm run qa:zap</code></p>
        </div>
        <div class="tool-card">
          <h3>Snyk</h3>
          <p>Dependency vulnerability scanning and SAST. Requires Snyk token.</p>
          <p><code>npm run qa:snyk</code></p>
        </div>
        <div class="tool-card">
          <h3>k6 Performance</h3>
          <p>Load testing targeting p95 &lt;500ms, error rate &lt;1%.</p>
          <p><code>npm run qa:perf</code></p>
        </div>
      </div>
    </section>

  </main>

  <footer>
    Module 8 – Exercise 4 · Complete QA Automation System · Cursor AI
  </footer>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  ensureDir(REPORT_DIR);

  console.log('Aggregating QA metrics...');
  const data = aggregateMetrics();

  // Write machine-readable JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf-8');

  // Write HTML dashboard
  const html = generateHTML(data);
  fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');

  // Console summary
  const PASS = '\x1b[32m✔\x1b[0m';
  const FAIL = '\x1b[31m✘\x1b[0m';
  const NA   = '\x1b[33m—\x1b[0m';

  console.log('\n========================================');
  console.log('  QA DASHBOARD SUMMARY');
  console.log('========================================');

  const gates = data.qualityGates;
  Object.values(gates).forEach(g => {
    const icon = g.met === null ? NA : g.met ? PASS : FAIL;
    console.log(`  ${icon}  ${g.label}`);
  });

  console.log('========================================');
  console.log(`  Overall: ${data.overallPassed ? PASS + ' PASSED' : FAIL + ' FAILED'}`);
  console.log('========================================');
  console.log(`\n  HTML Dashboard: ${path.relative(PROJECT_ROOT, OUTPUT_HTML)}`);
  console.log(`  JSON Metrics:   ${path.relative(PROJECT_ROOT, OUTPUT_JSON)}\n`);
}

main();
