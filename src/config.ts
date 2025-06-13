import dotenv from 'dotenv';

dotenv.config();

export const config = {
  github: {
    token: process.env.GITHUB_TOKEN || '',
    owner: 'code-hud',
    repo: 'hud'
  },
  clickhouse: {
    host: process.env.CLICKHOUSE_HOST || '',
    port: parseInt(process.env.CLICKHOUSE_PORT || '8443'),
    username: process.env.CLICKHOUSE_USERNAME || '',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'hud'
  },
  aws: {
    region: process.env.AWS_REGION || 'eu-central-1'
  },
  database: {
    path: './solved_issues.db'
  },
  daysBack: 3
};

export function validateConfig() {
  const missing = [];
  
  if (!config.github.token) missing.push('GITHUB_TOKEN');
  if (!config.clickhouse.host) missing.push('CLICKHOUSE_HOST');
  if (!config.clickhouse.username) missing.push('CLICKHOUSE_USERNAME');
  if (!config.clickhouse.password) missing.push('CLICKHOUSE_PASSWORD');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}