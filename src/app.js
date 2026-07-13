const express = require('express');
const identifyRoutes = require('./routes/identify');
const productsRoutes = require('./routes/products');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Health check — used by Docker HEALTHCHECK and Kubernetes probes.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/', identifyRoutes);
app.use('/', productsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
