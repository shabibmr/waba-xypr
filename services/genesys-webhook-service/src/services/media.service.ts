import * as Minio from 'minio';
import axios from 'axios';
import crypto from 'crypto';
// @ts-ignore
import mime from 'mime-types';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import logger from '../utils/logger';

// 04-G: Allowed MIME types (FRD §5.2.3)
const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'audio/mpeg', 'audio/ogg', 'audio/wav',
    'video/mp4', 'video/quicktime',
    'text/plain', 'text/csv',
]);

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB (04-H)
const DOWNLOAD_TIMEOUT_MS = 30_000;       // 30 s (FRD §3.2)
const UPLOAD_TIMEOUT_MS = 30_000;         // 30 s (FRD §3.2)
const PRESIGNED_URL_TTL_SECS = 7 * 24 * 3600; // 7 days (04-F)

class MediaService {
    minioClient: Minio.Client;
    bucketName: string;

    constructor() {
        this.minioClient = new Minio.Client({
            endPoint: config.minio.endpoint,
            port: config.minio.port,
            useSSL: config.minio.useSSL,
            accessKey: config.minio.accessKey,
            secretKey: config.minio.secretKey
        });
        this.bucketName = config.minio.bucket; // 04-D: defaults to 'media-outbound'
        this._ensureBucket();
    }

    async _ensureBucket() {
        try {
            const exists = await this.minioClient.bucketExists(this.bucketName);
            if (!exists) {
                await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
                logger.info('Created MinIO bucket', { bucket: this.bucketName });
            }
        } catch (error) {
            logger.error('Error ensuring MinIO bucket exists', error);
        }
    }

    /**
     * 04-A/B: Fetch Genesys OAuth token from Auth Service.
     */
    private async getGenesysToken(tenantId: string): Promise<string> {
        const response = await axios.post(
            `${config.services.auth.url}/api/v1/token`,
            { tenantId, type: 'genesys' },
            { timeout: 5000 }
        );
        const token: string | undefined = response.data?.accessToken;
        if (!token) throw new Error('Auth Service returned no access token');
        return token;
    }

    /**
     * Download a Genesys media attachment and relay it via MinIO.
     *
     * 04-A/B: Bearer token from Auth Service
     * 04-C: Streamed download (no full memory buffer)
     * 04-D: Uploads to 'media-outbound' bucket
     * 04-E: Path = {tenantId}/{YYYY}/{MM}/{DD}/{uuid}.{ext}
     * 04-F: Returns 7-day presigned URL
     * 04-G: Rejects disallowed MIME types
     * 04-H: Rejects files > 20 MB (via Content-Length header check)
     */
    async uploadFromUrl(url: string, tenantId: string): Promise<{ presignedUrl: string; contentType: string }> {
        // 04-A/B: Obtain Genesys OAuth token
        const token = await this.getGenesysToken(tenantId);

        // 04-C: Stream download with 30s timeout and auth header
        const downloadResponse = await axios.get(url, {
            responseType: 'stream',
            timeout: DOWNLOAD_TIMEOUT_MS,
            headers: { Authorization: `Bearer ${token}` }
        });

        // 04-H: Reject if Content-Length exceeds 20 MB
        const rawLength = downloadResponse.headers['content-length'];
        const contentLength = rawLength ? parseInt(rawLength, 10) : 0;
        if (contentLength > MAX_FILE_BYTES) {
            downloadResponse.data.destroy();
            throw new Error(`Media too large: ${contentLength} bytes (max ${MAX_FILE_BYTES})`);
        }

        // 04-G: Validate MIME type
        const rawContentType = downloadResponse.headers['content-type'] || 'application/octet-stream';
        const contentType = rawContentType.split(';')[0].trim().toLowerCase();
        if (!ALLOWED_MIME_TYPES.has(contentType)) {
            downloadResponse.data.destroy();
            throw new Error(`Unsupported MIME type: ${contentType}`);
        }

        // 04-E: Storage path with day component
        const ext = mime.extension(contentType) || 'bin';
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const storagePath = `${tenantId}/${year}/${month}/${day}/${crypto.randomUUID()}.${ext}`;

        // 04-C: Stream directly into MinIO with 30s upload timeout
        const uploadPromise = contentLength > 0
            ? this.minioClient.putObject(
                this.bucketName, storagePath, downloadResponse.data,
                contentLength, { 'Content-Type': contentType }
              )
            : this.minioClient.putObject(
                this.bucketName, storagePath, downloadResponse.data,
                { 'Content-Type': contentType }
              );

        await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('MinIO upload timed out')), UPLOAD_TIMEOUT_MS)
            )
        ]);

        // Build public URL: use MINIO_PUBLIC_URL if set, otherwise fall back to presigned URL
        let publicUrl: string;
        if (config.minio.publicUrl) {
            let baseUrl = config.minio.publicUrl;
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
            publicUrl = `${baseUrl}/${this.bucketName}/${storagePath}`;
        } else {
            publicUrl = await this.minioClient.presignedGetObject(
                this.bucketName,
                storagePath,
                PRESIGNED_URL_TTL_SECS
            );
        }

        logger.info('Media uploaded to MinIO', { bucket: this.bucketName, path: storagePath, contentType, publicUrl });

        return { presignedUrl: publicUrl, contentType };
    }
}

export default new MediaService();
