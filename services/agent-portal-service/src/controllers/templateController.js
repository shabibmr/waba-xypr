const axios = require('axios');
const logger = require('../utils/logger');
const Template = require('../models/Template');
const { GenesysUser } = require('../models/Agent');

const META_GRAPH_URL = 'https://graph.facebook.com/v18.0';

/**
 * Helper: get WABA config (waba_id + access_token) for the current user
 */
async function getWhatsAppConfig(userId) {
    const config = await GenesysUser.getTenantWhatsAppConfig(userId);
    if (!config || !config.waba_id) {
        return null;
    }
    return config;
}

/**
 * List templates with filters and pagination
 * GET /api/templates?category=X&status=Y&search=Z&language=L&limit=N&offset=N
 */
async function listTemplates(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const filters = {
            category: req.query.category,
            status: req.query.status,
            search: req.query.search,
            language: req.query.language,
            limit: req.query.limit,
            offset: req.query.offset
        };

        const [templates, total] = await Promise.all([
            Template.findByTenant(waConfig.tenant_id, filters),
            Template.countByTenant(waConfig.tenant_id, filters)
        ]);

        res.json({ templates, total, limit: filters.limit, offset: filters.offset });
    } catch (error) {
        logger.error('List templates error', { error: error.message, userId: req.userId });
        next(error);
    }
}

/**
 * Get single template
 * GET /api/templates/:id
 */
async function getTemplate(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const template = await Template.findById(req.params.id, waConfig.tenant_id);
        if (!template) {
            return res.status(404).json({ error: { message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' } });
        }

        res.json(template);
    } catch (error) {
        logger.error('Get template error', { error: error.message, templateId: req.params.id });
        next(error);
    }
}

/**
 * Create a template (submit to Meta + store in DB)
 * POST /api/templates
 */
async function createTemplate(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const { name, category, language, components, sampleValues } = req.body;

        // Submit to Meta Graph API
        const metaPayload = {
            name,
            category,
            language,
            components: buildMetaComponents(components, sampleValues)
        };

        const metaResponse = await axios.post(
            `${META_GRAPH_URL}/${waConfig.waba_id}/message_templates`,
            metaPayload,
            { headers: { Authorization: `Bearer ${waConfig.access_token}` } }
        );

        const metaTemplateId = metaResponse.data.id;

        // Store in DB
        const template = await Template.create({
            tenantId: waConfig.tenant_id,
            metaTemplateId,
            name,
            category,
            language,
            status: metaResponse.data.status || 'PENDING',
            components,
            sampleValues
        });

        logger.info('Template created', { templateId: template.id, metaTemplateId, name });
        res.status(201).json(template);
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            logger.warn('Meta API rejected template', { metaError });
            return res.status(400).json({
                error: { message: metaError.message || 'Meta API error', code: 'META_API_ERROR', details: metaError }
            });
        }
        logger.error('Create template error', { error: error.message });
        next(error);
    }
}

/**
 * Update a template (submit to Meta + update DB)
 * PUT /api/templates/:id
 */
