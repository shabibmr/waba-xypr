const Minio = require('minio');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const config = require('../config/config');
const logger = require('../utils/logger');

class MediaService {
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
                await this.minioClient.makeBucket(this.bucketName);
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
    async uploadFromUrl(url, tenantId) {
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

module.exports = new MediaService();
