const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getWeather: () => ipcRenderer.invoke('get-weather')
});
