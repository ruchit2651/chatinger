const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/messageController');

router.get('/search/all', auth, ctrl.searchMessages);
router.get('/:conversationId', auth, ctrl.getHistory);
router.post('/', auth, ctrl.sendMessage);
router.patch('/:conversationId/read', auth, ctrl.markRead);
router.patch('/:id', auth, ctrl.editMessage);
router.delete('/:id', auth, ctrl.deleteMessage);

module.exports = router;
