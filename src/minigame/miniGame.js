const { screen, ipcMain, Notification, BrowserWindow } = require("electron");
const path = require('path');


const itemSize = {
  width: 85,
  height: 50,
  htmlSource: `file://${path.join(__dirname, "fish.html")}`
}

const bagSize = {
  width: 356,
  height: 300,
  htmlSource: `file://${path.join(__dirname, "bag.html")}`
}


class Item {

  constructor(bag, x, y) {
    this.itemWin = new BrowserWindow({
      x: x,
      y: y,
      width: itemSize.width,
      height: itemSize.height,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      skipTaskbar: true,
    });
    this.width = itemSize.width;
    this.height = itemSize.height;
    this.x = this.itemWin.getPosition()[0];
    this.y = this.itemWin.getPosition()[1];
    this.isDrag = false;
    this.itemWin.loadURL(itemSize.htmlSource);
    setInterval(() => {
      this.move();
    }, 50)

    this.itemWin.hookWindowMessage(Number.parseInt('0x0231'), (wParam,lParam)=>{
      console.log("moving");
      this.isDrag = true;
      bag.show()
    });
    this.itemWin.hookWindowMessage(Number.parseInt('0x0232'),(wParam,lParam)=>{
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
      this.itemWin.setPosition(this.x, this.y)
    }
    else if (length > 500) {
      this.x -= Math.round((diffX / length /2) * 5);
      this.y -= Math.round((diffY / length /2) * 5);
      this.itemWin.setPosition(this.x, this.y)
    }
    else if (length > 10) {
      this.x -= Math.round((diffX / length) * 10);
      this.y -= Math.round((diffY / length) * 10);
      this.itemWin.setPosition(this.x, this.y)
    }
    else {
      this.x -= Math.round((diffX / length) * 5);
      this.y -= Math.round((diffY / length) * 5);
      this.itemWin.setPosition(this.x, this.y)
    }
  }
}

class Bag {
  catchItems = [];

  constructor() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    this.bagWin = new BrowserWindow({
      x: width - bagSize.width - 10,
      y: height - bagSize.height - 10,
      width: bagSize.width,
      height: bagSize.height,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      show: false
    });
    this.bagWin.loadURL(bagSize.htmlSource);

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

function game() {
  const { screenWidth, screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const bag = new Bag();
  const items = [];

  (function loop() {
    const rand = (Math.floor(Math.random() * 3) + 8) * 600;
    console.log(rand)
    setTimeout(function() {
      SpawnItem(items, bag,Math.random() * (screenWidth / 100) + 150, Math.random() * (screenHeight / 100)  + 150);
      loop();
    }, rand);
  }());
}

function SpawnItem(items, bag, x, y) {
  items.push(new Item(bag, x, y));
}


function run() {
  console.log("Hey");
  game();
}

module.exports = { run }
