const { screen, ipcMain, Notification, BrowserWindow } = require("electron");
const path = require('path');


const spawnItem = {
  width: 356,
  height: 500,
  htmlSource: `file://${path.join(__dirname, "fish.html")}`
}

const bagItem = {
  x: 0,
  y: 0,
  width: 356,
  height: 500
}


class Item extends BrowserWindow {

  constructor(x, y) {
    super({
      x: x,
      y: y,
      width: spawnItem.width,
      height: spawnItem.height,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false
    });
    // this.width = spawnItem.width;
    // this.height = spawnItem.height;
    // this.x = x;
    // this.y = y;
    this.isDrag = false;
    setInterval(() => {
      this.move();
    }, 50)

    this.hookWindowMessage(Number.parseInt('0x0231'), (wParam,lParam)=>{
      console.log("moving");
      fish_drag = true;
    });
    this.hookWindowMessage(Number.parseInt('0x0232'),(wParam,lParam)=>{
      console.log("finish move");
      // x = this.getPosition()[0];
      // y = this.getPosition()[1];
      fish_drag = false;
    });
  }

  move() {
    if(this.isDrag) return;
    const cursorPos = screen.getCursorScreenPoint();
    let diffX = (cursorPos.x + this.width / 2) - this.x;
    let diffY = (cursorPos.y + this.height / 2) - this.y;
    this.x += Math.round(diffX * 10);
    this.y += Math.round(diffY * 10);
    // this.setPosition(this.x, this.y)
  }
}

class Bag extends BrowserWindow {

  constructor() {
    const { screenWidth, screenHeight } = screen.getPrimaryDisplay().workAreaSize
    super({
      x: bagItem.x,
      y: bagItem.y,
      width: screenWidth - bagItem.width - 10,
      height: screenHeight - bagItem.height - 10,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      visible: false
    });
    this.items = []
  }

  spawnItem(x, y) {
    this.items.add(Item(x, y));
  }

}

class miniGame {
  constructor() {
    Bag()
  }
}

/*
this.once('ready-to-show', () => {
  win.show()
});
*/