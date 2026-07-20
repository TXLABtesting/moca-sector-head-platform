/**
 * Central typed configuration, loaded once from environment variables.
 * Secrets come from the environment (injected from Azure Key Vault in prod);
 * this module never hard-codes credentials.
 */
export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    synchronize: boolean;
    ssl: boolean;
  };
  entra: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    audience: string;
    issuer: string;
    jwksUri: string;
    redirectUri: string;
  };
  blob: {
    account: string;
    container: string;
    connectionString: string;
  };
  bootstrapSysadminOid: string;
}

const bool = (v: string | undefined, def = false): boolean =>
  v == null ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

const list = (v: string | undefined): string[] =>
  (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export default (): AppConfig => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigins: list(process.env.CORS_ORIGINS),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'moca',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'moca_sector_head',
    synchronize: bool(process.env.DB_SYNCHRONIZE, false),
    ssl: bool(process.env.DB_SSL, false),
  },
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID || '',
    clientId: process.env.ENTRA_CLIENT_ID || '',
    clientSecret: process.env.ENTRA_CLIENT_SECRET || '',
    audience: process.env.ENTRA_API_AUDIENCE || '',
    issuer: process.env.ENTRA_ISSUER || '',
    jwksUri: process.env.ENTRA_JWKS_URI || '',
    redirectUri: process.env.ENTRA_REDIRECT_URI || '',
  },
  blob: {
    account: process.env.BLOB_ACCOUNT || '',
    container: process.env.BLOB_CONTAINER || 'attachments',
    connectionString: process.env.BLOB_CONNECTION_STRING || '',
  },
  bootstrapSysadminOid: process.env.BOOTSTRAP_SYSADMIN_OID || '',
});
