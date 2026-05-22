const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/register/request', ctrl.requestRegister);
router.post('/register/verify',  ctrl.verifyRegister);
router.post('/login/request',    ctrl.requestLogin);
router.post('/login/verify',     ctrl.verifyLogin);
router.post('/password/request', ctrl.requestPasswordReset);
router.post('/password/verify',  ctrl.verifyPasswordReset);
router.post('/password/reset',   ctrl.resetPassword);
router.get('/me',                auth, ctrl.me);
router.patch('/me',              auth, ctrl.updateMe);

module.exports = router;
