const express = require('express');
const { listProducts } = require('../controllers/productsController');

const router = express.Router();

router.get('/products', listProducts);

module.exports = router;
