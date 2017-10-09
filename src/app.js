const express = require('express');

const app = express();
const post = require('./api/post');
const get = require('./api/get');

app.use('/api', post);
app.use('/api', get);

app.listen(80, () => {
  console.log('Example app listening on port 3000!');
});

app.use('/:id', express.static(`${__dirname}/static`));
