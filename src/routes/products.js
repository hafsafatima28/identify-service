const express = require('express');
const { listProducts, searchProducts } = require('../controllers/productsController');

const router = express.Router();

// Order matters: /search must be registered before the (future) /:id route
// so Express doesn't treat "search" as an id parameter.
router.get('/products/search', searchProducts);
router.get('/products', listProducts);

module.exports = router;
