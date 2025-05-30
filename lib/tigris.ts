import { S3Client, CreateBucketCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { IAMClient, CreateAccessKeyCommand, CreatePolicyCommand, AttachUserPolicyCommand, DeleteAccessKeyCommand, DeletePolicyCommand, PutUserPolicyCommand } from "@aws-sdk/client-iam";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface Error {
  error: string;
  status: string;
}

function getConfigOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing configuration for Tigris: ${key}. Ensure environment variables are set.`);
  }
  return value;
}

const TIGRIS_ACCESS_KEY = getConfigOrThrow("FLY_TIGRIS_ACCESS_KEY");
const TIGRIS_SECRET_KEY = getConfigOrThrow("FLY_TIGRIS_SECRET_ACCESS_KEY");
const TIGRIS_S3_ENDPOINT = "https://fly.storage.tigris.dev";
const TIGRIS_IAM_ENDPOINT = "https://fly.iam.storage.tigris.dev";

const s3Client = new S3Client({
  endpoint: TIGRIS_S3_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: TIGRIS_ACCESS_KEY,
    secretAccessKey: TIGRIS_SECRET_KEY
  },
  forcePathStyle: false
});

const iamClient = new IAMClient({
  endpoint: TIGRIS_IAM_ENDPOINT,
  region: "auto",
  credentials: {
    accessKeyId: TIGRIS_ACCESS_KEY,
    secretAccessKey: TIGRIS_SECRET_KEY
  }
});

async function createBucket(bucketName: string): Promise<void> {
  try {
    const response = await s3Client.send(new CreateBucketCommand({
      Bucket: bucketName
    }));
    console.log(`[tigris] Create bucket response: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.error(`[tigris] Create bucket error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
}

export async function deleteBucket(bucketName: string): Promise<void> {
  try {
    const response = await s3Client.send(new DeleteBucketCommand({
      Bucket: bucketName
    }));
    console.log(`[tigris] Delete bucket response: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.error(`[tigris] Delete bucket error: ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
}

function createBucketPolicyDocument(bucketName: string): string {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ListObjectsInBucket",
        Effect: "Allow",
        Action: ["s3:ListObjects", "s3:ListObjectsV2"],
        Resource: [`arn:aws:s3:::${bucketName}`]
      },
      {
        Sid: "ManageAllObjectsInBucketWildcard",
        Effect: "Allow",
        Action: ["s3:*"],
        Resource: [`arn:aws:s3:::${bucketName}/*`]
      }
    ]
  };
  return JSON.stringify(policy);
}

async function createAccessKey(
  iamClient: IAMClient,
  userName: string
): Promise<{ accessKeyId: string; secretAccessKey: string } | Error> {
  try {
    const response = await iamClient.send(new CreateAccessKeyCommand({
      UserName: userName
    }));
    console.log(`[tigris] Create access key response: ${JSON.stringify(response, null, 2)}`);

    if (!response.AccessKey?.AccessKeyId || !response.AccessKey?.SecretAccessKey) {
      return {
        error: "Failed to create access key: Missing access key information in response",
        status: "error"
      };
    }

    return {
      accessKeyId: response.AccessKey.AccessKeyId,
      secretAccessKey: response.AccessKey.SecretAccessKey
    };
  } catch (error) {
    console.error(`[tigris] Create access key error:`, JSON.stringify(error, null, 2));
    return {
      error: `Failed to create access key: ${error.message}`,
      status: "error"
    };
  }
}

async function createPolicy(
  iamClient: IAMClient,
  policyName: string,
  policyDocument: string
): Promise<{ policyArn: string } | Error> {
  try {
    const response = await iamClient.send(new CreatePolicyCommand({
      PolicyName: policyName,
      PolicyDocument: policyDocument
    }));
    console.log(`[tigris] Create policy response: ${JSON.stringify(response, null, 2)}`);

    if (!response.Policy?.Arn) {
      return {
        error: "Failed to create policy: Missing policy ARN in response",
        status: "error"
      };
    }

    return { policyArn: response.Policy.Arn };
  } catch (error) {
    console.error(`[tigris] Create policy error:`, JSON.stringify(error, null, 2));
    return {
      error: `Failed to create policy: ${error.message}`,
      status: "error"
    };
  }
}

async function attachUserPolicy(
  iamClient: IAMClient,
  userName: string,
  policyArn: string
): Promise<void | Error> {
  try {
    const response = await iamClient.send(new AttachUserPolicyCommand({
      UserName: userName,
      PolicyArn: policyArn
    }));
    console.log(`[tigris] Attach user policy response: ${JSON.stringify(response, null, 2)}`);
  } catch (error) {
    console.error(`[tigris] Attach user policy error:`, JSON.stringify(error, null, 2));
    return {
      error: `Failed to attach policy: ${error.message}`,
      status: "error"
    };
  }
}

async function deleteAccessKey(
  iamClient: IAMClient,
  userName: string,
  accessKeyId: string
): Promise<void | Error> {
  try {
    const response = await iamClient.send(new DeleteAccessKeyCommand({
      UserName: userName,
      AccessKeyId: accessKeyId
    }));
    console.log(`[tigris] Delete access key response:`, JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(`[tigris] Delete access key error:`, JSON.stringify(error, null, 2));
    return {
      error: `Failed to delete access key: ${error.message}`,
      status: "error"
    };
  }
}

async function deletePolicy(
  iamClient: IAMClient,
  policyArn: string
): Promise<void | Error> {
  try {
    const response = await iamClient.send(new DeletePolicyCommand({
      PolicyArn: policyArn
    }));
    console.log(`[tigris] Delete policy response:`, JSON.stringify(response, null, 2));
  } catch (error) {
    console.error(`[tigris] Delete policy error:`, JSON.stringify(error, null, 2));
    return {
      error: `Failed to delete policy: ${error.message}`,
      status: "error"
    };
  }
}

async function createCredentials(bucketName: string): Promise<Credentials> {
  try {
    // Create access key
    const accessKeyResponse = await iamClient.send(new CreateAccessKeyCommand({
      UserName: bucketName
    }));
    console.log(`[tigris] Create credentials access key response: ${JSON.stringify(accessKeyResponse, null, 2)}`);

    if (!accessKeyResponse.AccessKey) {
      throw new Error("Failed to create access key");
    }

    // Create policy
    const policyName = `${bucketName}-policy`;
    const policyDocument = createBucketPolicyDocument(bucketName);
    const policyResponse = await iamClient.send(new CreatePolicyCommand({
      PolicyName: policyName,
      PolicyDocument: policyDocument
    }));
    console.log(`[tigris] Create credentials policy response: ${JSON.stringify(policyResponse, null, 2)}`);

    if (!policyResponse.Policy?.Arn) {
      throw new Error("Failed to create policy: Missing policy ARN in response");
    }

    // Attach policy to user
    await iamClient.send(new AttachUserPolicyCommand({
      UserName: bucketName,
      PolicyArn: policyResponse.Policy.Arn
    }));
    console.log(`[tigris] Attach user policy response:`, JSON.stringify(policyResponse, null, 2));

    return {
      accessKeyId: accessKeyResponse.AccessKey.AccessKeyId!,
      secretAccessKey: accessKeyResponse.AccessKey.SecretAccessKey!,
      bucket: bucketName
    };
  } catch (error) {
    console.error(`[tigris] Create credentials error:`, JSON.stringify(error, null, 2));
    throw error;
  }
}

export async function createTigrisBucket(bucketName: string): Promise<Credentials> {
  try {
    // Create the bucket first
    await createBucket(bucketName);
    
    try {
      // Then create credentials and policy
      return await createCredentials(bucketName);
    } catch (error) {
      // If credentials creation fails, clean up the bucket
      console.error(`[tigris] Error creating credentials, cleaning up bucket:`, JSON.stringify(error, null, 2));
      await deleteBucket(bucketName);
      throw error;
    }
  } catch (error) {
    console.error(`[tigris] Create Tigris bucket error:`, JSON.stringify(error, null, 2));
    throw new Error(`Failed to set up Tigris bucket: ${error.message}`);
  }
}