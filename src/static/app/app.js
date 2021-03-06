document.addEventListener('DOMContentLoaded', () => {
  const href = window.location.href;
  const id = href.match(/\/([^\/]+)\/$/)[1];

  const socket = io.connect();
  const frame = document.querySelector('iframe');

  socket.emit('request', { id });

  socket.on('reconnect', data => {
    socket.emit('request', { id });
  });

  socket.on('update', data => {
    console.log(`${ data.url }?${ Date.now() }?${ id }`);
    frame.src = `${ data.url }?${ Date.now() }?${ id }`;
  });
});
