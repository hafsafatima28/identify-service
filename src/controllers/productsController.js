const products = require('../data/products');

function listProducts(req, res) {
  res.status(200).json({ products });
}

// v1.1: basic keyword search across product names (case-insensitive).
function searchProducts(req, res) {
  const { keyword } = req.query;
  if (!keyword) {
    return res.status(200).json({ products });
  }
  const lower = keyword.toLowerCase();
  const results = products.filter((p) => p.name.toLowerCase().includes(lower));
  res.status(200).json({ products: results });
}

module.exports = { listProducts, searchProducts };
