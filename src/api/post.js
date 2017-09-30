const bodyParser = require('body-parser');
const config = require('config');
const database = require('./database');
const express = require('express');

const router = express.Router();
router.use(bodyParser.json());
router.post('/:id', (req, res) => {
  const id = req.params.id;
  const record = Object.assign({}, req.body);
  record.lastupdated = Date.now();
  database.update(id, record).then(record => {
    res.contentType('json');
    res.send(record);
  }).catch(error => {
    throw error;
  });
});

module.exports = router;
