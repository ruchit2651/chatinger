const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/conversationController');

router.get('/', auth, ctrl.listConversations);
router.post('/', auth, ctrl.getOrCreate);
router.put('/:id/favorite', auth, ctrl.favorite);
router.delete('/:id/favorite', auth, ctrl.unfavorite);

module.exports = router;
