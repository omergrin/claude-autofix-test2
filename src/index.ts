#!/usr/bin/env node

import { validateConfig } from './config.js';
import { ClickHouseClient } from './clickhouse.js';
import { IncidentProcessor } from './processor.js';
import { Database } from './database.js';
import { GitHubService } from './github.js';
import { CLI } from './cli.js';
import chalk from 'chalk';

function parseArgs(): { daysBack: number } {
  const args = process.argv.slice(2);
  let daysBack = 3; // default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' || args[i] === '-d') {
      const value = parseInt(args[i + 1]);
      if (isNaN(value) || value <= 0) {
        console.error(chalk.red('❌ Invalid days value. Must be a positive number.'));
        process.exit(1);
      }
      daysBack = value;
      i++; // skip next arg since we consumed it
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: npm run dev [options]

Options:
  -d, --days <number>    Number of days back to look for incidents (default: 3)
  -h, --help            Show this help message

Examples:
  npm run dev                 # Look back 3 days (default)
  npm run dev --days 7        # Look back 7 days
  npm run dev -d 1            # Look back 1 day
      `);
      process.exit(0);
    }
  }

  return { daysBack };
}

async function main() {
  const { daysBack } = parseArgs();
  console.log(chalk.blue(`🔍 HUD Issue Creator - Looking back ${daysBack} day(s)...`));
  
  try {
    // Validate configuration
    validateConfig();
    
    // Initialize services
    const clickhouse = new ClickHouseClient();
    const processor = new IncidentProcessor(clickhouse);
    const database = new Database('./solved_issues.db');
    const github = new GitHubService();
    const cli = new CLI();

    // Test GitHub connection early
    console.log(chalk.blue('🔗 Testing GitHub connection...'));
    await github.testConnection();

    console.log(chalk.blue('📊 Fetching recent incidents from ClickHouse...'));
    const investigations = await clickhouse.getRecentIncidents(daysBack);
    
    if (investigations.length === 0) {
      console.log(chalk.green(`🎉 No incidents found in the last ${daysBack} day(s)!`));
      return;
    }

    const incidents = await processor.processIncidents(investigations);
    
    // Filter out already solved incidents
    const newIncidents = [];
    let skippedCount = 0;
    
    for (const incident of incidents) {
      const isSolved = await database.isSolved(incident.root_cause_hash);
      if (!isSolved) {
        newIncidents.push(incident);
      } else {
        skippedCount++;
      }
    }

    if (skippedCount > 0) {
      console.log(chalk.yellow(`⏭️  Skipped ${skippedCount} incidents (already solved)`));
    }

    // Let user select incidents to create issues for
    const selectedIncidents = await cli.selectIncidents(newIncidents);
    
    if (selectedIncidents.length === 0) {
      console.log(chalk.gray('👋 Goodbye!'));
      return;
    }

    // Confirm creation
    const confirmed = await cli.confirmCreation(selectedIncidents);
    if (!confirmed) {
      console.log(chalk.gray('Operation cancelled.'));
      return;
    }

    // Create GitHub issues
    let createdCount = 0;
    for (let i = 0; i < selectedIncidents.length; i++) {
      const incident = selectedIncidents[i];
      
      try {
        cli.displayProgress(i + 1, selectedIncidents.length, incident);
        
        const issueNumber = await github.createIssue(incident);
        await database.markAsSolved(incident.root_cause_hash, issueNumber, incident.error_message);
        
        cli.displaySuccess(issueNumber, incident);
        createdCount++;
        
        // Rate limiting - wait 1 second between requests
        if (i < selectedIncidents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        cli.displayError(error as Error, incident);
      }
    }

    cli.displaySummary(createdCount, skippedCount);

    // Cleanup
    await clickhouse.close();
    database.close();

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}