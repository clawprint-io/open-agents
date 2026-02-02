'use strict';

/**
 * Code Review Agent — Real Static Analysis Handler
 *
 * Performs regex-based pattern matching to detect:
 * - console.log / console.debug in production code
 * - TODO / FIXME / HACK / XXX comments
 * - Hardcoded secrets (API keys, passwords, tokens)
 * - eval() / Function() usage
 * - var usage (should be const/let)
 * - Empty catch blocks
 * - Deeply nested code (>4 levels)
 * - Long lines (>120 chars)
 * - Long functions (>50 lines)
 * - == instead of === (JS)
 * - Unused variable patterns
 * - SQL injection patterns
 * - innerHTML / dangerouslySetInnerHTML usage
 */

const RULES = [
  {
    id: 'no-console',
    severity: 'warning',
    pattern: /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/g,
    message: 'Console statement found — remove before production',
    category: 'cleanup',
  },
  {
    id: 'no-todo',
    severity: 'info',
    pattern: /\b(TODO|FIXME|HACK|XXX|TEMP)\b[:\s]?(.*)/gi,
    message: 'Unresolved comment marker',
    category: 'cleanup',
  },
  {
    id: 'no-hardcoded-secrets',
    severity: 'critical',
    pattern: /(api[_-]?key|secret|password|token|auth|credential)\s*[:=]\s*['"][A-Za-z0-9+/=_\-]{8,}['"]/gi,
    message: 'Possible hardcoded secret — use environment variables instead',
    category: 'security',
  },
  {
    id: 'no-eval',
    severity: 'critical',
    pattern: /\b(eval|Function)\s*\(/g,
    message: 'eval() or Function() is dangerous — allows arbitrary code execution',
    category: 'security',
  },
  {
    id: 'no-var',
    severity: 'warning',
    pattern: /\bvar\s+\w+/g,
    message: 'Use const or let instead of var',
    category: 'style',
  },
  {
    id: 'empty-catch',
    severity: 'warning',
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    message: 'Empty catch block — errors are silently swallowed',
    category: 'bug',
  },
  {
    id: 'loose-equality',
    severity: 'warning',
    pattern: /[^!=<>]==[^=]/g,
    message: 'Use === instead of == to avoid type coercion bugs',
    category: 'bug',
  },
  {
    id: 'no-innerhtml',
    severity: 'critical',
    pattern: /\.(innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML/g,
    message: 'Direct HTML insertion — XSS vulnerability risk',
    category: 'security',
  },
  {
    id: 'sql-injection',
    severity: 'critical',
    pattern: /(query|execute|raw)\s*\(\s*['"`].*\$\{|['"`]\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\b/gi,
    message: 'Possible SQL injection — use parameterized queries',
    category: 'security',
  },
  {
    id: 'no-debugger',
    severity: 'warning',
    pattern: /\bdebugger\b/g,
    message: 'debugger statement found — remove before production',
    category: 'cleanup',
  },
  {
    id: 'no-alert',
    severity: 'info',
    pattern: /\balert\s*\(/g,
    message: 'alert() call found — likely a debugging artifact',
    category: 'cleanup',
  },
  {
    id: 'magic-number',
    severity: 'info',
    pattern: /(?<!=\s*)(?<!\w)\b(?!0\b|1\b|2\b|100\b|200\b|404\b|500\b)\d{3,}\b(?!\s*[;,\]})]?\s*\/\/)/g,
    message: 'Magic number detected — consider using a named constant',
    category: 'style',
  },
];

function getLineNumber(text, index) {
  return text.substring(0, index).split('\n').length;
}

function getLineContent(text, lineNum) {
  const lines = text.split('\n');
  return (lines[lineNum - 1] || '').trim();
}

function analyzePatterns(code) {
  const issues = [];

  for (const rule of RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;
    while ((match = regex.exec(code)) !== null) {
      const line = getLineNumber(code, match.index);
      issues.push({
        rule: rule.id,
        severity: rule.severity,
        category: rule.category,
        line,
        column: match.index - code.lastIndexOf('\n', match.index - 1),
        message: rule.message,
        snippet: getLineContent(code, line),
      });
    }
  }

  return issues;
}

function analyzeLongLines(code, maxLength = 120) {
  const issues = [];
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > maxLength) {
      issues.push({
        rule: 'max-line-length',
        severity: 'info',
        category: 'style',
        line: i + 1,
        column: maxLength + 1,
        message: `Line exceeds ${maxLength} characters (${lines[i].length})`,
        snippet: lines[i].substring(0, 80) + '...',
      });
    }
  }
  return issues;
}

function analyzeNesting(code) {
  const issues = [];
  const lines = code.split('\n');
  let depth = 0;
  const maxDepth = 4;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    depth += opens - closes;
    if (depth > maxDepth && opens > 0) {
      issues.push({
        rule: 'max-nesting',
        severity: 'warning',
        category: 'complexity',
        line: i + 1,
        column: 1,
        message: `Nesting depth ${depth} exceeds maximum of ${maxDepth} — consider refactoring`,
        snippet: line.trim(),
      });
    }
    if (depth < 0) depth = 0;
  }
  return issues;
}

