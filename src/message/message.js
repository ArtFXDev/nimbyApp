const { dialog } = require("electron");
const path = require("path");
let QUOTES = require('../config/quotes.json')

function messageJob() {
  const msgText = "A job is currently running on your computer.\n" +
    "- To kill the job and block the farm click 'Kill Job'\n" +
    "- To keep the job running and close this window click 'close'\n"

  return dialog.showMessageBox({
    message: msgText,
    buttons: ["close", "Kill Job"],
    title: "Nimby",
    icon: path.join(path.dirname(__dirname), 'app.ico')
  });
}

function messageHighUsage() {
  const randomQuote = QUOTES.highUsage[Math.floor(Math.random() * QUOTES.highUsage.length)];
  const msgText = "You currently have Hight CPU or RAM usage.\n" +
    "Close app to pass on the farm\n" + randomQuote

  return dialog.showMessageBox({
    message: msgText,
    title: "Nimby",
    icon: path.join(path.dirname(__dirname), 'app.ico')
  });
}

module.exports = { messageJob, messageHighUsage };
