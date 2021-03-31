const { screen, ipcMain, Notification, BrowserWindow } = require("electron");
const path = require('path');

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

    this.itemWin.hookWindowMessage(Number.parseInt('0x0231'), (wParam,lParam) => {
      console.log("moving");
      this.isDrag = true;
      bag.show()
      this.itemWin.webContents.send('message', 'Hello second window!');
    });

    this.itemWin.hookWindowMessage(Number.parseInt('0x0232'),(wParam,lParam) => {
      console.log("finish move");
      this.x = this.itemWin.getPosition()[0];
      this.y = this.itemWin.getPosition()[1];
      this.isDrag = false;
      bag.hide()
    });
  }

  move() {
    if(this.isDrag) return;

    const cursorPos = screen.getCursorScreenPoint();

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
  static w = 400;
  static h = 400;

  constructor(bag, x, y) {
    let { width, height } = screen.getPrimaryDisplay().workAreaSize;
    //height *= 0.99;

    super(bag, 0, height - ItemWalking.h, ItemWalking.w, ItemWalking.h, `file://${path.join(__dirname, "fish_walking.html")}`);

    this.speed = 30;

    this.widthScreen = width;
    this.heightScreen = height;
  }

  move() {
    if(this.isDrag) return;

    // On est là
    // Ok so, je fait quoi ? le score ?
    // On termine ce qu'on doit faire et on part
    // ok, juste push (quand t'a fini :))

    if (this.x + ItemWalking.w < this.widthScreen &&
      this.y === this.heightScreen - ItemWalking.h) {
      this.x += this.speed;
    }

    this.itemWin.setPosition(this.x, this.y)
  }
}

class Bag {
  catchItems = [];

  constructor() {
    console.log("======= BAG =========")
    console.log("screen" + screen)
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    console.log("Width " + width)
    this.bagWin = new BrowserWindow({
      x: width - 356 - 10,
      y: height - 300 - 10,
      width: 356,
      height: 300,
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

  constructor() {
    new Bag()
    console.log("======= GAME =========")
    console.log("screen " + screen)
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const bag = new Bag();
    const items = [];
    (function loop() {
      const rand = randInt(3, 5) * 600;
      setTimeout(function() {
        SpawnItem(items, bag, randInt(0.1 * width , 0.9 * width), randInt(0.1 * height, 0.9 * height));
        loop();
      }, rand);
    }());
  }

}

function SpawnItem(items, bag, x, y) {

  items.push(new Item(bag, x, y));
  items.push(new ItemWalking(bag, 0, 0))
}

function run() {
  console.log("Hey");
  new Game();
}

module.exports = { run }
