const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/pushController');

router.get('/vapid-public-key', ctrl.getPublicKey);
router.post('/subscribe',       auth, ctrl.subscribe);
router.post('/unsubscribe',     auth, ctrl.unsubscribe);

module.exports = router;
