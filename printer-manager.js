const { ipcMain } = require('electron');
const Printer = require('./printer');

class PrinterManager {
    constructor() {
        this.printer = new Printer();
        this.setupEvents();
    }

    setupEvents() {
        ipcMain.handle('list-printers', async () => {
            try {
                const printers = await this.printer.getPrinters();
                return {
                    success: true,
                    printers: printers
                };
            } catch (error) {
                console.error('List printers error:', error);
                return { success: false, error: error.message };
            }
        });
    }
}

module.exports = PrinterManager;