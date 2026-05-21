const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.get('/find', auth, ctrl.findByMobile);

module.exports = router;
