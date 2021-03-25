const { app, BrowserWindow, Tray, screen, ipcMain, Notification } = require("electron");
const { autoUpdater } = require('electron-updater');
const os = require("os-utils");
const path = require("path");
const find = require('find-process');
const axios = require('axios');
const electron = require('electron');
const log = require('electron-log');
var http = require('http');

let CONFIG = require('./config.json');
let PASS = require('./pass.json')
let QUOTES = require('./quotes.json')

const isDev = require('electron-is-dev');
const iconDirPath = path.join(__dirname, 'images')

// Window default value
let mainWindow;
let msgWindow;
let tray = null

const panelSize = {
  width: 356,
  height: 500,
  visible: false
}
const messagePanelSize = {
  width: 356,
  height: 500,
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
      .catch((error) => { log.error(error) })
}, 60000 * 15);

// Notification
autoUpdater.on('update-available', (info) => {
  const myNotification = new Notification({
    title: "Nimby App",
    body: `NimbyApp ${info.version} available.\nThis update will be install automatically`
  });
  myNotification.show();
  log.info(`Update available : ${info.version}`)
});
// Install
autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  setTimeout(() => { autoUpdater.quitAndInstall(); }, 8000);
});
autoUpdater.on('error', (error) => {
  log.error(error)
});

/*
******************
 Nimby Management
******************
*/

let tsid = undefined;
let hnm = undefined;
let nimbyOn = false;
let nimbyAutoMode = true;
let autoInterval = null;
let notifyHighUsage = false;

function triggerAutoInterval(){
  autoInterval = setInterval(checkIfUsed, 60000);
}

// trigger on start
triggerAutoInterval()

// check for autoResetNimbyModeHours
setInterval(() => {
  checkForAutoResetNimbyMode();
}, 60000 * 60); // check all hours
// Check for no free slot
setInterval(() => {
  checkForNoFreeSlot();
}, 60000 * 5)
// Check running jobs
setInterval(() => {
  asJobRunning();
}, 60000)

axios.get('http://tractor/Tractor/monitor?q=login&user=root')
  .then(function (response) {
    tsid = response.data.tsid;
    log.info("Tractor tsid : " + tsid);
  })
  .catch(function (error) {
    log.error(error);
  })

function updateNimbyStatusFromAPI() {
  axios.get(`http://localhost:9005/blade/status`)
    .then(function (response) {
      hnm = response.data.hnm;
      nimbyOn = response.data.nimby !== "None"
      log.info(`update from api now you nimby is : ${nimbyOn ? "on" : "off"} `)
      updateTrayIcon()
    })
    .catch(function (error) {
      log.error(error);
      updateTrayIcon()
    })
}

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  console.log(req)
  res.write('Hello World!');
  res.end();
}).listen(9005);

function asJobRunning() {
  axios.get(`http://localhost:9005/blade/status`)
    .then(function (response) {
      hnm = response.data.hnm;
      jobData = response.data.pids
      console.log(jobData)
      if (jobData.length !== 0) {
        showMessage(`file://${path.join(__dirname, "jobRunningMessage.html")}`, false);
      }
    })
    .catch(function (error) {
      log.error(error);
    })
}

function checkIfUsed() {
  log.info("Check if the computer is used ...");
  // Always check if the pc is idle from 5 min
  if (electron.powerMonitor.getSystemIdleTime() < CONFIG.systemIdleTimeLimit){
    setNimbyOn().catch(()=>{})
  }
  // Check if we check the process (day) or only the resource (night)
  else if ((new Date().getHours() >= CONFIG.removeProcessCheckHours["start"])
      || (new Date().getHours() <= CONFIG.removeProcessCheckHours["end"])) {
    // Check CPU / RAM usage
    if (checkRamUsage() && checkCPUUsage()) {
      log.info("Your pc is not used, set nimby off")
      setNimbyOff().catch(()=>{})
    }
    else {
      if (!notifyHighUsage && (32 <= Math.round(os.totalmem() / Math.pow(1024, 1), 2))) {
        notifyHighUsage = true
        let message = "Your pc have high CPU or RAM usage !\nClose some useless software to be add in the render farm"
        const randomQuote = QUOTES.highUsage[Math.floor(Math.random() * QUOTES.highUsage.length)];
        const myNotification = new Notification({
          title: "Nimby App",
          body: message + '\n' + randomQuote
        });
        myNotification.on('click', (event, arg)=>{
          console.log('Notification clicked')
          showMessage(`file://${path.join(__dirname, "highUsageMessage.html")}`);
        })
        myNotification.show();
        log.info("Your pc have high CPU or RAM usage, it will not switch to nimby off")
      }
    }
  }
  else {
    if (msgWindow) { msgWindow.close(); msgWindow = null; }
    if (notifyHighUsage) { notifyHighUsage = false; }
    checkForProcess()
  }
  updateTrayIcon()
}

