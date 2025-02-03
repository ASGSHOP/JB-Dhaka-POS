const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listPrinters: () => ipcRenderer.invoke('list-printers'),
    printReceipt: (sale) => ipcRenderer.invoke('print-receipt', sale),
    getProducts: () => ipcRenderer.invoke('get-products')
});