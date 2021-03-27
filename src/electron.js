/*
=====================================================
    This is my main process, here i call my app
    and I check updates
=====================================================
 */
const { app, Notification } = require("electron");
const { autoUpdater } = require('electron-updater');
const path = require("path");
const log = require('electron-log');
const isDev = require('electron-is-dev');

const nimby = require('./nimby/nimby');

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

app.setLoginItemSettings({
  "openAtLogin": true,
});

app.on("ready", () => {
  log.info("========= Hello =========")
  if (!isDev) {
    autoUpdater.checkForUpdates().catch((error) => { log.error(error) })
  }
  nimby.createTray()
  nimby.createPanel()
});

app.on('quit', () => {
  log.info("========= Good Bye ! =========")
});
