const href = window.location.href;
const id = href.match(/\/([^\/]+)\/$/)[1];

document.querySelector('#title').textContent = id;

loadURL(id);
document.querySelector('#form button').addEventListener('click', () => {
  updateURL(id);
});

function loadURL(id) {
  const request = new XMLHttpRequest();
  request.open('GET', `/api/${id}`, true);
  request.onreadystatechange = () => {
    if (request.status !== 200) {
      console.error(request.responseText);
    }
    if (request.readyState === 4) {
      const record = JSON.parse(request.responseText)[0];
      updateURLUI(record.url);
    }
  };
  request.send(null);
}

function updateURL(id) {
  const request = new XMLHttpRequest();
  request.open('POST', `/api/${id}`, true);
  request.setRequestHeader('Content-Type', 'application/json');

  const url = document.querySelector('#form input').value;
  request.onreadystatechange = () => {
    if (request.status !== 200) {
      console.error(request.responseText);
    }
    if (request.readyState === 4) {
      const record = JSON.parse(request.responseText);
      updateURLUI(record.url);
    }
  };

  request.send(JSON.stringify({url}));
}

function updateURLUI(url) {
  document.querySelector('#url').textContent = url;
}