async function updateTemplate(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const existing = await Template.findById(req.params.id, waConfig.tenant_id);
        if (!existing) {
            return res.status(404).json({ error: { message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' } });
        }

        const { components, sampleValues, category } = req.body;

        // Update via Meta Graph API (only components can be updated for approved templates)
        if (existing.meta_template_id && components) {
            const metaPayload = {
                components: buildMetaComponents(components, sampleValues || existing.sample_values)
            };
            if (category) metaPayload.category = category;

            await axios.post(
                `${META_GRAPH_URL}/${existing.meta_template_id}`,
                metaPayload,
                { headers: { Authorization: `Bearer ${waConfig.access_token}` } }
            );
        }

        // Update in DB
        const updateFields = {};
        if (components) updateFields.components = components;
        if (sampleValues) updateFields.sample_values = sampleValues;
        if (category) updateFields.category = category;

        const template = await Template.update(req.params.id, waConfig.tenant_id, updateFields);
        logger.info('Template updated', { templateId: req.params.id });
        res.json(template);
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            logger.warn('Meta API rejected template update', { metaError });
            return res.status(400).json({
                error: { message: metaError.message || 'Meta API error', code: 'META_API_ERROR', details: metaError }
            });
        }
        logger.error('Update template error', { error: error.message });
        next(error);
    }
}

/**
 * Delete a template (delete from Meta + DB)
 * DELETE /api/templates/:id
 */
async function deleteTemplate(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const existing = await Template.findById(req.params.id, waConfig.tenant_id);
        if (!existing) {
            return res.status(404).json({ error: { message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' } });
        }

        // Delete from Meta
        await axios.delete(
            `${META_GRAPH_URL}/${waConfig.waba_id}/message_templates`,
            {
                params: { name: existing.name },
                headers: { Authorization: `Bearer ${waConfig.access_token}` }
            }
        );

        // Delete from DB
        await Template.delete(req.params.id, waConfig.tenant_id);
        logger.info('Template deleted', { templateId: req.params.id, name: existing.name });
        res.json({ success: true, message: 'Template deleted' });
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            logger.warn('Meta API delete error', { metaError });
            return res.status(400).json({
                error: { message: metaError.message || 'Meta API error', code: 'META_API_ERROR', details: metaError }
            });
        }
        logger.error('Delete template error', { error: error.message });
        next(error);
    }
}

/**
 * Duplicate a template (DB only, not submitted to Meta)
 * POST /api/templates/:id/duplicate
 */
async function duplicateTemplate(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        const existing = await Template.findById(req.params.id, waConfig.tenant_id);
        if (!existing) {
            return res.status(404).json({ error: { message: 'Template not found', code: 'TEMPLATE_NOT_FOUND' } });
        }

        const newName = req.body.name || `${existing.name}_copy`;
        const newLanguage = req.body.language || existing.language;

        // Check if duplicate already exists
        const duplicate = await Template.findByNameAndLanguage(waConfig.tenant_id, newName, newLanguage);
        if (duplicate) {
            return res.status(409).json({
                error: { message: 'A template with this name and language already exists', code: 'TEMPLATE_DUPLICATE' }
            });
        }

        const template = await Template.create({
            tenantId: waConfig.tenant_id,
            metaTemplateId: null,
            name: newName,
            category: existing.category,
            language: newLanguage,
            status: 'DRAFT',
            components: existing.components,
            sampleValues: existing.sample_values
        });

        logger.info('Template duplicated', { sourceId: req.params.id, newId: template.id });
        res.status(201).json(template);
    } catch (error) {
        logger.error('Duplicate template error', { error: error.message });
        next(error);
    }
}

/**
 * Sync templates from Meta
 * POST /api/templates/sync
 */
async function syncTemplates(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        let url = `${META_GRAPH_URL}/${waConfig.waba_id}/message_templates?limit=100`;
        const counts = { created: 0, updated: 0, unchanged: 0 };

        // Paginate through all templates from Meta
        while (url) {
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${waConfig.access_token}` }
            });

            const metaTemplates = response.data.data || [];

            for (const mt of metaTemplates) {
                const result = await Template.upsertFromMeta(waConfig.tenant_id, {
                    id: mt.id,
                    name: mt.name,
                    category: mt.category,
                    language: mt.language,
                    status: mt.status,
                    quality_score: mt.quality_score?.score,
                    components: mt.components || [],
                    rejected_reason: mt.rejected_reason
                });

                if (!result) {
                    counts.unchanged++;
                } else if (result.is_new) {
                    counts.created++;
                } else {
                    counts.updated++;
                }
            }

            url = response.data.paging?.next || null;
        }

        logger.info('Templates synced from Meta', { tenantId: waConfig.tenant_id, ...counts });
        res.json({ success: true, ...counts });
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            logger.warn('Meta API sync error', { metaError });
            return res.status(400).json({
                error: { message: metaError.message || 'Meta API error', code: 'META_API_ERROR', details: metaError }
            });
        }
        logger.error('Sync templates error', { error: error.message });
        next(error);
    }
}

/**
 * Upload media to Meta for template header
 * POST /api/templates/media/upload
 */
async function uploadMedia(req, res, next) {
    try {
        const waConfig = await getWhatsAppConfig(req.userId);
        if (!waConfig) {
            return res.status(400).json({ error: { message: 'WhatsApp not configured', code: 'MSG_002' } });
        }

        if (!req.file) {
            return res.status(400).json({ error: { message: 'No file uploaded', code: 'VALIDATION_001' } });
        }

        // Step 1: Create upload session
        const sessionResponse = await axios.post(
            `${META_GRAPH_URL}/app/uploads`,
            null,
            {
                params: {
                    file_length: req.file.size,
                    file_type: req.file.mimetype,
                    file_name: req.file.originalname
                },
                headers: { Authorization: `Bearer ${waConfig.access_token}` }
            }
        );

        const uploadSessionId = sessionResponse.data.id;

        // Step 2: Upload file data
        const uploadResponse = await axios.post(
            `${META_GRAPH_URL}/${uploadSessionId}`,
            req.file.buffer,
            {
                headers: {
                    Authorization: `OAuth ${waConfig.access_token}`,
                    'Content-Type': req.file.mimetype,
                    file_offset: '0'
                }
            }
        );

        logger.info('Media uploaded to Meta', {
            handle: uploadResponse.data.h,
            fileName: req.file.originalname
        });

        res.json({ handle: uploadResponse.data.h });
    } catch (error) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            logger.warn('Meta media upload error', { metaError });
            return res.status(400).json({
                error: { message: metaError.message || 'Media upload failed', code: 'META_API_ERROR', details: metaError }
            });
        }
        logger.error('Upload media error', { error: error.message });
        next(error);
    }
}

/**
 * Build Meta-format components from our internal format
 * Adds example fields from sample values as required by Meta
 */
function buildMetaComponents(components, sampleValues = {}) {
    return components.map(comp => {
        const metaComp = { ...comp };

        // Add example/sample values for variables in body
        if (comp.type === 'BODY' && comp.text) {
            const varMatches = comp.text.match(/\{\{\d+\}\}/g);
            if (varMatches && sampleValues.body) {
                metaComp.example = {
                    body_text: [varMatches.map((_, i) => sampleValues.body[i] || `sample_${i + 1}`)]
                };
            }
        }

        // Add example for header variables
        if (comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text) {
            const varMatches = comp.text.match(/\{\{\d+\}\}/g);
            if (varMatches && sampleValues.header) {
                metaComp.example = {
                    header_text: [sampleValues.header[0] || 'sample']
                };
            }
        }

        // Add media handle for media headers
        if (comp.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(comp.format) && sampleValues.headerHandle) {
            metaComp.example = {
                header_handle: [sampleValues.headerHandle]
            };
        }

        return metaComp;
    });
}

module.exports = {
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    syncTemplates,
    uploadMedia
};
