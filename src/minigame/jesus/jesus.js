const { app, screen, ipcMain } = require("electron");
const { MongoClient } = require('mongodb');
const { BrowserWindow } = require("electron-acrylic-window");
const log = require('electron-log');
const os = require("os");
const path = require('path');
const pass = require('../../config/pass.json')

let hostname = os.hostname();
let score = 0
let jesusWin = null
let infoWin = null
let db = null
let dbo = null
const uri = `mongodb+srv://${pass.user}:${pass.pass}@clusterpipeline.9dngv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


function runGame() {
  if (jesusWin) {
    jesusWin.close()
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const vibrancyOp = {
    theme: 'dark',
    effect: 'blur',
    disableOnBlur: false,
  }

  jesusWin = new BrowserWindow({
    x: 0,
    y: height / 2 - 100,
    width: width,
    height: 200,
    fullscreen: false,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: false,
    webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
		},
		vibrancy: vibrancyOp,
  });
  jesusWin.loadURL(`file://${path.join(__dirname, "jesusGame.html")}`);

  jesusWin.webContents.once('dom-ready', () => {
    jesusWin.webContents.send("screenWidth", width)
    jesusWin.webContents.send("score", score)
    getTopScore().then((result) => {
      jesusWin.webContents.send("top_score", result)
    });
  });

  ipcMain.on('score', (e, _score) => {
    if (_score > score) {
       score = _score
      log.info("New high score : " + score)
      dbo.collection("minigame").update({hostname: hostname}, {$set: {jesusScore: _score}}, (err, res) => {
        if (err) log.error(err);
        log.info("Updated !!")
      })
    }
  })
  ipcMain.on("close", (e) => {
    if (jesusWin) {
      jesusWin.close()
      jesusWin = null
    }
  })
}

async function getTopScore() {
  let score_list = {}
  return new Promise((resolve => {
    dbo.collection("minigame").find().sort({"jesusScore": -1}).toArray(function(err, result) {
      if (err) throw err;
      result.forEach((obj, i) => {
        score_list[i] = obj
      })
      resolve(score_list)
    })
  }))
}

function run() {
  log.info("Launch jesus game")
  // default window
  infoWin = new BrowserWindow({
    center: true,
    width: 900,
    height: 600,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: true,
			contextIsolation: false,
		}
  });
  infoWin.loadURL(`file://${path.join(__dirname, "info.html")}`);


  client.connect((err, db) => {
    if (err) log.error(err);
    dbo = db.db("minigame");
    dbo.collection("minigame").findOne({hostname: hostname}, (err, result) => {
      if (err) log.error(err);
      if (!result) {
        dbo.collection("minigame").save({hostname: hostname, jesusScore: 0})
      }
      else {
        score = result.jesusScore
      }
    })
    // runGame()
  })
  ipcMain.on("close-info", (e) => {
    if (infoWin) {
      infoWin.close()
      infoWin = null
    }
  })
}

function stop() {
  if (infoWin) {
    infoWin.close()
  }
  if(jesusWin) {
    jesusWin.close()
    jesusWin = null
  }
  client.close();
}

module.exports = { run, stop, runGame }
