const express = require('express');
const port = process.env.PORT || 3000;

const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);

const post = require('./api/post');
const get = require('./api/get');

app.use('/api', post);
app.use('/api', get);
app.use('/app/:id', express.static(`${__dirname}/static/app`));
app.use('/:id', express.static(`${__dirname}/static`));
app.use('/pcss', express.static(`${__dirname}/static/pcss`));

io.on("connection", socket => {
  socket.on("request", data => {
    console.log(`[${ data.id }]request`);
    socket.join(data.id);
  });

  socket.on("console.log", data => {
    console.log(`[${ data.id }]console.log(${ data.message })`);
    socket.to(data.id).emit('console.log', { message: data.message });
  });

  socket.on("console.error", data => {
    console.log(`[${ data.id }]console.error(${ data.message })`);
    socket.to(data.id).emit('console.error', { message: data.message });
  });

  socket.on("update", data => {
    console.log(`[${ data.id }]update(${ data.url })`);
    socket.emit('update', { url: data.url });
    socket.to(data.id).emit('update', { url: data.url });
  });
});

server.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
