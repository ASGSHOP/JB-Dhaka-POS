const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listPrinters: () => ipcRenderer.invoke('list-printers'),
    printReceipt: (sale) => ipcRenderer.invoke('print-receipt', sale),
    getProducts: () => ipcRenderer.invoke('get-products'),

    // IPC methods
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),

    navigate: (url) => {
        window.location.href = url;
    },

    // Store methods (optional: only expose what's needed)
    getStoreValue: (key) => ipcRenderer.invoke('store:get', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('store:set', key, value),
});