const express = require('express');
const router = express.Router();
const multer = require('multer');
const templateController = require('../controllers/templateController');
const validate = require('../middleware/validation');
const templateSchemas = require('../middleware/validation/template.schema');

// Configure multer for media uploads (100MB limit for documents)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Static routes MUST come before :id param routes
router.post('/sync', templateController.syncTemplates);
router.post('/media/upload', upload.single('file'), templateController.uploadMedia);

// Template CRUD (authenticate middleware applied at mount level in index.js)
router.get('/', validate(templateSchemas.list, 'query'), templateController.listTemplates);
router.post('/', validate(templateSchemas.create), templateController.createTemplate);
router.get('/:id', templateController.getTemplate);
router.put('/:id', validate(templateSchemas.update), templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);
router.post('/:id/duplicate', validate(templateSchemas.duplicate), templateController.duplicateTemplate);

module.exports = router;
