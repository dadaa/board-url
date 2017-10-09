window.addEventListener("load", () => {
  CSSDeviceManager.start();
});

var CSSDeviceManager = {
  animation_map: {},
  device_elements: [],
  device_number: 0,
  device_map: {},
  start: function() {
    var self = this;

    var childObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        var children = mutation.addedNodes;
        for (var i = 0, n = children.length; i < n; i++) {
          var child = children[i];
          var config = child.dataset.cssDevice;
          if (config) {
            self.createCSSDevice(config, child);
          }
        }
      });
    });
    childObserver.observe(document.body, {childList: true});

    var cssDeviceElements = document.querySelectorAll("[data-css-device]");
    for (var i = 0, n = cssDeviceElements.length; i < n; i++) {
      var cssDeviceElement = cssDeviceElements[i];
      self.createCSSDevice(cssDeviceElement.dataset.cssDevice, cssDeviceElement);
    }

    var updateDevices = (i, callback) => {
      if (self.device_elements.length === i) {
        callback();
        return;
      }

      var cssDeviceElement = self.device_elements[i];
      var deviceNumber = cssDeviceElement.dataset.deviceNumber;
      var cssDevice = self.device_map[deviceNumber];
      self.update(cssDevice, cssDeviceElement).then(() => {
        updateDevices(i+1, callback);
      });
    };

    (observe = () => {
      updateDevices(0, () => {
        window.requestAnimationFrame(observe);
      });
    })();
  },
  createCSSDevice: function(configString, cssDeviceElement) {
    var configAsJSONString =
      "{" +
      configString.replace(/\s/g, "")
      .replace(/([,:])?([^,;:]*)([,;])/g, "$1\"$2\"$3")
      .replace(/\"(-?[.\d]+)\"/g, "$1")
      .replace(/:(([^,:]+,)+[^;]+);/g, ":[$1];")
      .replace(/;$/g, "")
      .replace(/;/g, ",")
      .replace(/(([-]|\w)+):/g, "\"$1\":") //attribute
      + "}";
    var config = JSON.parse(configAsJSONString);
    var self = this;
    var portType = config["port-type"];
    var portNumber = config["port-number"];
    PortManager.getPort(portType, portNumber).then(
      function(port) {
        var manager = null;
        switch (config.type) {
          case "multi-color-led": {
            manager = MultiColorLEDManager;
            break;
          }
          case "servo": {
            manager = ServoManager;
            break;
          }
          case "adc": {
            manager = ADCManager;
            break;
          }
        }
        if (manager) {
          manager.createCSSDevice(config, port).then(
            function(cssDevice) {
              var deviceNumber = self.device_number++;
              cssDeviceElement.dataset.deviceNumber = deviceNumber;
              cssDevice.deviceNumber = deviceNumber;
              if (cssDevice.isSensor) {
                cssDevice.setListener(self.listen);
              } else {
                self.device_map[deviceNumber] = cssDevice;
                self.device_elements.push(cssDeviceElement);
              }
            },
            function(error) {
              throw new Error(error);
            }
          );
        }
      },
      function(error) {
        console.error(error);
      }
    )
  },

  update: function(cssDevice, cssDeviceElement) {
    var style = window.getComputedStyle(cssDeviceElement, null);
    return cssDevice.update(style);
  },

  listen: function(value, cssDevice) {
    var selector = "[data-device-number=\""+cssDevice.deviceNumber+"\"]";
    var cssDeviceElement = document.querySelector(selector);
    cssDeviceElement.value = value;
    var event = document.createEvent("HTMLEvents");
    event.initEvent("change", true, false);
    cssDeviceElement.dispatchEvent(event);
  }
}
var MultiColorLEDManager = {
  createCSSDevice: function(config, port) {
    return new Promise(function(resolve, reject) {
      PCA9685Manager.getPCA9685(port, config.address).then(
        function(device) {
          var led = new MultiColorLED(config, device);
          resolve(led);
        },
        function(error) {
          reject(error);
        }
      );
    });
  }
}
var MultiColorLED = function(config, device) {
  this.config = config;
  this.device = device;
}

