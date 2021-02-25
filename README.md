# Nimby in Tractor 

"NIMBY" : "Not In My Back Yard"  

The Nimby App controls if Tractor renders on blades that can be used to work during the day. 


https://rmanwiki.pixar.com/display/TRA/NIMBY

## Nimby field

The "NIMBY" field is set on a Tractor blade.

It has 3 states:
```
1 - will only accept local jobs spooled from that blade's host (local jobs).
0 - will accept jobs from anyone (external jobs).
username - will only accept jobs from the named user.
```

## Nimby App

The user chooses between 2 states:
- **Manual** - Nimby ON : the Nimby field is set to 1, blocking external jobs.  
- **Auto** : - Nimby OFF : The Nimby field is set to 0, allowing external jobs.  

When the mode is "Auto", the app checks automatically if a significant software is started (as defined in `config.json`).
If such a software is launched, the Nimby field is set to 1 (blocking).


## Dev Doc

It's use electron (tray icon) and react (main page).

It uses the Tractor URL Api (and currently the Tactor Controller). See [tractor](https://github.com/ArtFXDev/tractor).

This app has dev, build and deploy scripts.

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
