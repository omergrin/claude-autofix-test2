import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';
import { S3ErrorData } from './types.js';

export class S3Service {
  private clients: Map<string, S3Client> = new Map();

  constructor() {
    // Default client
    this.clients.set(config.aws.region, new S3Client({ 
      region: config.aws.region 
    }));
  }

  private getClient(region: string): S3Client {
    if (!this.clients.has(region)) {
      this.clients.set(region, new S3Client({ region }));
    }
    return this.clients.get(region)!;
  }

  async getErrorData(s3Pointer: string): Promise<S3ErrorData | null> {
    try {
      // Parse S3 URL - handle both s3:// and https:// formats
      let bucket: string;
      let key: string;
      
      if (s3Pointer.startsWith('s3://')) {
        const s3Url = s3Pointer.substring(5); // Remove 's3://'
        const [bucketName, ...keyParts] = s3Url.split('/');
        bucket = bucketName;
        key = keyParts.join('/');
      } else {
        const url = new URL(s3Pointer);
        bucket = url.hostname.split('.')[0];
        key = url.pathname.substring(1);
      }

      // Try with default region first, then fallback to eu-central-1 if PermanentRedirect
      const regions = [config.aws.region, 'eu-central-1', 'us-east-1', 'us-west-2'];
      
      for (const region of regions) {
        try {
          const client = this.getClient(region);
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key
          });

          const response = await client.send(command);
          
          if (!response.Body) {
            continue; // Try next region
          }

          const bodyText = await response.Body.transformToString();
          const data = JSON.parse(bodyText);
          
          return {
            stack_trace: data.stack_trace || data.stackTrace || '',
            error_message: data.error_message || data.message || data.error || '',
            context: data.context || data
          };
        } catch (error: any) {
          // If PermanentRedirect, try next region
          if (error.Code === 'PermanentRedirect') {
            continue;
          }
          // For other errors, skip this region (suppress verbose logging)
          continue;
        }
      }
      
      // If all regions failed (suppress verbose logging during bulk processing)
      return null;
    } catch (error) {
      console.error(`Failed to parse S3 URL ${s3Pointer}:`, error);
      return null;
    }
  }
}