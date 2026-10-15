const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const env = require('../config/env');

// Cloudflare R2 is fully S3-compatible:
// Endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
// Credentials: R2 Access Key ID & Secret Access Key
const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  publicDomain: process.env.R2_PUBLIC_DOMAIN // e.g. https://pub-xxxx.r2.dev or https://cdn.yourdomain.com
};

const isR2Configured = Boolean(
  r2Config.accountId &&
  r2Config.accessKeyId &&
  r2Config.secretAccessKey &&
  r2Config.bucketName
);

let s3Client = null;

if (isR2Configured) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2Config.accessKeyId,
      secretAccessKey: r2Config.secretAccessKey
    }
  });
  console.log(`[Storage] Cloudflare R2 client initialized for bucket "${r2Config.bucketName}"`);
} else {
  console.log('[Storage] Cloudflare R2 credentials not configured. Falling back to local disk storage (/uploads).');
}

/**
 * Upload a file buffer or stream directly to Cloudflare R2
 * @param {Buffer} fileBuffer
 * @param {string} fileName - File key, e.g. products/172800-item.jpg
 * @param {string} mimeType - e.g. image/jpeg, image/png
 * @returns {Promise<string>} Public URL of the uploaded asset
 */
async function uploadToR2(fileBuffer, fileName, mimeType) {
  if (!isR2Configured || !s3Client) {
    throw new Error('Cloudflare R2 is not configured in .env');
  }

  const cleanKey = fileName.replace(/^\/+/, '');

  const command = new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: cleanKey,
    Body: fileBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable'
  });

  await s3Client.send(command);

  // Return public URL via custom domain or R2 public dev bucket URL
  if (r2Config.publicDomain) {
    const domain = r2Config.publicDomain.replace(/\/+$/, '');
    return `${domain}/${cleanKey}`;
  }

  // Fallback direct endpoint if no custom domain configured
  return `https://${r2Config.bucketName}.${r2Config.accountId}.r2.cloudflarestorage.com/${cleanKey}`;
}

/**
 * Delete a file from Cloudflare R2 by URL or key
 * @param {string} fileUrlOrKey
 */
async function deleteFromR2(fileUrlOrKey) {
  if (!isR2Configured || !s3Client || !fileUrlOrKey) return;

  try {
    let key = fileUrlOrKey;
    if (fileUrlOrKey.startsWith('http://') || fileUrlOrKey.startsWith('https://')) {
      const url = new URL(fileUrlOrKey);
      key = url.pathname.replace(/^\/+/, '');
    }

    const command = new DeleteObjectCommand({
      Bucket: r2Config.bucketName,
      Key: key
    });

    await s3Client.send(command);
  } catch (err) {
    console.error(`[Storage R2] Failed to delete file ${fileUrlOrKey}:`, err.message);
  }
}

module.exports = {
  isR2Configured,
  r2Config,
  uploadToR2,
  deleteFromR2
};

