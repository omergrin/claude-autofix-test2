import crypto from 'crypto';
import { FlowInvestigation, ProcessedIncident, S3ErrorData } from './types.js';
import { S3Service } from './s3.js';
import { ClickHouseClient } from './clickhouse.js';

export class IncidentProcessor {
  private s3Service: S3Service;
  private clickhouseClient: ClickHouseClient;

  constructor(clickhouseClient: ClickHouseClient) {
    this.s3Service = new S3Service();
    this.clickhouseClient = clickhouseClient;
  }

  async processIncidents(investigations: FlowInvestigation[]): Promise<ProcessedIncident[]> {
    const incidents: ProcessedIncident[] = [];
    const total = investigations.length;
    let processed = 0;
    let successful = 0;
    
    console.log(`\n📋 Processing ${total} investigations...`);
    
    for (const investigation of investigations) {
      try {
        const incident = await this.processInvestigation(investigation);
        if (incident) {
          incidents.push(incident);
          successful++;
        }
      } catch (error) {
        console.error(`Failed to process investigation ${investigation.session_id}:`, error);
      }
      
      processed++;
      
      // Show progress every 50 items or at key milestones
      if (processed % 50 === 0 || processed === total || processed === 1) {
        const percentage = Math.round((processed / total) * 100);
        const progressBar = this.createProgressBar(processed, total);
        process.stdout.write(`\r${progressBar} ${percentage}% (${processed}/${total}) - ${successful} incidents found`);
      }
    }
    
    console.log(`\n✅ Processing complete: ${successful} incidents found from ${processed} investigations`);
    
    // Enrich incidents with endpoint information
    const enrichedIncidents = await this.enrichWithEndpointInfo(this.deduplicateIncidents(incidents));
    console.log(`🛣️  Endpoint routes resolved\n`);
    
    return enrichedIncidents;
  }
  
  private createProgressBar(current: number, total: number, width: number = 20): string {
    const percentage = current / total;
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private async processInvestigation(investigation: FlowInvestigation): Promise<ProcessedIncident | null> {
    if (investigation.exceptions_data.length === 0) {
      return null;
    }

    const s3Data = await this.s3Service.getErrorData(investigation.s3_pointer);
    if (!s3Data) {
      return null;
    }

    const errorMessage = s3Data.error_message || investigation.exceptions_data[0][0] || '';
    const stackTrace = s3Data.stack_trace || '';
    const throwingFunctions = this.extractThrowingFunctions(investigation, stackTrace);

    const rootCauseHash = this.generateRootCauseHash(errorMessage, throwingFunctions);

    return {
      id: investigation.session_id,
      service_name: investigation.service_name,
      endpoint_uuid: investigation.endpoint_uuid,
      endpoint_id: investigation.endpoint_id,
      account_id: investigation.account_id,
      environment_name: investigation.environment_name,
      error_message: errorMessage,
      stack_trace: stackTrace,
      throwing_functions: throwingFunctions,
      timestamp: investigation.timestamp,
      s3_pointer: investigation.s3_pointer,
      root_cause_hash: rootCauseHash
    };
  }

  private extractThrowingFunctions(investigation: FlowInvestigation, stackTrace: string): string[] {
    const functions = new Set<string>();
    
    // Extract from function_ids
    Object.keys(investigation.function_ids).forEach(func => {
      if (func.trim()) {
        functions.add(func);
      }
    });

    // Extract from stack trace
    const stackLines = stackTrace.split('\n');
    for (const line of stackLines) {
      const functionMatch = line.match(/at (\w+(?:\.\w+)*)/);
      if (functionMatch && functionMatch[1]) {
        functions.add(functionMatch[1]);
      }
    }

    return Array.from(functions).slice(0, 10); // Limit to top 10 functions
  }

  private generateRootCauseHash(errorMessage: string, throwingFunctions: string[]): string {
    const normalizedError = errorMessage
      .toLowerCase()
      .replace(/\d+/g, 'N') // Replace numbers with 'N'
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    const sortedFunctions = throwingFunctions.slice(0, 5).sort(); // Use top 5 functions, sorted
    const hashInput = `${normalizedError}|${sortedFunctions.join('|')}`;
    
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private deduplicateIncidents(incidents: ProcessedIncident[]): ProcessedIncident[] {
    const seen = new Set<string>();
    return incidents.filter(incident => {
      if (seen.has(incident.root_cause_hash)) {
        return false;
      }
      seen.add(incident.root_cause_hash);
      return true;
    });
  }

  private async enrichWithEndpointInfo(incidents: ProcessedIncident[]): Promise<ProcessedIncident[]> {
    // Group incidents by account and environment for efficient querying
    const groupedIncidents = new Map<string, ProcessedIncident[]>();
    
    for (const incident of incidents) {
      const key = `${incident.account_id}|${incident.environment_name}`;
      if (!groupedIncidents.has(key)) {
        groupedIncidents.set(key, []);
      }
      groupedIncidents.get(key)!.push(incident);
    }

    // Fetch endpoint info for each group
    for (const [key, groupIncidents] of groupedIncidents) {
      const [accountId, environmentName] = key.split('|');
      const endpointIds = [...new Set(groupIncidents.map(i => i.endpoint_id))];
      
      try {
        const endpointInfos = await this.clickhouseClient.getEndpointInfo(accountId, environmentName, endpointIds);
        const endpointMap = new Map(endpointInfos.map(info => [info.id, info]));
        
        // Enrich incidents with endpoint info
        for (const incident of groupIncidents) {
          const endpointInfo = endpointMap.get(incident.endpoint_id);
          if (endpointInfo) {
            incident.endpoint_path = endpointInfo.path;
            incident.endpoint_methods = endpointInfo.methods;
          }
        }
      } catch (error) {
        console.error(`Failed to fetch endpoint info for ${accountId}/${environmentName}:`, error);
      }
    }

    return incidents;
  }
}