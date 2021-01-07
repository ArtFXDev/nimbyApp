import './App.css';
// import fs from 'fs';
// import { ipcRenderer } from 'electron';
import React from 'react';

// function App() 
class App extends React.Component {

  
  constructor(props) {
    super(props);
    let _version = "error"
    // ipcRenderer.on('app_version', (event, arg) => {
    //   ipcRenderer.removeAllListeners('app_version');
    //   _version = 'Version ' + arg.version;
    // });
    this.state = {
      version: _version,
      runningSoft: null,
    }
  }

  render() {
    return (
      <div className="App">
        <p className="version">{this.state.version}</p>
        <p className="title">
          ArtFX Nimby
        </p>
        <div className="App-content">
          <p>
            This tool if for check if you using your pc and avoid job render on your pc.
          </p>
          { this.state.runningSoft ? 
            <p>Actually you running : {this.state.runningSoft} </p> 
            : 
            <p>No 3d softwares running</p>
          }
        </div>
      </div>
    );
  }
}

export default App;