function checkCPUUsage() {
  os.cpuUsage((cpu) => {
    log.info("CPU : " + (cpu * 100))
    return ((cpu * 100) > 50)
  })
}

function checkRamUsage() {
  let maxRam = Math.round(os.totalmem() / Math.pow(1024, 1), 2)
  Object.keys(CONFIG.ramUsageLimits).forEach(rule => {
    if (maxRam > rule.split('-')[0] && maxRam <= rule.split('-')[1]) {
      let freeMemory = Math.round(os.freemem() / Math.pow(1024, 1), 2)
      if (freeMemory < CONFIG.ramUsageLimits[rule]) {
        return true
      }
    }
  })
  return false
}

function checkForProcess() {
  log.info("Check for Processes ...");
  let processFound = false;
  find("name", "", false)
  .then(list => {
    for (let i = 0; i < list.length; i++) {
      if (CONFIG.softwares.includes(path.parse(list[i].name).name)) {
        log.info(`Ho, you running ${path.parse(list[i].name).name}.`);
        processFound = true;
        break;
      }
    }
  })
  .finally(() => {
    log.info("process " + processFound)
    if (nimbyOn === false && processFound === true) {
      log.info("We going to turn nimby ON")
      setNimbyOn().catch(()=>{})
    }
    if (nimbyOn === true && processFound === false) {
      log.info("We going to turn nimby OFF")
      setNimbyOff().catch(()=>{})
    }
  });
}

function checkForNoFreeSlot() {
  log.info("Check for No Free Slot ...");
  // Check if we are in no free slots (1)
  axios.get(`http://tractor/Tractor/monitor?q=bdetails&b=${hnm}`)
    .then(function (response) {
      if (response.data.note === "no free slots (1)" && response.data.as === 1) {
        // For each process in config kill it
        CONFIG.no_free_slot_process.forEach(processToKill => {
          log.info(`Trying to kill : ${processToKill}`)
          axios.post(`http://localhost:80/kill`, {"name": processToKill, "pass": PASS.pass})
            .then((response) => {
              log.info(response.data);
            })
            .catch((error) => {
              log.info(error);
            })
        })
      }
    })
    .catch(function (error) {
      log.info(error);
    });
}

function updateTrayIcon() {
  // Update Tray icon
  if (!tray) return;

  const _img = nimbyOn ? path.join(iconDirPath, "artfx_green.png") : path.join(iconDirPath, "artfx_red.png")
  tray.setImage(_img)

  // update from web app
  if(!mainWindow) return
  mainWindow.webContents.send('nimby_status', { nimby: nimbyOn })
}

function checkForAutoResetNimbyMode() {
  if (nimbyAutoMode) return; // useless is already in auto

  if (new Date().getHours() === CONFIG.autoResetNimbyModeHours) { // trigger at 18H
    setNimbyModeToAuto()
  }
}

async function setNimbyOn() {
  return axios.get(`http://localhost:9005/blade/ctrl?nimby=1`)
    .then(function () {
      log.info("Nimby set ON");
      updateNimbyStatusFromAPI()
      if (hnm && tsid) {
        axios.get(`http://tractor/Tractor/queue?q=ejectall&blade=${hnm}&tsid=${tsid}`)
          .then(function () {
            log.info("Current jobs ejected");
          })
      }
    })
    .catch(function (error) {
      log.error("Error setting nimby ON");
    })
}

