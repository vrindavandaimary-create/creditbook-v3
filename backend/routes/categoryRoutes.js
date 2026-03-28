const r = require('express').Router();
const { protect } = require('../middleware/authMiddleware');
const c = require('../controllers/categoryController');
r.use(protect);
r.get('/',        c.getCategories);
r.post('/',       c.createCategory);
r.put('/:id',     c.updateCategory);
r.delete('/:id',  c.deleteCategory);
module.exports = r;
