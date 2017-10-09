document.addEventListener('DOMContentLoaded', () => {
  const href = window.location.href;
  const id = href.match(/\/([^\/]+)\/$/)[1];
  const api = '/api';

  const manager = new UrlManager(`${api}/${id}`);

  setInterval(manager.polling.bind(manager), 2000);
});

function UrlManager(url){
  this.url = url;
  this.lastupdated = null;
  this.frame = document.querySelector('iframe');
}

UrlManager.prototype = {
  polling: function(){
    const xhr = new XMLHttpRequest();
    xhr.open('GET', this.url, true);
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200){
        const json = JSON.parse(xhr.responseText);
        const url =
          json.length !== 0
          ? this.openUrl(json[0])
          : "/pcss/pcss-sample.html";
        this.openUrl(url);
      }
    };
    xhr.send(null);
  },

  openUrl: function(json){
    if(this.lastupdated != json.lastupdated){
      this.lastupdated = json.lastupdated;
      const url = `${json.url}?${Date.now()}`;
      this.frame.src = url;
    }
  }
}
