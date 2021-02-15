const { app, BrowserWindow, Tray, screen, ipcMain, Notification, webContents } = require("electron");
const { autoUpdater } = require('electron-updater');
const path = require("path");
const find = require('find-process');
const axios = require('axios');

var CONFIG = require('./config.json');
var PASS = require('./pass.json')

const isDev = require('electron-is-dev');
const iconDirPath = path.join(__dirname, 'images')

// Window default value
let mainWindow;
let tray = null

const panelSize = {
  width: 356,
  height: 500,
  visible: false
}

/*
******************
Update Management
******************
*/
if (isDev) {  // Use dummy repo for test
  autoUpdater.updateConfigPath = path.join(path.dirname(__dirname), 'dev-app-update.yml');
}
// Update check 15 min
setInterval(() => {
  autoUpdater.checkForUpdates()
}, 60000 * 15);

// Notification
autoUpdater.on('update-available', (info) => {
  const myNotification = new Notification({
    title: "Nimby App",
    body: `NimbyApp ${info.version} available.\nThis update will be install automatically`
  });
  myNotification.show();
});
// Install
autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  setTimeout(() => { autoUpdater.quitAndInstall(); }, 8000);
});
autoUpdater.on('error', (error) => {
  console.log(error)
});

/*
******************
 Nimby Management
******************
*/

var tsid = undefined;
var hnm = undefined;
var nimbyOn = false;
var nimbyAutoMode = true;
var checkForProcessEvent = null;

function triggerCheckForProcessEvent(){
  checkForProcessEvent = setInterval(checkForProcess, 60000);
}

// trigger on start
triggerCheckForProcessEvent()

// check for autoResetNimbyModeHours
setInterval(() => {
  checkForAutoResetNimbyMode();
}, 60000 * 60); // check all hours
// Check for no free slot
setInterval(() => {
  checkForNoFreeSlot();
}, 60000 * 5)

axios.get('http://tractor/Tractor/monitor?q=login&user=root')
  .then(function (response) {
    tsid = response.data.tsid;
    console.log("Tractor tsid : " + tsid);
  })
  .catch(function (error) {
    console.log(error);
    console.log("-------------------- ERROR ----------------------------");
  })


updateNimbyStatusFromAPI()
.then(()=>{})
.catch(()=>{})

function updateNimbyStatusFromAPI() {
  return new Promise((reject, resolve) => {
    axios.get(`http://localhost:9005/blade/status`)
      .then(function (response) {
        hnm = response.data.hnm;
        nimbyOn = response.data.nimby === "None" ? false : true
        console.log(`update from api now you nimby is : ${nimbyOn ? "on" : "off"} `)
        updateTrayIcon()
        resolve()
      })
      .catch(function (error) {
        console.log(error);
        console.log("-------------------- ERROR ----------------------------");
        updateTrayIcon()
        reject()
      })
  })
}


function checkForProcess() {
  console.log("Check for Processes ...");
  let processFound = false;
  find("name", "", false)
    .then(list => {
      for (var i = 0; i < list.length; i++) {
        if (CONFIG.softwares.includes(path.parse(list[i].name).name)) {
          console.log(`Ho, you running ${path.parse(list[i].name).name}.`);
          processFound = true;
          break;
        }
      }
    })
    .finally(() => {
      console.log("process " + processFound)
      if (nimbyOn === false && processFound === true) {
        console.log("We going to turn nimby ON")
        setNimbyOn()
        .catch(()=>{})
      }
      if (nimbyOn === true && processFound === false) {
        console.log("We going to turn nimby OFF")
        setNimbyOff()
        .catch(()=>{})
      }
      updateTrayIcon()
    });
}

async function checkForNoFreeSlot() {
  console.log("Check for No Free Slot ...");
  // Check if we are in no free slots (1)
  axios.get(`http://tractor/Tractor/monitor?q=bdetails&b=${hnm}`)
    .then(function (response) {
      if (response.data.note == "no free slots (1)" && response.data.as == 1) {
        // For each process in config kill it
        CONFIG.no_free_slot_process.forEach(processToKill => {
          console.log(`Trying to kill : ${processToKill}`)
          axios.post(`http://localhost:80/kill`, {"name": processToKill, "pass": PASS.pass})
            .then((response) => {
              console.log(response.data);
            })
            .catch((error) => {
              console.log(error);
            })
        })
      }
    })
    .catch(function (error) {
      console.log(error);
    });
}

