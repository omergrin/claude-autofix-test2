import { Octokit } from '@octokit/rest';
import { config } from './config.js';
import { ProcessedIncident } from './types.js';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: config.github.token
    });
  }

  async testConnection(): Promise<void> {
    try {
      // Test authentication and repository access
      const [userResponse, repoResponse] = await Promise.all([
        this.octokit.rest.users.getAuthenticated(),
        this.octokit.rest.repos.get({
          owner: config.github.owner,
          repo: config.github.repo
        })
      ]);

      console.log(`✅ GitHub connected as: ${userResponse.data.login}`);
      console.log(`✅ Repository access confirmed: ${config.github.owner}/${config.github.repo}`);
    } catch (error: any) {
      if (error.status === 401) {
        throw new Error('GitHub token is invalid or expired. Please check your GITHUB_TOKEN.');
      } else if (error.status === 404) {
        throw new Error(`Repository ${config.github.owner}/${config.github.repo} not found or token lacks access.`);
      } else {
        throw new Error(`GitHub connection failed: ${error.message}`);
      }
    }
  }

  async createIssue(incident: ProcessedIncident): Promise<number> {
    const title = this.generateIssueTitle(incident);
    const body = this.generateIssueBody(incident);

    try {
      // First, verify we can access the repository
      await this.octokit.rest.repos.get({
        owner: config.github.owner,
        repo: config.github.repo
      });

      const response = await this.octokit.rest.issues.create({
        owner: config.github.owner,
        repo: config.github.repo,
        title,
        body,
        labels: ['bug', 'production', 'auto-created']
      });

      return response.data.number;
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${config.github.owner}/${config.github.repo} not found. Check repository name and token permissions.`);
      } else if (error.status === 403) {
        throw new Error(`Permission denied. Check if your GitHub token has 'issues' write permissions for ${config.github.owner}/${config.github.repo}.`);
      } else {
        throw new Error(`GitHub API error (${error.status}): ${error.message}`);
      }
    }
  }

  private generateIssueTitle(incident: ProcessedIncident): string {
    const serviceName = incident.service_name;
    
    // Use endpoint path if available, otherwise service name
    let location = serviceName;
    if (incident.endpoint_path && incident.endpoint_methods) {
      const methods = incident.endpoint_methods.length > 0 ? incident.endpoint_methods.join(',') : 'ANY';
      location = `${serviceName} ${methods} ${incident.endpoint_path}`;
    }
    
    const errorMsg = incident.error_message.length > 50 
      ? incident.error_message.substring(0, 50) + '...'
      : incident.error_message;
    
    return `🚨 ${location}: ${errorMsg}`;
  }

  private generateIssueBody(incident: ProcessedIncident): string {
    // Format endpoint information
    let endpointInfo = 'Unknown endpoint';
    if (incident.endpoint_path && incident.endpoint_methods) {
      const methods = incident.endpoint_methods.length > 0 ? incident.endpoint_methods.join(', ') : 'ANY';
      endpointInfo = `${methods} ${incident.endpoint_path}`;
    }

    return `## Bug Report
**Detected by:** Hud
**Timestamp:** ${incident.timestamp.toISOString()}
**Severity:** High

@claude - You are fixing a bug reported from production. Please:

**FIRST: ALWAYS start by gathering the Hud production context on the relevant area in the code - both functions and endpoints. Don't stop until you get it.**

Then:
1. Analyze the bug description carefully
2. Identify the root cause  
3. Implement a proper fix
4. Add tests if appropriate
5. Create a clear commit message explaining the fix

The fix should be production-ready and follow best practices.

## Description

**Service:** ${incident.service_name}
**Endpoint:** ${endpointInfo}
**Environment:** ${incident.environment_name}
**Error:** ${incident.error_message}

## Additional Context
- **Account ID:** ${incident.account_id}
- **Incident ID:** ${incident.id}
- **Root Cause Hash:** ${incident.root_cause_hash}
- **S3 Pointer:** ${incident.s3_pointer}

---
*This issue was automatically created by Hud.*`;
  }
}