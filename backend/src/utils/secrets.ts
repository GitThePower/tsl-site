import {
  GetSecretValueCommand,
  GetSecretValueCommandInput,
  GetSecretValueCommandOutput,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

let _secretsClient: SecretsManagerClient | null = null;
const getSecretsClient = (): SecretsManagerClient => {
  if (!_secretsClient) {
    _secretsClient = new SecretsManagerClient();
  }
  return _secretsClient;
};

const secretCache: Map<string, string> = new Map();

/**
 * Retrieves a secret value from AWS Secrets Manager with in-memory caching.
 * Caches across warm invocations within the same Lambda instance.
 */
export const getSecretValue = async (secretId: string): Promise<string> => {
  if (secretCache.has(secretId)) {
    return secretCache.get(secretId)!;
  }

  const client = getSecretsClient();
  const input: GetSecretValueCommandInput = { SecretId: secretId };
  const response: GetSecretValueCommandOutput = await client.send(new GetSecretValueCommand(input));

  const secretString = response.SecretString ?? '';
  if (!secretString) {
    throw new Error(`Secret ${secretId} has no string content`);
  }

  secretCache.set(secretId, secretString);
  return secretString;
};