function updateTrayIcon() {
  // Update Tray icon
  console.log(nimbyOn)
  if (!tray) return;

  const _img = nimbyOn ? path.join(iconDirPath, "artfx_green.png") : path.join(iconDirPath, "artfx_red.png")
  tray.setImage(_img)

  // update from web app
  if(!mainWindow) return
  mainWindow.webContents.send('nimby_status', { nimby: nimbyOn, autoMod: nimbyAutoMode })
}

function checkForAutoResetNimbyMode() {
  if (nimbyAutoMode) return; // useless is already in auto

  if (new Date().getHours() == CONFIG.autoResetNimbyModeHours) { // trigger at 18H
    setNimbyModeToAuto()
  }

}

async function setNimbyOn() {
  return new Promise((reject, resolve) => {
    axios.get(`http://localhost:9005/blade/ctrl?nimby=1`)
      .then(function () {
        console.log("Nimby set ON");
        updateNimbyStatusFromAPI().then(()=>{resolve()})
        .catch(()=>{resolve()})
        if (hnm && tsid) {
          axios.get(`http://tractor/Tractor/queue?q=ejectall&blade=${hnm}&tsid=${tsid}`)
            .then(function () {
              console.log("Current jobs ejected");
            })
        }
      })
      .catch(function (error) {
        console.log("-------------------- ERROR ----------------------------");
        console.log("Error setting nimby ON");
        resolve()
      })
  })
}

function setNimbyOff() {
  return new Promise((reject, resolve) => {
    axios.get(`http://localhost:9005/blade/ctrl?nimby=0`)
      .then(function () {
        console.log("Nimby set OFF");
        updateNimbyStatusFromAPI().catch(()=>{})
        resolve()
      })
      .catch(function (error) {
        console.log("-------------------- ERROR ----------------------------");
        console.log("Error setting nimby OFF");
        resolve()
      })
  })
}

function setNimbyModeToAuto() {
  nimbyAutoMode = true
  checkForProcess()
  triggerCheckForProcessEvent()
}

function setNimbyModeToManual() {
  nimbyAutoMode = false
  setNimbyOn()
   .catch(()=>{})
  clearInterval(checkForProcessEvent)
}

/*
******************
 Tray and panel
******************
*/
function createPanel() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  mainWindow = new BrowserWindow({
    width: panelSize.width,
    height: panelSize.height,
    x: width - panelSize.width - 10,
    y: height - panelSize.height - 10,
    frame: false,
    show: false,
    opacity: 0,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    type: "toolbar",
    maximizable: false,
    minimizable: false,
    webPreferences: { nodeIntegration: true }
  });

  mainWindow.loadURL(
    // 
    //isDev ? "http://localhost:3000/" : `file://${path.join(__dirname, "../build/index.html")}`
    isDev ? `file://${path.join(__dirname, "index.html")}` : `file://${path.join(__dirname, "index.html")}`
  );
  // Event
  mainWindow.on("closed", () => (mainWindow = null));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  });
  mainWindow.on("blur", () => {
    if (isDev == true) return
    showPanel(false)
  });
}

function createTray() {
  if (tray != null) return false;
  tray = new Tray(path.join(iconDirPath, "artfx.png"))

  tray.setToolTip("Nimby" + (isDev ? "(Dev)" : ""))
  tray.on("click", () => toggleTray())
  tray.on("right-click", () => toggleTray())
}

const toggleTray = async () => {
  if (mainWindow == null) {
    createPanel(true)
    return false
  }
  if (mainWindow) {
    showPanel(true)
    mainWindow.focus()
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSkipTaskbar(true)
  }
}

function showPanel(show = true) {
  if (show) {
    mainWindow.setOpacity(1)
    panelSize.visible = true
  } else {
    mainWindow.setOpacity(0)
    panelSize.visible = false
  }
}

app.on("ready", () => {
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }
  createTray()
  createPanel()
});

app.setLoginItemSettings({
  openAtLogin: true,
});

app.on('quit', () => {
  try {
    tray.destroy()
  } catch (e) { }
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('on_switch_nimby_mod', (event) => {
  if (nimbyAutoMode) {
    setNimbyModeToManual()
    event.sender.send('nimby_status', { nimby: nimbyOn, autoMod: nimbyAutoMode })
  }
  else{
    setNimbyModeToAuto()
    event.sender.send('nimby_status', { nimby: nimbyOn, autoMod: nimbyAutoMode })
  }
})

ipcMain.on('get_nimby_status', (event) => {
  event.sender.send('nimby_status', { nimby: nimbyOn, autoMod: nimbyAutoMode })
})
