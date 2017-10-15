document.addEventListener('DOMContentLoaded', () => {
  const href = window.location.href;
  const id = href.match(/\/([^\/]+)\/$/)[1];

  document.querySelector('#title').textContent = id;

  const socket = io.connect();
  socket.emit('request', { id });
  socket.on('reconnect', data => {
    socket.emit('request', { id });
  });

  socket.on('console.log', data => {
    console.log(data.message);
  });

  socket.on('console.error', data => {
    console.error(data.message);
  });

  socket.on('update', data => {
    document.querySelector('#url').textContent = data.url;
  });

  document.querySelector('#form button').addEventListener('click', () => {
    const url = document.querySelector('#form input').value;
    socket.emit('update', { id, url });
  });
});
