const products = require('../data/products');

function listProducts(req, res) {
  res.status(200).json({ products });
}

module.exports = { listProducts };