MultiColorLED.prototype = {
  update: function(style) {
    var color = style.color;
    if (this.previous_color == color) {
      return Promise.resolve();
    }
    this.previous_color = color;

    var match = /rgba?\((\d+),\s(\d+),\s(\d+)\)/.exec(color);
    var r = parseInt(match[1]);
    var g = parseInt(match[2]);
    var b = parseInt(match[3]);
    var pins = this.config["pwm-pin"];
    var minPulse = this.config["min-pulse"];
    var maxPulse = this.config["max-pulse"];
    var pulseRange = maxPulse - minPulse;
    r = minPulse + r / 255 * pulseRange;
    g = minPulse + g / 255 * pulseRange;
    b = minPulse + b / 255 * pulseRange;
    var self = this;
    return new Promise((resolve, reject) => {
      self.device.pwm(pins[0], r).then(function() {
        self.device.pwm(pins[1], g).then(function() {
          self.device.pwm(pins[2], b).then(function() {
            resolve();
          });
        });
      });
    });
  }
}

var ServoManager = {
  createCSSDevice: function(config, port) {
    return new Promise(function(resolve, reject) {
      PCA9685Manager.getPCA9685(port, config.address).then(
        function(device) {
          var servo = new Servo(config, device);
          resolve(servo);
        },
        function(error) {
          reject(error);
        }
      );
    });
  }
}
var Servo = function(config, device) {
  this.config = config;
  this.device = device;
}

