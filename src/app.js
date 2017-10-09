const express = require('express');
const port = process.env.PORT || 3000;

const app = express();
const post = require('./api/post');
const get = require('./api/get');

app.use('/api', post);
app.use('/api', get);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});

app.use('/app/:id', express.static(`${__dirname}/static/app`));
app.use('/:id', express.static(`${__dirname}/static`));
app.use('/pcss', express.static(`${__dirname}/static/pcss`));