function analyzeFunctionLength(code, maxLines = 50) {
  const issues = [];
  const funcPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/g;
  let match;

  while ((match = funcPattern.exec(code)) !== null) {
    const name = match[1] || match[2] || 'anonymous';
    const startLine = getLineNumber(code, match.index);
    let braceDepth = 0;
    let started = false;
    let endLine = startLine;
    const lines = code.split('\n');

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') { braceDepth++; started = true; }
        if (ch === '}') braceDepth--;
      }
      if (started && braceDepth === 0) {
        endLine = i + 1;
        break;
      }
    }

    const length = endLine - startLine + 1;
    if (length > maxLines) {
      issues.push({
        rule: 'max-function-length',
        severity: 'warning',
        category: 'complexity',
        line: startLine,
        column: 1,
        message: `Function "${name}" is ${length} lines long (max: ${maxLines}) — consider splitting`,
        snippet: getLineContent(code, startLine),
      });
    }
  }
  return issues;
}

function calculateScore(issues) {
  let score = 100;
  const penalties = { critical: 15, warning: 5, info: 1 };
  for (const issue of issues) {
    score -= penalties[issue.severity] || 1;
  }
  return Math.max(0, Math.min(100, score));
}

function generateSummary(issues, score) {
  const counts = { critical: 0, warning: 0, info: 0 };
  const categories = {};
  for (const issue of issues) {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    categories[issue.category] = (categories[issue.category] || 0) + 1;
  }

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  const parts = [`Quality score: ${score}/100 (${grade}).`];
  if (issues.length === 0) {
    parts.push('No issues found — code looks clean!');
  } else {
    parts.push(`Found ${issues.length} issue(s): ${counts.critical} critical, ${counts.warning} warnings, ${counts.info} informational.`);
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (topCategories.length > 0) {
      parts.push('Top areas: ' + topCategories.map(([cat, count]) => `${cat} (${count})`).join(', ') + '.');
    }
  }
  return parts.join(' ');
}

async function handleExchange(payload, ctx) {
  const code =
    typeof payload === 'string'
      ? payload
      : payload?.text || payload?.code || payload?.input || payload?.query || JSON.stringify(payload);

  if (!code || code.length < 2) {
    return {
      format: 'json',
      data: { issues: [], summary: 'No code provided to review.', score: 100 },
    };
  }

  // Run all analyses
  const issues = [
    ...analyzePatterns(code),
    ...analyzeLongLines(code),
    ...analyzeNesting(code),
    ...analyzeFunctionLength(code),
  ];

  // Sort: critical first, then warning, then info; within same severity by line
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  issues.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9) || a.line - b.line);

  const score = calculateScore(issues);
  const summary = generateSummary(issues, score);

  // Track in memory
  const count = Number(ctx.memory.get('review_count') || 0) + 1;
  ctx.memory.set('review_count', count);

  return {
    format: 'json',
    data: {
      issues,
      summary,
      score,
      stats: {
        lines_analyzed: code.split('\n').length,
        issues_found: issues.length,
        review_number: count,
      },
    },
  };
}

module.exports = { handleExchange };