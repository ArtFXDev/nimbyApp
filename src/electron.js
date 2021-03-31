/*
=====================================================
    This is my main process, here I call my app
    and I check updates
=====================================================
 */
const { app, Notification } = require("electron");
const { autoUpdater } = require('electron-updater');
const exec = require('child_process').execFile;
const path = require("path");
const fs = require('fs')
const log = require('electron-log');
const isDev = require('electron-is-dev');
const schedule = require('node-schedule');

const nimby = require('./nimby/nimby');
const miniGame = require('./minigame/miniGame');
let CONFIG = require('./config/config.json');

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
autoUpdater.on('update-downloaded', () => {
  setTimeout(() => { autoUpdater.quitAndInstall(); }, 8000);
});
autoUpdater.on('error', (error) => {
  log.error(error)
});

app.setLoginItemSettings({
  "openAtLogin": true,
});

app.on("ready", () => {
  log.info("========= Hello =========")
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((error) => { log.error(error) })
  }
  // Check if we are in minigame
  Object.entries(CONFIG.minigame).forEach((item) => {
    const dateSplit = item[0].split("/")
    const year = dateSplit[2] ? dateSplit[2] : new Date().getFullYear()

    const date = new Date(year, dateSplit[1] - 1, dateSplit[0], 10, 0, 0);
    const start = schedule.scheduleJob(date, function(){
      log.info('The world is going to end today.');
      miniGame.run();
      nimby.nimbyEvent(item[1])
    });
    const date_stop = new Date(year, dateSplit[1] - 1, dateSplit[0], 17, 0, 0);
    const stop = schedule.scheduleJob(date_stop, function(){
      log.info('The world is going to end today.');
      miniGame.stop();
      nimby.nimbyEvent(item[1])
    });
  })
  runNimby();
});

function runNimby() {
  nimby.run()
    .then((result) => {
      if(result === -1) {
        log.error("Tractor is not running !!!!!!!!!")
        tryTractorLaunch().then((result) => {
          if(result === 0) {
            runNimby()
          }
        })
      }
    })
    .catch(function (error) {
      console.log(error)
      log.error("Tractor is not running !!!!!!!!!")
      tryTractorLaunch().then((result) => {
        if(result === 0) {
          runNimby()
        }
        else {
          app.exit(0);
        }
      })
    })
}

async function tryTractorLaunch() {
  if (fs.existsSync(CONFIG.tractorPath)) {
    exec(CONFIG.tractorPath, function(err, data) {
      if(err) {
        log.error(err)
        return -1;
      }
      else {
        return 0;
      }
    })
  }
  else {
    log.error("Tractor not install !!!!!!!!!");
    app.exit(0);
  }
}

app.on('quit', () => {
  log.info("========= Good Bye ! =========");
});
