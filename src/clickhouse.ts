import { createClient } from '@clickhouse/client';
import { config } from './config.js';
import { FlowInvestigation, EndpointInfo } from './types.js';

export class ClickHouseClient {
  private client;

  constructor() {
    this.client = createClient({
      url: `https://${config.clickhouse.host}:${config.clickhouse.port}`,
      username: config.clickhouse.username,
      password: config.clickhouse.password,
      database: config.clickhouse.database
    });
  }

  async getRecentIncidents(daysBack: number = config.daysBack): Promise<FlowInvestigation[]> {
    const query = `
      WITH deduplicated AS (
        SELECT 
          account_id,
          stable_runtime_scope_id,
          session_id,
          environment_id,
          environment_name,
          service_id,
          service_name,
          endpoint_id,
          endpoint_uuid,
          flow_type,
          version,
          s3_pointer,
          timestamp,
          exceptions_data,
          function_ids,
          exceptions_data_enriched,
          -- Create a deduplication key based on service, endpoint, and first exception
          concat(
            service_name, 
            '|', 
            endpoint_uuid, 
            '|', 
            arrayElement(exceptions_data, 1).1
          ) as dedup_key,
          -- Rank by most recent within each dedup group
          row_number() OVER (
            PARTITION BY concat(
              service_name, 
              '|', 
              endpoint_uuid, 
              '|', 
              arrayElement(exceptions_data, 1).1
            ) 
            ORDER BY timestamp DESC
          ) as rn
        FROM hud.FlowInvestigation 
        WHERE timestamp >= now() - INTERVAL ${daysBack} DAY
          AND length(exceptions_data) > 0
          AND s3_pointer != ''
          AND arrayElement(exceptions_data, 1).1 != ''  -- Ensure first exception has content
          -- Filter out common non-HTTP 500 errors or noise
          AND NOT (
            positionCaseInsensitive(arrayElement(exceptions_data, 1).1, 'timeout') > 0
            OR positionCaseInsensitive(arrayElement(exceptions_data, 1).1, 'cancelled') > 0
            OR positionCaseInsensitive(arrayElement(exceptions_data, 1).1, 'aborted') > 0
          )
      )
      SELECT 
        account_id,
        stable_runtime_scope_id,
        session_id,
        environment_id,
        environment_name,
        service_id,
        service_name,
        endpoint_id,
        endpoint_uuid,
        flow_type,
        version,
        s3_pointer,
        timestamp,
        exceptions_data,
        function_ids,
        exceptions_data_enriched
      FROM deduplicated
      WHERE rn = 1  -- Only take the most recent occurrence of each unique error
      ORDER BY timestamp DESC
      LIMIT 500  -- Reduced limit since we're pre-deduplicating
    `;

    const resultSet = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: {
        readonly: 1
      }
    });

    const rows = await resultSet.json() as any[];
    
    return rows.map(row => ({
      ...row,
      timestamp: new Date(row.timestamp)
    }));
  }

  async getEndpointInfo(accountId: string, environmentName: string, endpointIds: number[]): Promise<EndpointInfo[]> {
    if (endpointIds.length === 0) return [];

    const query = `
      SELECT
        endpoint_id as id,
        argMaxOrNullMerge(final_path) as path,
        argMaxMerge(final_methods) as methods
      FROM hud.LatestEndpointFunctionVersionByService
      WHERE account_id = '${accountId}'
        AND environment_name = '${environmentName}'
        AND endpoint_id IN (${endpointIds.join(',')})
      GROUP BY id
    `;

    const resultSet = await this.client.query({
      query,
      format: 'JSONEachRow',
      query_params: {
        readonly: 1
      }
    });

    const rows = await resultSet.json() as any[];
    
    return rows.map(row => ({
      id: row.id,
      path: row.path || 'Unknown path',
      methods: row.methods || []
    }));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}