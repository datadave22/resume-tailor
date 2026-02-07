#!/usr/bin/env node

/**
 * Environment Variable Checker
 *
 * Validates that all required environment variables are properly set
 * Run this before starting the application to catch configuration issues early
 */

const REQUIRED_VARS = [
  {
    name: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
    example: 'postgresql://user:pass@localhost:5432/resumetailor',
    pattern: /^postgresql:\/\/.+/
  },
  {
    name: 'SESSION_SECRET',
    description: 'Secret key for session encryption (32+ chars recommended)',
    example: 'your-super-secret-key-at-least-32-characters-long',
    minLength: 32
  },
  {
    name: 'AI_INTEGRATIONS_OPENAI_API_KEY',
    description: 'OpenAI API key',
    example: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: /^sk-(proj-)?[A-Za-z0-9_-]+$/
  }
];

const OPTIONAL_VARS = [
  {
    name: 'AI_INTEGRATIONS_OPENAI_BASE_URL',
    description: 'OpenAI API base URL',
    example: 'https://api.openai.com/v1',
    default: 'https://api.openai.com/v1'
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key (required for payments)',
    example: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: /^sk_(test|live)_[A-Za-z0-9]+$/
  },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key',
    example: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: /^pk_(test|live)_[A-Za-z0-9]+$/
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook signing secret',
    example: 'whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: /^whsec_[A-Za-z0-9]+$/
  },
  {
    name: 'PORT',
    description: 'Server port',
    example: '5000',
    default: '5000'
  },
  {
    name: 'NODE_ENV',
    description: 'Environment (development|production)',
    example: 'development',
    default: 'development'
  },
  {
    name: 'BASE_URL',
    description: 'Application base URL',
    example: 'http://localhost:5000',
    default: 'http://localhost:5000'
  }
];

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function checkVariable(varConfig, isRequired = true) {
  const value = process.env[varConfig.name];
  const status = {
    name: varConfig.name,
    isSet: !!value,
    isValid: true,
    issues: []
  };

  if (!value) {
    if (isRequired) {
      status.isValid = false;
      status.issues.push(`Missing required variable`);
    } else if (varConfig.default) {
      status.issues.push(`Not set - will use default: ${varConfig.default}`);
    } else {
      status.issues.push(`Not set - some features may not work`);
    }
    return status;
  }

  // Validate pattern if specified
  if (varConfig.pattern && !varConfig.pattern.test(value)) {
    status.isValid = false;
    status.issues.push(`Invalid format. Expected pattern like: ${varConfig.example}`);
  }

  // Validate minimum length if specified
  if (varConfig.minLength && value.length < varConfig.minLength) {
    status.isValid = false;
    status.issues.push(`Too short (${value.length} chars). Minimum: ${varConfig.minLength} chars`);
  }

  // Validate PORT if applicable
  if (varConfig.name === 'PORT') {
    const port = parseInt(value, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      status.isValid = false;
      status.issues.push(`Invalid port number. Must be 1-65535`);
    }
  }

  return status;
}

function printResults(results, isRequired) {
  const title = isRequired ? 'REQUIRED VARIABLES' : 'OPTIONAL VARIABLES';
  console.log(`\n${colorize(title, 'bold')}`);
  console.log('='.repeat(80));

  results.forEach(result => {
    const statusSymbol = result.isSet && result.isValid ? '✓' : (result.isSet ? '⚠' : '✗');
    const statusColor = result.isSet && result.isValid ? 'green' : (result.isSet ? 'yellow' : 'red');

    console.log(`\n${colorize(statusSymbol, statusColor)} ${colorize(result.name, 'cyan')}`);

    if (result.issues.length > 0) {
      result.issues.forEach(issue => {
        const issueColor = result.isValid ? 'yellow' : 'red';
        console.log(`  ${colorize('→', issueColor)} ${issue}`);
      });
    } else {
      const value = process.env[result.name];
      // Mask sensitive values
      const displayValue = result.name.includes('SECRET') || result.name.includes('KEY')
        ? value.substring(0, 15) + '...'
        : value;
      console.log(`  ${colorize('→', 'green')} ${displayValue}`);
    }
  });
}

function main() {
  console.log(colorize('\n🔍 ResumeTailor Environment Variable Checker\n', 'bold'));

  // Check required variables
  const requiredResults = REQUIRED_VARS.map(v => checkVariable(v, true));
  printResults(requiredResults, true);

  // Check optional variables
  const optionalResults = OPTIONAL_VARS.map(v => checkVariable(v, false));
  printResults(optionalResults, false);

  // Summary
  console.log('\n' + '='.repeat(80));

  const requiredFailed = requiredResults.filter(r => !r.isValid);
  const requiredMissing = requiredResults.filter(r => !r.isSet);
  const optionalMissing = optionalResults.filter(r => !r.isSet);

  if (requiredFailed.length > 0) {
    console.log(colorize('\n✗ VALIDATION FAILED', 'red'));
    console.log(colorize(`\n${requiredFailed.length} required variable(s) are invalid or missing:`, 'red'));
    requiredFailed.forEach(r => {
      console.log(colorize(`  • ${r.name}`, 'red'));
      const config = REQUIRED_VARS.find(v => v.name === r.name);
      if (config) {
        console.log(`    ${colorize('Description:', 'yellow')} ${config.description}`);
        console.log(`    ${colorize('Example:', 'yellow')} ${config.example}`);
        console.log(`    ${colorize('Set with:', 'yellow')} export ${r.name}="${config.example}"`);
      }
    });
    console.log(colorize('\nPlease set these variables in your ~/.bashrc and run:', 'yellow'));
    console.log(colorize('  source ~/.bashrc', 'cyan'));
    console.log(colorize('  npm run check:env', 'cyan'));
    process.exit(1);
  }

  console.log(colorize('\n✓ All required variables are valid!', 'green'));

  if (optionalMissing.length > 0) {
    console.log(colorize(`\n⚠ ${optionalMissing.length} optional variable(s) not set:`, 'yellow'));
    optionalMissing.forEach(r => {
      console.log(colorize(`  • ${r.name}`, 'yellow'));
      const config = OPTIONAL_VARS.find(v => v.name === r.name);
      if (config && config.description) {
        console.log(`    ${config.description}`);
      }
    });
    console.log(colorize('\nThis is OK - optional features may be disabled.', 'yellow'));
  }

  console.log(colorize('\n✓ Environment configuration ready!', 'green'));
  console.log(colorize('You can now run: npm run dev\n', 'cyan'));

  process.exit(0);
}

main();
