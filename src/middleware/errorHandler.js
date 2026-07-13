const { ValidationError } = require('../services/identifyService');

/**
 * Centralized error handler.
 *
 * "Misdirect potential threats" (bonus point) is implemented the way real
 * production APIs do it: known, expected errors (bad input) get a clear,
 * helpful message. Anything unexpected (DB failure, bug, etc.) gets a
 * generic, non-descriptive message to the client so internal details
 * (stack traces, DB schema, library versions) are never leaked — while the
 * full error is still logged server-side for debugging.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[unhandled error]', err);
  return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Resource not found.' });
}

module.exports = { errorHandler, notFoundHandler };
