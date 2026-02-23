const express = require('express');
const router = express.Router();
const controller = require('../controllers/genesysPlatformController');
const validate = require('../middleware/validation');
const schemas = require('../middleware/validation/genesysPlatform.schema');

router.get('/org-info', controller.getOrganizationMe);

router.get('/oauth-clients', controller.listOAuthClients);
router.get('/oauth-clients/:clientId', controller.getOAuthClient);
router.post('/oauth-clients', validate(schemas.createOAuthClient), controller.createOAuthClient);

router.get('/integrations', controller.listIntegrations);
router.post('/provision-messaging', validate(schemas.provisionMessaging), controller.provisionMessaging);

module.exports = router;
