const config = require('config');
const database = require('./database');
const express = require('express');

const router = express.Router();
router.get('/:id', (req, res) => {
  const id = req.params.id;
  database.find(id).then(record => {
    res.contentType('json');
    res.send(record);
  }).catch(error => {
    throw error;
  });
});

module.exports = router;
