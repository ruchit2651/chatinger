const router = require('express').Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/uploadController');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

router.post('/', auth, upload.single('file'), ctrl.uploadFile);

module.exports = router;
