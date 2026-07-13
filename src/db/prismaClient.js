// Single shared Prisma client instance. Reusing one instance (instead of
// `new PrismaClient()` per request) avoids exhausting the DB connection pool.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