Servo.prototype = {
  TO_DEGREE: 360 / (2 * Math.PI),
  update: function(style) {
    var transform = style.transform;
    var time = Date.now();
    if (this.previous_transform == transform || time - 100 < this.previous_time) {
      return Promise.resolve();
    }
    this.previous_transform = transform;
    this.previous_time = time;

    //matrix(0, -1, 1, 0, 0, 0)
    var result = /matrix\(([^,]+),\s([^,]+),\s([^,]+),\s([^,]+).*/.exec(transform);
    var m1 = parseFloat(result[1]);
    //var m2 = parseFloat(result[2]);
    //var m3 = parseFloat(result[3]);
    //var m4 = parseFloat(result[4]);
    var radian1 = Math.acos(m1);
    //var radian2 = Math.asin(m2);
    //var radian3 = -Math.asin(m3);
    //var radian4 = Math.acos(m4);
    var degree1 = Math.round(radian1 * this.TO_DEGREE);
    //var degree2 = Math.round(radian2 * this.TO_DEGREE);
    //var degree3 = Math.round(radian3 * this.TO_DEGREE);
    //var degree4 = Math.round(radian4 * this.TO_DEGREE);
    var angle = degree1;
    var pin = this.config["pwm-pin"];
    var minPulse = this.config["min-pulse"];
    var maxPulse = this.config["max-pulse"];
    var pulseRange = maxPulse - minPulse;
    var angleRange = this.config["angle-range"];
    var pulse = minPulse + angle / angleRange * pulseRange;
    return this.device.pwm(pin, pulse);
  }
}
//(function(){
var ab2json = (dataBuffer) => JSON.parse(String.fromCharCode.apply(null, new Uint16Array(dataBuffer)));
var json2ab = (jsonData) => {
  var strJson = JSON.stringify(jsonData);
  var buf = new ArrayBuffer(strJson.length * 2);
  var uInt8Array = new Uint16Array(buf);
  for (var i = 0, strLen = strJson.length; i < strLen; i++) {
    uInt8Array[i] = strJson.charCodeAt(i);
  }

  return uInt8Array;
};

/**
 * @example setting ovserve function
 *   global.MockOvserve.observe('xxxxx_xxxxx_xxxxx', function(updateJson){
 *     stateCtrl.setJsonData(updateJson);
 *   });
 *
 * @example nofify method (parameter single only)
 *   global.MockOvserve.notify('xxxxx_xxxxx_xxxxx', { param: 'PARAM' });
 **/
window.WorkerOvserve = window.WorkerOvserve || (function () {

  function Ovserve() {
    this._Map = new Map();
  }

  // set ovserver
  Ovserve.prototype.observe = function (name, fnc) {
    var funcs = this._Map.get(name) || [];
    funcs.push(fnc);
    this._Map.set(name, funcs);
  };

  // remove ovserver
  Ovserve.prototype.unobserve = function (name, func) {
    var funcs = this._Map.get(name) || [];
    this._Map.set(name, funcs.filter(function (_func) {
      return _func !== func;
    }));
  };

  // notify ovserve
  Ovserve.prototype.notify = function (name) {
    var args = Array.prototype.slice.call(arguments, 1);
    /* istanbul ignore next */
    (this._Map.get(name) || []).forEach(function (func, index) {
      func.apply(null, args);
    });
  };

  // delete map
  // delete
  Ovserve.prototype.delete = function (name) {
    this._Map.delete(name);
  };

  return new Ovserve();
})();

const PORT_CONFIG = {
  // https://docs.google.com/spreadsheets/d/1pVgK-Yy09p9PPgNgojQNLvsPjDFAOjOubgNsNYEQZt8/edit#gid=0
  CHIRIMEN: {
    PORTS: {
      283: { portName: 'CN1.UART3_RX', pinName: '4', },
      284: { portName: 'CN1.UART3_TX', pinName: '5', },
      196: { portName: 'CN1.SPI0_CS',  pinName: '7', },
      197: { portName: 'CN1.SPI0_CLK', pinName: '8', },
      198: { portName: 'CN1.SPI0_RX',  pinName: '9', },
      199: { portName: 'CN1.SPI0_TX',  pinName: '10', },
      244: { portName: 'CN1.SPI1_CS',  pinName: '11', },
      243: { portName: 'CN1.SPI1_CLK', pinName: '12', },
      246: { portName: 'CN1.SPI1_RX',  pinName: '13', },
      245: { portName: 'CN1.SPI1_TX',  pinName: '14', },
      163: { portName: 'CN2.PWM0',     pinName: '10', },
      193: { portName: 'CN2.UART0_TX', pinName: '13', },
      192: { portName: 'CN2.UART0_RX', pinName: '14', },
      353: { portName: 'CN2.GPIO6_A1', pinName: '15', },
    },
    I2C_PORTS: {
        0: {
          SDA: { portName: 'CN2.I2C0_SCL', pinName: '11', },
          SCL: { portName: 'CN2.I2C0_SDA', pinName: '12', },
        },
        2: {
          SDA: { portName: 'CN1.I2C2_SDA', pinName: '2', },
          SCL: { portName: 'CN1.I2C2_SCL', pinName: '3', },
        },
      },
  },
};

// document
// https://rawgit.com/browserobo/WebI2C/master/index.html#navigator-I2C

var I2CAccess = function (port) {
  this.init(port);
};

I2CAccess.prototype = {
  init: function (port) {
    this.ports = new I2CPortMap();
    var convertToNumber = portStr => parseInt(portStr, 10);
    var setPortMap = port=> this.ports.set(port, new I2CPort(port));
    /**
    * @todo getI2C Ports
    ***/
    Object.keys(PORT_CONFIG.CHIRIMEN.I2C_PORTS)
      .map(convertToNumber)
      .forEach(setPortMap);
  },

  /**
  * @type {I2CPortMap}
  **/
  ports: null,
};

// https://rawgit.com/browserobo/WebI2C/master/index.html#I2CPort-interface

function I2CPort(portNumber) {
  this.init(portNumber);
}

I2CPort.prototype = {
  init: function (portNumber) {
    this.portNumber = portNumber;
    window.WorkerOvserve.notify('i2c', {
      method: 'i2c.open',
      portNumber: this.portNumber,
    });
  },

  /**
  * @readonly
  **/
  portNumber: 0,

  /**
  * @param {short} I2CSlaveAddress
  * @return {Promise<2CSlaveDevice>}
  * @example
  * var slaveDevice = null;
  * // Getting a slave device representing the slave address 0x40.
  * var slaveAddress = 0x40;
  * port.open(slaveAddress).then(
  *     function(I2CSlave) {
  *     	slaveDevice = I2CSlave; // store in global
  *     },
  *     function(error) {
  *         console.log("Failed to get a I2C slave device: " + error.message);
  *     }
  * );
  **/
  open: function (slaveAddress) {
    return new Promise((resolve, reject)=> {
      new I2CSlaveDevice(this.portNumber, slaveAddress).then((i2cslave) => {
        resolve(i2cslave);
      }, (err) => {
        reject(err);
      });
    });
  },
};

// document
// https://rawgit.com/browserobo/WebI2C/master/index.html#I2CPortMap-interface)

var I2CPortMap = Map;

// https://rawgit.com/browserobo/WebI2C/master/index.html#I2CSlaveDevice-interface

// base example
// https://github.com/browserobo/WebI2C/blob/master/implementations/Gecko/test-i2c/js/WebI2C.js

function I2CSlaveDevice(portNumber, slaveAddress) {
  return new Promise((resolve, reject)=> {
    this.init(portNumber, slaveAddress).then(() => {
      resolve(this);
    }, (err) => {
      reject(err);
    });
  });
}

I2CSlaveDevice.prototype = {
  init: function (portNumber, slaveAddress) {
    return new Promise((resolve, reject) => {

      this.portNumber = portNumber;
      this.slaveAddress = slaveAddress;

      window.WorkerOvserve.notify('i2c', {
        method: 'i2c.setDeviceAddress',
        portNumber: this.portNumber,
        slaveAddress: this.slaveAddress,
      });

      window.WorkerOvserve.observe(`i2c.setDeviceAddress.${this.portNumber}`, (data) => {
        if (!data.error) {
          this.slaveDevice = data.slaveDevice;
          resolve(data.slaveDevice);
        }else {
          //console.log('i2c.setDeviceAddress: error name:[' + data.error.name + ']');
          reject(data.error);
        }

        window.WorkerOvserve.delete(`i2c.setDeviceAddress.${this.portNumber}`);
      });
    });
  },

  getXid: function () {
    this.xid++;
    if (this.xid > 999) {
      this.xid = 0;
    }

    return this.xid;
  },

  // Transaction ID
  xid: 0,

  /**
  * @private
  * @readonly
  **/
  portNumber: void 0,

  /**
  * @readonly
  **/
  slaveAddress: void 0,

  /**
  * @private
  * @readonly
  **/
  slaveDevice: void 0,

  /**
  * @param registerNumber
  * @return  Promise  read8(unsigned short registerNumber);
  * @example
  * // read the eight bits value from a specified registar (0x10)
  * var readRegistar = 0x10;
  * window.setInterval(function() {
  *     slaveDevice.read8(readRegistar).then(readSuccess, I2CError);
  * }, 1000);
  *
  * // the value successfully read
  * function readSuccess(value) {
  *     console.log(slaveAddress + ":" + readRegistar + ": " + value);
  * }
  *
  * // Show an error
  * function I2CError(error) {
  *     console.log("Error: " + error.message + "(" + slaveAddress + ")");
  * }
  **/
  read8: function (readRegistar) {
    return new Promise((resolve, reject) => {

      var transactionID = this.getXid();

      window.WorkerOvserve.notify('i2c', {
        method: 'i2c.read',
        xid: transactionID,
        portNumber: this.portNumber,
        slaveAddress: this.slaveAddress,
        readRegistar: readRegistar,
        aIsOctet: true,
      });

      window.WorkerOvserve.observe(`i2c.read.${transactionID}.${this.portNumber}.${this.slaveAddress}.${readRegistar}`, (data) => {
        if (!data.error) {
          resolve(data.value);
        }else {
          //console.log('i2c.read8: error name:[' + data.error.name + ']');
          reject(data.error);
        }

        window.WorkerOvserve.delete(`i2c.read.${transactionID}.${this.portNumber}.${this.slaveAddress}.${readRegistar}`);
      });
    });
  },

  read16: function (readRegistar) {
    return new Promise((resolve, reject) => {

      var transactionID = this.getXid();

      window.WorkerOvserve.notify('i2c', {
        method: 'i2c.read',
        xid: transactionID,
        portNumber: this.portNumber,
        slaveAddress: this.slaveAddress,
        readRegistar: readRegistar,
        aIsOctet: false,
      });

      window.WorkerOvserve.observe(`i2c.read.${transactionID}.${this.portNumber}.${this.slaveAddress}.${readRegistar}`, (data) => {
        if (!data.error) {
          resolve(data.value);
        }else {
          //console.log('i2c.read16: error name:[' + data.error.name + ']');
          reject(data.error);
        }

        window.WorkerOvserve.delete(`i2c.read.${transactionID}.${this.portNumber}.${this.slaveAddress}.${readRegistar}`);
      });
    });
  },

  /**
  * @param {chort} registerNumber
  * @param {chort} value
  * @example
  * // register number to write
  * var writeRegistar = 0x11;
  *
  * // the value to be written
  * var v = 0;
  *
  * writeValue();
  *
  * function writeValue(){
  * 	v = v ? 0 : 1;
  * 	slaveDevice.write8(writeRegistar, v).then(writeSuccess, I2CError);
  * }
  *
  * // the value successfully written
  * function writeSuccess(value) {
  *     console.log(slaveDevice.address + " : " + reg + " was set to " + value);
  *     window.setTimeout(writeValue, 1000);
  * }
  *
  * // Show an error
  * function I2CError(error) {
  *     console.log("Error: " + error.message + "(" + slaveDevice.address + ")");
  * }
  **/
  write8: function (registerNumber, value) {
    return new Promise((resolve, reject) => {

      var transactionID = this.getXid();

      window.WorkerOvserve.notify('i2c', {
        method: 'i2c.write',
        xid: transactionID,
        portNumber: this.portNumber,
        slaveAddress: this.slaveAddress,
        registerNumber: registerNumber,
        value: value,
        aIsOctet: true,
      });

      window.WorkerOvserve.observe(`i2c.write.${transactionID}.${this.portNumber}.${this.slaveAddress}.${registerNumber}`, (data) => {
        if (!data.error) {
          resolve(data.value);
        }else {
          //console.log('i2c.write8: error name:[' + data.error.name + ']');
          reject(data.error);
        }

        window.WorkerOvserve.delete(`i2c.write.${transactionID}.${this.portNumber}.${this.slaveAddress}.${registerNumber}`);
      });
    });
  },

  write16: function (registerNumber, value) {
    return new Promise((resolve, reject) => {

      var transactionID = this.getXid();

      window.WorkerOvserve.notify('i2c', {
        method: 'i2c.write',
        xid: transactionID,
        portNumber: this.portNumber,
        slaveAddress: this.slaveAddress,
        registerNumber: registerNumber,
        value: value,
        aIsOctet: false,
      });

      window.WorkerOvserve.observe(`i2c.write.${transactionID}.${this.portNumber}.${this.slaveAddress}.${registerNumber}`, (data) => {
        if (!data.error) {
          resolve(data.value);
        }else {
          //console.log('i2c.write16: error name:[' + data.error.name + ']');
          reject(data.error);
        }

        window.WorkerOvserve.delete(`i2c.write.${transactionID}.${this.portNumber}.${this.slaveAddress}.${registerNumber}`);
      });
    });
  },
};

/* istanbul ignore else */
if (!navigator.requestI2CAccess) {
  navigator.requestI2CAccess = function () {
    return Promise.resolve(new I2CAccess());
  };
}


/* istanbul ignore next */
if (window.Worker && window.WorkerOvserve) {
  var current = (function () {
    if (document.currentScript) {
      return document.currentScript.src;
    } else {
      var scripts = document.getElementsByTagName('script'),
      script = scripts[scripts.length - 1];
      if (script.src) {
        return script.src;
      }
    }
  })();

  var _worker = new Worker(`${current.substr(0, current.lastIndexOf('/'))}/worker.i2c.js`);

  // @MEMO gpioとi2cのObserverを分けた意味は「まだ」特にない
  window.WorkerOvserve.observe('i2c', function (jsonData) {
    var ab = json2ab(jsonData);
    _worker.postMessage(ab.buffer, [ab.buffer]);
  });

  _worker.onmessage = function (e) {
    var data = ab2json(e.data);
    window.WorkerOvserve.notify(data.method, data);
  };
}
//})()
var PortManager = {
  port_map: {},
  getPort: function(portType, portNumber) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var portName = portType + portNumber;
      var port = self.port_map[portName];
      if (port) {
        resolve(port);
      } else {
        navigator.requestI2CAccess().then(
          function(i2c) {
            //var port = i2c.open(portNumber);
            var port = i2c.ports.get(portNumber);
            self.port_map[portName] = port;
            resolve(port);
          }
        );
      }
    });
  }
}
var Utility = {
  sleep: function(ms, generator) {
    setTimeout(function(){
      try {
        generator.next();
      } catch (e) {
        if (! (e instanceof StopIteration)) throw e;
      }
    }, ms);
  }
}
var PCA9685Manager = {
  device_map: {},
  getPCA9685:function (port, address) {
    var self = this;
    return new Promise(function(resolve, reject) {
      var addressMap = self.device_map[port];
      if (addressMap) {
        var device = addressMap[address];
        if (device) {
          resolve(device);
          return;
        }
      } else {
        self.device_map[port] = {};
      }
      port.open(address).then((slave)=>{

      //port.setDeviceAddress(address);
      //port.open(address);
        var thread = (function* (){
          yield Utility.sleep(10, thread);
          slave.write8(0x00, 0x00);
          yield Utility.sleep(10, thread);
          slave.write8(0x01, 0x04);
          yield Utility.sleep(10, thread);
          slave.write8(0x00, 0x10);
          yield Utility.sleep(10, thread);
          slave.write8(0xfe, 0x64);
          yield Utility.sleep(10, thread);
          slave.write8(0x00, 0x00);
          yield Utility.sleep(10, thread);
          slave.write8(0x06, 0x00);
          yield Utility.sleep(10, thread);
          slave.write8(0x07, 0x00);
          yield Utility.sleep(300, thread);
          var device = new PCA9685(port, address);
          self.device_map[port][address] = device;
          resolve(device);
        })();
        thread.next();
      });
    });
  }
}

var PCA9685 = function(port, address) {
  this.port = port;
  this.address = address;
}

PCA9685.prototype = {
  tick_sec: 1 / 61 / 4096,
  pwm:function(pin, pulse) {
    var self = this;
    var port = this.port;
    var address = this.address;
    var portStart = 8;
    var portInterval = 4;
    var ticks = Math.round(pulse / this.tick_sec);
    var tickH = ((ticks >> 8) & 0x0f);
    var tickL = (ticks & 0xff);
    return new Promise(function(resolve, reject) {
      port.open(address).then((slave)=>{

        var thread = (function*() {
          //port.setDeviceAddress(address);
          //port.open(address);
          var pwmPort =  Math.round(portStart + pin * portInterval);
          slave.write8(pwmPort + 1, tickH);
          yield Utility.sleep(1, thread);
          slave.write8(pwmPort, tickL);
          resolve();
        })();
        thread.next();
      });
    });
  }
}
