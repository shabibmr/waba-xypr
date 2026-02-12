const Minio = require('minio');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const config = require('../config/config');
const Logger = require('../utils/logger');

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
                Logger.info(`Created MinIO bucket: ${this.bucketName}`);

                // Set bucket policy to public read (be helpful for sharing links)
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
            Logger.error('Error ensuring MinIO bucket exists', error);
        }
    }

    /**
     * Save media from Meta to MinIO
     * @param {string} mediaId - Meta Media ID
     * @param {string} accessToken - Meta Graph API Access Token
     * @param {string} tenantId - Tenant ID for folder organization
     * @param {string} mimeType - MIME type of the file
     * @returns {Promise<Object>} { minioUrl, storagePath, fileSize }
     */
    async saveMedia(mediaId, accessToken, tenantId, mimeType) {
        try {
            // 1. Get Media URL from Meta
            const urlResponse = await axios.get(
                `https://graph.facebook.com/v18.0/${mediaId}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            );

            const mediaUrl = urlResponse.data.url;

            // 2. Download Media Stream
            // Note: Meta media URLs redirect, so we need to follow them
            const fileResponse = await axios.get(mediaUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: 'arraybuffer' // Using buffer for simpler upload to MinIO
            });

            const buffer = Buffer.from(fileResponse.data);
            const fileSize = buffer.length;

            // 3. Generate Filename
            const ext = mime.extension(mimeType) || 'bin';
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const filename = `${uuidv4()}.${ext}`;
            const storagePath = `${tenantId}/${year}/${month}/${filename}`;

            // 4. Upload to MinIO
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

            Logger.forTenant(tenantId).info('Media uploaded to MinIO', { mediaId, publicUrl });

            return {
                publicUrl,
                storagePath,
                fileSize,
                mimeType
            };

        } catch (error) {
            Logger.forTenant(tenantId).error('Failed to process media', error, { mediaId });
            throw error;
        }
    }
}

module.exports = new MediaService();
