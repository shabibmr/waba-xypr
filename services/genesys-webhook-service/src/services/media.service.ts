import * as Minio from 'minio';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import mime from 'mime-types';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import logger from '../utils/logger';

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

        this.bucketName = config.minio.bucket;
        this._ensureBucket();
    }

    async _ensureBucket() {
        try {
            const exists = await this.minioClient.bucketExists(this.bucketName);
            if (!exists) {
                await this.minioClient.makeBucket(this.bucketName, 'us-east-1'); // Region required for some types
            }
        } catch (error) {
            logger.error('Error ensuring MinIO bucket exists', error);
        }
    }

    /**
     * Upload content from a URL to MinIO
     * @param {string} url - Source URL (e.g. from Genesys)
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<string>} Public MinIO URL
     */
    async uploadFromUrl(url: string, tenantId: string): Promise<string> {
        try {
            // 1. Download from URL
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || 'application/octet-stream';

            // 2. Generate path
            const ext = mime.extension(contentType) || 'bin';
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const filename = `${uuidv4()}.${ext}`;
            const storagePath = `${tenantId}/${year}/${month}/${filename}`;

            // 3. Upload
            await this.minioClient.putObject(
                this.bucketName,
                storagePath,
                buffer,
                buffer.length,
                { 'Content-Type': contentType }
            );

            // 4. Return Public URL
            const baseUrl = config.minio.publicUrl
                ? config.minio.publicUrl
                : `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}`;

            return `${baseUrl}/${this.bucketName}/${storagePath}`;

        } catch (error) {
            logger.error('Media upload failed', error, { url });
            throw error; // Propagate to caller
        }
    }
}

export default new MediaService();
