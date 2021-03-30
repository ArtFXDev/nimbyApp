const { BrowserWindow, ipcMain, remote } = require("electron");
const path = require("path");
let QUOTES = require('../config/quotes.json')

const messages = {}

async function messageJob(taskId) {
  return new Promise((resolve, reject) => {
    let msgBox = new BrowserWindow({
      width: 500,
      height: 350,
      center: true,
      frame: false,
      resizable: false,
      movable: true,
      title: "Nimby",
      alwaysOnTop: true,
      webPreferences: { nodeIntegration: true }
    })
    msgBox.loadURL(`file://${path.join(__dirname, "jobRunning.html")}`);
    // msgBox.webContents.send('taskIdReply', taskId);
    messages[taskId] = msgBox;
    const randomQuote = QUOTES.highUsage[Math.floor(Math.random() * QUOTES.highUsage.length)];
    ipcMain.on('msg_close', (event, taskId) => {
      resolve('close')
      closeMessage(taskId)
    });
    ipcMain.on('msg_killJob', (event, taskId) => {
      resolve('kill')
      closeMessage(taskId)
    });
    ipcMain.on('taskId', (event) => {
      event.reply('taskId', taskId)
    });
    ipcMain.on('msg_quote', (event) => {
      event.reply('msg_quote', randomQuote)
    });
  })
}

function closeMessage(taskId) {
  if(taskId in messages) {
    messages[taskId].close()
    delete messages[taskId]
  }
  else {
    return -1
  }
}

/*function messageHighUsage() {
  const randomQuote = QUOTES.highUsage[Math.floor(Math.random() * QUOTES.highUsage.length)];
  const msgText = "You currently have Height CPU or RAM usage.\n" +
    "Close app to pass on the farm\n" + randomQuote

  return dialog.showMessageBox({
    message: msgText,
    title: "Nimby",
    icon: path.join(path.dirname(__dirname), 'app.ico')
  });
}*/

function messageLogs(logPath) {
  const msgBox = new BrowserWindow({
    width: 500,
    height: 350,
    center: true,
    frame: true,
    resizable: true,
    movable: true,
    title: "Nimby",
    alwaysOnTop: false,
    autoHideMenuBar: true,
    titleBarStyle: "Caché",
  })
  msgBox.loadURL(`file://${logPath}`)
}

module.exports = { messageJob, closeMessage, messageLogs };
