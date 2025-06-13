export interface FlowInvestigation {
  account_id: string;
  stable_runtime_scope_id: string;
  session_id: string;
  environment_id: number;
  environment_name: string;
  service_id: number;
  service_name: string;
  endpoint_id: number;
  endpoint_uuid: string;
  flow_type: string;
  version: string;
  s3_pointer: string;
  timestamp: Date;
  exceptions_data: Array<[string, string[]]>;
  function_ids: Record<string, number>;
  exceptions_data_enriched: Array<[string, number[]]>;
}

export interface ProcessedIncident {
  id: string;
  service_name: string;
  endpoint_uuid: string;
  endpoint_id: number;
  endpoint_path?: string;
  endpoint_methods?: string[];
  account_id: string;
  environment_name: string;
  error_message: string;
  stack_trace: string;
  throwing_functions: string[];
  timestamp: Date;
  s3_pointer: string;
  root_cause_hash: string;
}

export interface SolvedIssue {
  id: number;
  root_cause_hash: string;
  github_issue_number: number;
  created_at: Date;
  error_pattern: string;
}

export interface S3ErrorData {
  stack_trace?: string;
  error_message?: string;
  context?: any;
}

export interface EndpointInfo {
  id: number;
  path: string;
  methods: string[];
}