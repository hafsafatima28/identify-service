// Simple in-memory product catalogue for the DevOps versioning exercise (Task 2).
// A real service would back this with a database; an in-memory list keeps
// the containerization/versioning exercise focused on infra, not data layer.
const products = [
  { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 799 },
  { id: 2, name: 'Mechanical Keyboard', category: 'Electronics', price: 3499 },
  { id: 3, name: 'Notebook', category: 'Stationery', price: 60 },
  { id: 4, name: 'Water Bottle', category: 'Home', price: 349 },
  { id: 5, name: 'Desk Lamp', category: 'Home', price: 899 },
];

module.exports = products;
