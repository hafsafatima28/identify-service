const express = require('express');
const { identifyHandler } = require('../controllers/identifyController');

const router = express.Router();

router.post('/identify', identifyHandler);

module.exports = router;
