const Minio = require('minio');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const config = require('../config');
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
                logger.info(`Created MinIO bucket: ${this.bucketName}`);

                // Set bucket policy to public read
                const policy = {
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Principal: { AWS: ['*'] },
                            Action: ['s3:GetObject'],
                            Resource: [`arn:aws:s3:::${this.bucketName}/*`]
                        }
                    ]
                };
                await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
            }
        } catch (error) {
            logger.error('Error ensuring MinIO bucket exists', error);
        }
    }

    /**
     * Upload buffer to MinIO
     * @param {Buffer} buffer - File buffer
     * @param {string} mimeType - MIME type
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} Upload result
     */
    async uploadMedia(buffer, mimeType, tenantId) {
        try {
            const ext = mime.extension(mimeType) || 'bin';
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const filename = `${uuidv4()}.${ext}`;
            const storagePath = `${tenantId}/${year}/${month}/${filename}`;
            const fileSize = buffer.length;

            await this.minioClient.putObject(
                this.bucketName,
                storagePath,
                buffer,
                fileSize,
                { 'Content-Type': mimeType }
            );

            // 5. Construct Public URL
            // If MINIO_PUBLIC_URL is set, use it. Otherwise, use the endpoint/port.
            let baseUrl = config.minio.publicUrl;

            if (!baseUrl) {
                const protocol = config.minio.useSSL ? 'https' : 'http';
                baseUrl = `${protocol}://${config.minio.endpoint}:${config.minio.port}`;
            }

            // Ensure no trailing slash on baseUrl
            if (baseUrl.endsWith('/')) {
                baseUrl = baseUrl.slice(0, -1);
            }

            const publicUrl = `${baseUrl}/${this.bucketName}/${storagePath}`;

            logger.info('Media uploaded to MinIO', { tenantId, publicUrl });

            return {
                publicUrl,
                storagePath,
                fileSize,
                mimeType
            };

        } catch (error) {
            logger.error('Failed to upload media to MinIO', error);
            throw error;
        }
    }
}

module.exports = new MediaService();