async function setNimbyOff() {
  return axios.get(`http://localhost:9005/blade/ctrl?nimby=0`)
    .then(function () {
      log.info("Nimby set OFF");
      updateNimbyStatusFromAPI()
    })
    .catch(function (error) {
      log.error("Error setting nimby OFF");
    })
}

function setNimbyModeToAuto() {
  console.log("setNimbyModeToAuto")
  nimbyAutoMode = true;
  checkIfUsed();
  triggerAutoInterval();
  mainWindow.webContents.send('mode_status', { autoMod: nimbyAutoMode });
}

function setNimbyModeToManual() {
  console.log("setNimbyModeToManual")
  nimbyAutoMode = false;
  clearInterval(autoInterval)
  mainWindow.webContents.send('mode_status', { autoMod: nimbyAutoMode });
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
    //isDev ? "http://localhost:3000/" : `file://${path.join(__dirname, "../build/panel.html")}`
    isDev ? `file://${path.join(__dirname, "panel.html")}` : `file://${path.join(__dirname, "panel.html")}`
  );
  // Event
  mainWindow.on("closed", () => (mainWindow = null));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  });
  mainWindow.on("blur", () => {
    showPanel(false)
  });
}

function createTray() {
  if (tray != null) return false;
  tray = new Tray(path.join(iconDirPath, "artfx.png"))

  tray.setToolTip("Nimby" + (isDev ? "(Dev)" : ""))
  tray.on("click", () => toggleTray())
  tray.on("right-click", () => toggleTray())

  updateNimbyStatusFromAPI()
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

function showMessage(link, frame=false, transparent=false) {
  msgWindow = new BrowserWindow({
    width: 100,
    height: 100,
    transparent: transparent,
    frame: frame,
    alwaysOnTop: true,
    resizable: frame,
    maximizable: frame,
    minimizable: frame,

    webPreferences: { nodeIntegration: true }
  });
  msgWindow.loadURL(link);
}

app.on("ready", () => {
  log.info("========= Hello =========")
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((error) => { log.error(error) })
  }
  createTray()
  createPanel()
  showMessage(`file://${path.join(__dirname, "fish.html")}`, false, true)


});



app.setLoginItemSettings({
  "openAtLogin": true,
});

app.on('quit', () => {
  try {
    log.info("========= Good Bye ! =========")
    tray.destroy()
  } catch (e) { }
});

ipcMain.on('app_version', (event) => {
  event.sender.send('app_version', { version: app.getVersion() });
});

ipcMain.on('on_switch_nimby_mod', (event, isAuto) => {
  if (isAuto) { setNimbyModeToManual() }
  else { setNimbyModeToAuto() }
})

ipcMain.on('on_switch_nimby', (event, isNimby) => {
  if (isNimby) { setNimbyOn().catch(() => {}) }
  else { setNimbyOff().catch(() => {}) }
})

ipcMain.on('get_nimby_status', (event) => {
  event.sender.send('nimby_status', { nimby: nimbyOn })
})

ipcMain.on('see_logs', () => {
  showMessage("file://C:/Users/etudiant/AppData/Roaming/nimby-app/logs/main.log", true)
})

/*
Message box
 */
ipcMain.on('msg_quote', (event) => {
  const randomQuote = QUOTES.highUsage[Math.floor(Math.random() * QUOTES.highUsage.length)];
  event.sender.send('msg_quote', randomQuote);
});

ipcMain.on('msg_close', (event) => {
  console.log("Close msg")
  msgWindow.close()
  msgWindow = null
});

/*
Fish game
 */

ipcMain.on('fish_clicked', () => {
  console.log("fish click");
  const myNotification = new Notification({
    "title": "Ye you catch a fish"
  });
  myNotification.show();
  msgWindow.close();
})

ipcMain.on('fish_drag', () => {
  console.log("Dragggg")
  fish_drag = true;
})
ipcMain.on('fish_stop_drag', () => {
  fish_drag = false;
})
