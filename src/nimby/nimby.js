/*
=================================
 This app create a tray icon and
   a panel when tray is click.
        Use src/message
=================================
 */
const { app, BrowserWindow, Tray, screen, ipcMain } = require("electron");
const os = require("os-utils");
const path = require("path");
const find = require('find-process');
const axios = require('axios');
const electron = require('electron');
const log = require('electron-log');
const minigame = require('../minigame/miniGame')

const { messageJob, closeMessage, messageLogs } = require('../message/message')

let CONFIG = require('../config/config.json');

const isDev = require('electron-is-dev');
const iconDirPath = path.join(path.dirname(__dirname), 'images')

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
 Nimby Management
******************
*/

let tsid = undefined;
let hnm = undefined;
let nimbyOn = false;
let nimbyAutoMode = true;
let autoInterval = null;
let notifyHighUsage = false;
let runningJobs = [];
let isEvent = false;

function triggerAutoInterval() {
  autoInterval = setInterval(checkIfUsed, 60000);
}

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

function checkJob() {
 return axios.get(`http://localhost:9005/blade/status`)
  .then(function (response) {
    const jobs = [];
    response.data.pids.forEach((data) => {
      const taskId = data.jid + '.' + data.tid
      jobs.push(taskId)
    })
    // remove finish jobs
    runningJobs.forEach(key => {
      if(jobs.indexOf(key) === -1) {
        const index = runningJobs.indexOf(key);
        if (index > -1) {
          runningJobs.splice(index, 1);
          closeMessage(key)
          log.info(`Job : ${key} as stop running`)
        }
      }
    })
    if(jobs.length > 0) {
      // Add job in cache and show message
      jobs.forEach(job => {
        if (runningJobs.indexOf(job) === -1) {
          runningJobs.push(job);
          messageJob(job).then((response) => {
            if (response === 'kill') {
              log.info("You chose to kill the job and set nimby on")
              setNimbyOn().catch(()=>{})
            }
          })
        }
        log.info(`The job number : ${job} is running`)
      })
    }
    return 0;
  })
  .catch(function (error) {
    log.error("Error getting running jobs : \n" + error);
    return -1;
  })
}

function checkIfUsed() {
  log.info("Check if the computer is used ...");
  // Check if running job
  checkJob()
    .then(() => {
      // If a job is running, message will be show (checkJob)
      if(runningJobs.length === 0) {
        // Check if we check the process (day) or only the resource (night)
        if ((new Date().getHours() >= CONFIG.removeProcessCheckHours["start"])
            || (new Date().getHours() <= CONFIG.removeProcessCheckHours["end"])) {
          // NIGHT MODE
          checkActionUsage()
          if (electron.powerMonitor.getSystemIdleTime() < CONFIG.systemIdleTimeLimit) {
            setNimbyOn().catch(() => {})
          }
          else {
            checkCPUUsage().then((response) => {
              if (response) {
                log.info("Your pc is not used, set nimby OFF")
                setNimbyOff().catch(() => {})
              } else {
                // TODO else display message
                log.info("Your have height cpu usage, let nimby ON")
              }
            })
          }
          /*// Check CPU / (RAM usage  checkRamUsage())
          checkCPUUsage().then((response) => {
            if (response) {
              log.info("Your pc is not used, set nimby OFF")
              setNimbyOff().catch(()=>{})
            }
            else {
              // TODO else display message
              log.info("Your have height cpu usage, let nimby ON")
            }
          })*/
        }
        else {
          // DAY MODE
          if (electron.powerMonitor.getSystemIdleTime() < CONFIG.systemIdleTimeLimit) {
            setNimbyOn().catch(()=>{})
          }
          else {
            checkForProcess()
          }
        }
      }
    })
    .catch((error) => {
      log.error(error)
    })

  updateTrayIcon()
}

function checkActionUsage() {
  if (electron.powerMonitor.getSystemIdleTime() < CONFIG.systemIdleTimeLimit) {
    setNimbyOn().catch(()=>{})
    return 1
  }
  return 0
}

async function checkCPUUsage() {
  return new Promise( (resolve) => {
    os.cpuUsage((cpu) => {
      log.info("CPU : " + Math.round(cpu * 100) + "%")
      resolve(Math.round(cpu * 100) < 50)
    });
  })
}

/*function checkRamUsage() {
  let maxRam = Math.round(os.totalmem() / Math.pow(1024, 1))
  console.log('RAM : ' + maxRam)
  Object.keys(CONFIG.ramUsageLimits).forEach(rule => {
    if (maxRam > rule.split('-')[0] && maxRam <= rule.split('-')[1]) {
      let freeMemory = Math.round(os.freemem() / Math.pow(1024, 1))
      log.info("RAM FREE : " + freeMemory)
      if (freeMemory < CONFIG.ramUsageLimits[rule]) {
        return true
      }
    }
  })
  return false
}*/

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

function updateTrayIcon() {
  // Update Tray icon
  if (!tray) return;

  const _img = nimbyOn ? path.join(iconDirPath, "nimby_green.png") : path.join(iconDirPath, "nimby_red.png")
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
    //isDev ? "http://localhost:3000/" : `file://${path.join(__dirname, "../build/index.html")}`
    isDev ? `file://${path.join(__dirname, "nimby.html")}` : `file://${path.join(__dirname, "nimby.html")}`
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
  tray = new Tray(path.join(iconDirPath, "nimby.png"))

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

function run() {
  return axios.get('http://tractor/Tractor/monitor?q=login&user=root')
    .then(function (response) {
      tsid = response.data.tsid;
      log.info("Tractor tsid : " + tsid);

      // trigger on start
      triggerAutoInterval()
      // check for autoResetNimbyModeHours
      setInterval(() => {
        checkForAutoResetNimbyMode();
      }, 60000 * 60); // check all hours

      createTray()
      createPanel()
      return 0;
    })
    .catch(function (error) {
      log.error(error)
      return -1;
    })
}

function nimbyEvent(event) {
  mainWindow.webContents.send("event", event)
  isEvent = event
}

app.on('quit', () => {
  try {
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
  messageLogs("C:/Users/etudiant/AppData/Roaming/nimby-app/logs/main.log")
})

ipcMain.on('event_toggle', (e, isEvent) => {
  console.log("isEvent : " + isEvent)
  if (!isEvent) {
    minigame.stop();
  }
})
ipcMain.on('isEvent', (event) => {
  event.sender.send('event', isEvent);
});

module.exports = { run, nimbyEvent };
