const { screen, ipcMain, Notification, BrowserWindow } = require("electron");
const path = require('path');
const axios = require("axios");
const os = require('os');

class Item {

  constructor(bag, x, y, width=85, height=50, html=`file://${path.join(__dirname, "fish.html")}`) {
    this.itemWin = new BrowserWindow({
      x: x,
      y: y,
      width: width,
      height: height,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
      webPreferences: { nodeIntegration: true }
    });
    this.itemWin.loadURL(html);
    this.x = this.itemWin.getPosition()[0];
    this.y = this.itemWin.getPosition()[1];
    this.width = width;

    this.height = height;
    this.isDrag = false;

    setInterval(() => {
      this.move();
    }, 50)

    this.itemWin.webContents.once('dom-ready', () => {
      this.itemWin.webContents.send('sound', 'spawn');
    });

    this.itemWin.hookWindowMessage(Number.parseInt('0x0231'), (wParam,lParam) => {
      console.log("moving");
      this.isDrag = true;
      bag.show()
      this.itemWin.webContents.send('sound', 'drag');
    });

    this.itemWin.hookWindowMessage(Number.parseInt('0x0232'),(wParam,lParam) => {
      console.log("finish move");
      this.x = this.itemWin.getPosition()[0];
      this.y = this.itemWin.getPosition()[1];
      if (this.x + this.width / 2 >= bag.bagWin.getPosition()[0] && this.y + this.height / 2 >= bag.bagWin.getPosition()[1]
      && this.x + this.width / 2 <= bag.bagWin.getPosition()[0] + bag.width && this.y + this.height / 2 <= bag.bagWin.getPosition()[1] + bag.height) {
        console.log("CHAMPION")
        this.itemWin.webContents.send('sound', 'bag');
        axios.post(`http://192.168.2.123:5000/game/score/${os.hostname()}?points=${1}`)
          .then((e) => {
            console.log(e)
          })
          .catch((err) => {
            console.log(err)
          })
      }
      else {
        this.itemWin.webContents.send('sound-stop')
      }
      this.isDrag = false;
      bag.hide()
    });
  }

  move() {
    if(this.isDrag) return;

    const cursorPos = screen.getCursorScreenPoint();
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    if (this.x < 0 - this.width || this.x > width
      || this.y < 0 - this.height || this.y < height) {
      if (this.itemWin){
        this.itemWin.close();
      }
      return;
    }

    let diffX = (cursorPos.x - this.width / 2) - this.x;
    let diffY = (cursorPos.y - this.height / 2) - this.y;

    const length = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));

    if (length > 600) {
      this.x += Math.round((diffX / length) * 5);
      this.y += Math.round((diffY / length) * 5);
    }
    else if (length > 500) {
      this.x -= Math.round((diffX / length /2) * 5);
      this.y -= Math.round((diffY / length /2) * 5);
    }
    else if (length > 10) {
      this.x -= Math.round((diffX / length) * 10);
      this.y -= Math.round((diffY / length) * 10);
    }
    else {
      this.x -= Math.round((diffX / length) * 5);
      this.y -= Math.round((diffY / length) * 5);
    }

    this.itemWin.setPosition(this.x, this.y)
  }
}

class ItemWalking extends Item {
  static w = 500;
  static h = 500 * 0.9;

  constructor(bag, x, y) {
    let { width, height } = screen.getPrimaryDisplay().workAreaSize;

    super(bag, 0, height - ItemWalking.h, ItemWalking.w, ItemWalking.h * 1.1, `file://${path.join(__dirname, "fish_walking.html")}`);

    this.speed = 30;
    this.timout = 2 * 60000;

    this.widthScreen = width;
    this.heightScreen = height;
  }

  move() {
    if(this.isDrag) return;

    // Horizontal bas
    if (this.x + ItemWalking.w < this.widthScreen &&
      this.y >= this.heightScreen - ItemWalking.h) {
      this.x += this.speed;
      this.itemWin.webContents.send("rotation", 0)
    }
    // vertical droit
    else if (this.x + ItemWalking.w >= this.widthScreen && this.y >= 0) {
      this.y -= this.speed;
      this.itemWin.webContents.send("rotation", -90)
    }
    // Horizontal haut
    else if (this.x >= 0 && this.y <= 0) {
      this.x -= this.speed;
      this.itemWin.webContents.send("rotation", -180)
    }
    // vertical gauche
    else if (this.x <= 0 && this.y <= this.heightScreen - ItemWalking.h) {
      this.y += this.speed;
      this.itemWin.webContents.send("rotation", -270)
    }

    this.itemWin.setPosition(this.x, this.y)
  }
}

class Bag {
  catchItems = [];

  constructor() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    this.width = 356
    this.height = 300
    this.bagWin = new BrowserWindow({
      x: width - this.width - 10,
      y: height - this.height - 10,
      width: this.width,
      height: this.height,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      show: false
    });
    this.bagWin.loadURL(`file://${path.join(__dirname, "bag.html")}`);

    this.catchItems = []

  }

  catchItem(item) {
    this.catchItems.push(item)
  }

  show() {
    this.bagWin.show()
  }

  hide() {
    this.bagWin.hide()
  }

}

function randInt(a, b) {
  return Math.floor(Math.random() * (b - a)) + a
}

class Game {
  static maxItems = 5;

  constructor() {
    this.bag = new Bag()
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const bag = new Bag();
    const items = [];
    (function loop() {
      const rand = randInt(3, 5) * 6000;
      setTimeout(function() {
        if (Bag.maxItems > items.length) {
          const item = new Item(bag, randInt(0.1 * width , 0.9 * width), randInt(0.1 * height, 0.9 * height))
          SpawnItem(items, bag, item);
          loop();
        }
      }, rand);
    }());
    (function loopWalk() {
      const rand = randInt(5, 10) * 6000;
      setTimeout(function() {
        if (Bag.maxItems > items.length) {
          const item = new ItemWalking(bag, randInt(0.1 * width , 0.9 * width), randInt(0.1 * height, 0.9 * height))
          SpawnItem(items, bag, item);
          loopWalk();
        }
      }, rand);
    }());
  }
}

function SpawnItem(items, item) {
  items.push(item);
}

let game = null

function run() {
  if (game) {
    Bag.maxItems = 5
  }
  else {
    game = new Game();
  }
}

function stop() {
  Bag.maxItems = 0
}

module.exports = { run, stop }
