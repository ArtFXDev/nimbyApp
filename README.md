# Nimby App

This app is use for automaticly set the tractor nimby when user use this pc.
It's use electron (tray icon) and react (main page).

## Dev Doc

This app have script dev, build and deploy.

### Important files

- `config.json` in the public folder is the main config with the list of softwares to check if running.
- `electron.js` is the implementation of the tray via electron and call react index.html
- `src` folder is react page when you click on the tray icon

### Starting

For start dev, you need node (npm) command install
Use `npm install` for install all dependencies.

#### Dev

For launch the app in dev mode just launch `npm run dev`.
If you whant only edit the main page with react use `npm run start`.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

#### Build

You can build the app with `npm run build`.
This build electron and react code.

#### Deploy

When you have working code lauch `npm run deploy` to send build `.exe` to github release.
You will need to set a github token with repo right. When you have it, use GH_TOKEN environment variable to avoid tocken publish.
