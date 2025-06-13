import inquirer from 'inquirer';
import chalk from 'chalk';
import { ProcessedIncident } from './types.js';

export class CLI {
  async selectIncidents(incidents: ProcessedIncident[]): Promise<ProcessedIncident[]> {
    if (incidents.length === 0) {
      console.log(chalk.green('🎉 No new incidents found!'));
      return [];
    }

    console.log(chalk.blue(`\n📋 Found ${incidents.length} unique incidents from the last 3 days:`));
    console.log(chalk.gray('━'.repeat(80)));

    const choices: Array<{
      name: string;
      value: ProcessedIncident | null;
      short: string;
    }> = incidents.map((incident, index) => ({
      name: this.formatIncidentChoice(incident),
      value: incident,
      short: `${incident.service_name}: ${incident.error_message.substring(0, 50)}...`
    }));

    choices.push({
      name: chalk.gray('Exit without creating issues'),
      value: null,
      short: 'Exit'
    });

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedIncidents',
        message: 'Select incidents to create GitHub issues for:',
        choices,
        pageSize: 10,
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one incident or choose Exit';
          }
          return true;
        }
      }
    ]);

    return answers.selectedIncidents.filter(Boolean);
  }

  private formatIncidentChoice(incident: ProcessedIncident): string {
    const serviceTag = chalk.cyan(`[${incident.service_name}]`);
    const envTag = chalk.yellow(`[${incident.environment_name}]`);
    
    // Show endpoint path and methods if available, otherwise show UUID
    let endpointDisplay = incident.endpoint_uuid;
    if (incident.endpoint_path) {
      const methods = incident.endpoint_methods && incident.endpoint_methods.length > 0 
        ? incident.endpoint_methods.join(',') 
        : 'ANY';
      endpointDisplay = `${methods} ${incident.endpoint_path}`;
    }
    const endpointTag = chalk.blue(endpointDisplay);
    
    const timeTag = chalk.gray(new Date(incident.timestamp).toLocaleString());
    
    const errorMsg = incident.error_message.length > 60 
      ? incident.error_message.substring(0, 60) + '...'
      : incident.error_message;

    return `${serviceTag} ${envTag} ${endpointTag}
    ${chalk.red('🚨')} ${errorMsg}
    ${chalk.gray('⏰')} ${timeTag}`;
  }

  async confirmCreation(incidents: ProcessedIncident[]): Promise<boolean> {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Create ${incidents.length} GitHub issue(s)?`,
        default: true
      }
    ]);

    return answer.confirm;
  }

  displayProgress(current: number, total: number, incident: ProcessedIncident): void {
    const progress = `[${current}/${total}]`;
    console.log(chalk.blue(`${progress} Creating issue for: ${incident.service_name} - ${incident.error_message.substring(0, 60)}...`));
  }

  displaySuccess(issueNumber: number, incident: ProcessedIncident): void {
    const url = `https://github.com/code-hud/hud/issues/${issueNumber}`;
    console.log(chalk.green(`✅ Created issue #${issueNumber}: ${url}`));
  }

  displayError(error: Error, incident: ProcessedIncident): void {
    console.error(chalk.red(`❌ Failed to create issue for ${incident.service_name}: ${error.message}`));
  }

  displaySummary(created: number, skipped: number): void {
    console.log(chalk.gray('━'.repeat(80)));
    console.log(chalk.green(`✨ Summary: ${created} issues created, ${skipped} skipped (already solved)`));
  }
}