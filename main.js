const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Printer = require('./printer');

// Import products
const products = [
    { id: 1, name: 'Burger', price: 5.99, category: 'Food' },
    { id: 2, name: 'Pizza', price: 8.99, category: 'Food' },
    { id: 3, name: 'Fries', price: 2.99, category: 'Sides' },
    { id: 4, name: 'Coke', price: 1.99, category: 'Drinks' },
    { id: 5, name: 'Coffee', price: 2.49, category: 'Drinks' },
    { id: 6, name: 'Sandwich', price: 4.99, category: 'Food' },
    { id: 7, name: 'Salad', price: 6.99, category: 'Food' },
    { id: 8, name: 'Ice Cream', price: 3.99, category: 'Desserts' },
    { id: 9, name: 'Water', price: 0.99, category: 'Drinks' },
    { id: 10, name: 'Cake', price: 4.99, category: 'Desserts' }
];

let mainWindow;
let printer;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
}

function setupIPCHandlers() {
    // Initialize printer
    printer = new Printer();

    // Products handler
    ipcMain.handle('get-products', () => {
        console.log('Sending products:', products);
        return products;
    });

    // List printers handler
    ipcMain.handle('list-printers', async () => {
        try {
            const printers = await printer.getPrinters();
            return { success: true, printers };
        } catch (error) {
            console.error('List printers error:', error);
            return { success: false, error: error.message };
        }
    });

    // Print receipt handler
    ipcMain.handle('print-receipt', async (event, sale) => {
        try {
            await printer.printReceipt(sale);
            return { success: true };
        } catch (error) {
            console.error('Receipt printing error:', error);
            return { success: false, error: error.message };
        }
    });
}

app.whenReady().then(() => {
    setupIPCHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});