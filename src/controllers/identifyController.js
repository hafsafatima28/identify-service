const { identify } = require('../services/identifyService');

async function identifyHandler(req, res, next) {
  try {
    const { email, phoneNumber } = req.body || {};
    const result = await identify({ email, phoneNumber });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { identifyHandler };
