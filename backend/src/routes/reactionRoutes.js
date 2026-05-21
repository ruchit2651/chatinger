const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/reactionController');

router.post('/', auth, ctrl.addReaction);
router.delete('/', auth, ctrl.removeReaction);

module.exports = router;
