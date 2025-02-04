const { app, BrowserWindow, ipcMain, Menu } = require('electron');
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

let store;
let mainWindow;
let printer;

async function initializeStore() {
    const Store = (await import('electron-store')).default; // Dynamic import
    store = new Store(); // Initialize the store
}

async function createWindow() {
    await initializeStore(); // Ensure store is initialized before use

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Add context menu for right-click
    mainWindow.webContents.on('context-menu', (e, props) => {
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Toggle DevTools', click: () => mainWindow.webContents.toggleDevTools() }
        ]);
        contextMenu.popup();
    });

    // Create application menu
    const template = [
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'toggleDevTools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Check if user is logged in
    const isLoggedIn = store.get('isLoggedIn', false);

    // Load appropriate page based on auth status
    if (isLoggedIn) {
        mainWindow.loadFile('index.html');
    } else {
        mainWindow.loadFile('login.html');
    }
}

function setupIPCHandlers() {
    // Initialize printer
    printer = new Printer();

    // Products handler
    ipcMain.handle('get-products', () => {
        console.log('Sending products:', products);
        return products;
    });

    ipcMain.handle('store:set', async (event, key, value) => {
        // Your store setting logic here
        store.set(key, value);
        return true;
    });

    // Handle route changes from renderer
    ipcMain.on('navigate', (event, route) => {
        switch (route) {
            case 'home':
                mainWindow.loadFile('index.html');
                break;
            case 'login':
                mainWindow.loadFile('login.html');
                break;
            case 'settings':
                mainWindow.loadFile('settings.html');
                break;
            default:
                mainWindow.loadFile('404.html');
        }
    });

    ipcMain.on('navigate', (event, page) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win.loadFile(page);
    });

    // // Handle login
    // ipcMain.on('login', (event, credentials) => {
    //     // This is where you'd typically validate against a backend
    //     // For demo, we'll just check if both fields are filled
    //     if (credentials.username && credentials.password) {
    //         store.set('isLoggedIn', true);
    //         store.set('user', { username: credentials.username });
    //         mainWindow.loadFile('index.html');
    //     } else {
    //         event.reply('login-failed', 'Invalid credentials');
    //     }
    // });

    // Handle logout
    ipcMain.on('logout', () => {
        store.set('isLoggedIn', false);
        store.delete('user');
        mainWindow.loadFile('login.html');
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

app.whenReady().then(async () => {
    await initializeStore(); // Ensure store is initialized before setting up IPC handlers
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