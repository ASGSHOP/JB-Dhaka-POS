// printer.js
const { exec } = require('child_process');
const fs = require('fs');

class Printer {
    constructor() {
        this.selectedPrinter = null;
        this.maxCharsPerLine = {
            fontA: 32,  // 48mm/1.5mm per char
            fontB: 42,  // 48mm/1.1mm per char
        };

        // ESC/POS Commands
        this.COMMANDS = {
            // Printer initialization
            INIT: Buffer.from([0x1B, 0x40]),

            // Character size
            FONT_A: Buffer.from([0x1B, 0x4D, 0x00]),
            FONT_B: Buffer.from([0x1B, 0x4D, 0x01]),

            // Text alignment
            ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
            ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
            ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),

            // Text formatting
            BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
            BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
            UNDERLINE_ON: Buffer.from([0x1B, 0x2D, 0x01]),
            UNDERLINE_OFF: Buffer.from([0x1B, 0x2D, 0x00]),
            DOUBLE_ON: Buffer.from([0x1B, 0x47, 0x01]),
            DOUBLE_OFF: Buffer.from([0x1B, 0x47, 0x00]),

            // Line spacing
            LINE_SPACE_DEFAULT: Buffer.from([0x1B, 0x32]),
            LINE_SPACE_CUSTOM: Buffer.from([0x1B, 0x33]),

            // Feed control
            FEED_LINE: Buffer.from([0x0A]),
            FEED_LINES: (n) => Buffer.from([0x1B, 0x64, n]),
            FEED_UNITS: (n) => Buffer.from([0x1B, 0x4A, n]),

            // Cut paper
            CUT_PARTIAL: Buffer.from([0x1B, 0x6D]),
            CUT_FULL: Buffer.from([0x1B, 0x69]),

            // QR Code commands for various printer models
            QR_MODEL1: {
                MODEL: Buffer.from([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x31, 0x00]),
                SIZE: (n) => Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, n]),
                ERROR: (n) => Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, n]),
                STORE: (data) => {
                    const length = data.length + 3;
                    const pL = length & 0xFF;
                    const pH = (length >> 8) & 0xFF;
                    return Buffer.concat([
                        Buffer.from([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]),
                        Buffer.from(data)
                    ]);
                },
                PRINT: Buffer.from([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30])
            },

            QR_MODEL2: {
                HEADER: Buffer.from([0x1D, 0x5A, 0x02, 0x1B, 0x5A]),
                SIZE: (n) => Buffer.from([n]),
                PRINT: (data) => {
                    const length = data.length;
                    return Buffer.concat([
                        Buffer.from([length & 0xFF, (length >> 8) & 0xFF]),
                        Buffer.from(data)
                    ]);
                }
            }
        };
    }

    async init() {
        try {
            const printers = await this.getPrinters();
            if (printers.length > 0) {
                this.selectedPrinter = printers[0];
                console.log('Selected printer:', this.selectedPrinter);
                return true;
            }
            throw new Error('No POS printer found');
        } catch (error) {
            console.error('Printer initialization error:', error);
            throw error;
        }
    }

    async getPrinters() {
        return new Promise((resolve, reject) => {
            exec('lpstat -p | awk \'{print $2}\'', (error, stdout, stderr) => {
                if (error) {
                    console.error('Error getting printers:', error);
                    reject(error);
                    return;
                }
                const printers = stdout.split('\n')
                    .filter(Boolean)
                    .filter(printer => printer.includes('POS'));
                console.log('Found POS printers:', printers);
                resolve(printers);
            });
        });
    }

    generateQRCode(orderId) {
        // Convert order ID to string if it's not already
        const data = orderId.toString();
        
        const commands = [];
        
        try {
            // Model 1 QR Code
            commands.push(this.COMMANDS.QR_MODEL1.MODEL);
            commands.push(this.COMMANDS.QR_MODEL1.SIZE(6));  // Reduced size for order ID
            commands.push(this.COMMANDS.QR_MODEL1.ERROR(49)); // Error correction level M
            commands.push(this.COMMANDS.QR_MODEL1.STORE(data));
            commands.push(this.COMMANDS.QR_MODEL1.PRINT);
        } catch (error) {
            console.log('Trying Model 2 QR Code');
            // Fallback to Model 2 QR Code
            commands.push(this.COMMANDS.QR_MODEL2.HEADER);
            commands.push(this.COMMANDS.QR_MODEL2.SIZE(3)); // Reduced size for order ID
            commands.push(this.COMMANDS.QR_MODEL2.PRINT(data));
        }
    
        return Buffer.concat(commands);
    }
    
    async formatReceipt(sale) {
        try {
            let commands = [];
            
            // Initialize printer
            commands.push(this.COMMANDS.INIT);
            
            // Header
            commands.push(this.COMMANDS.ALIGN_CENTER);
            commands.push(this.COMMANDS.DOUBLE_ON);
            commands.push(this.COMMANDS.BOLD_ON);
            commands.push(Buffer.from('ASG SHOP\n'));
            commands.push(this.COMMANDS.BOLD_OFF);
            commands.push(this.COMMANDS.DOUBLE_OFF);
            
            // Sale info
            commands.push(this.COMMANDS.FONT_A);
            commands.push(Buffer.from(`Order #: ${sale.orderId}\n`));
            commands.push(Buffer.from(`Date: ${new Date(sale.timestamp).toLocaleString()}\n`));
            commands.push(Buffer.from('-'.repeat(this.maxCharsPerLine.fontA) + '\n'));
            
            // Items
            commands.push(this.COMMANDS.ALIGN_LEFT);
            sale.items.forEach(item => {
                commands.push(Buffer.from(`${item.name}\n`));
                commands.push(Buffer.from(`${item.quantity} x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}\n`));
            });
            
            // Totals
            commands.push(Buffer.from('-'.repeat(this.maxCharsPerLine.fontA) + '\n'));
            commands.push(this.COMMANDS.ALIGN_RIGHT);
            commands.push(Buffer.from(`Subtotal: $${sale.subtotal.toFixed(2)}\n`));
            commands.push(Buffer.from(`Tax: $${sale.tax.toFixed(2)}\n`));
            commands.push(this.COMMANDS.BOLD_ON);
            commands.push(Buffer.from(`TOTAL: $${sale.total.toFixed(2)}\n`));
            commands.push(this.COMMANDS.BOLD_OFF);
            
            // QR Code
            commands.push(this.COMMANDS.ALIGN_CENTER);
            commands.push(Buffer.from('\nScan to verify order:\n'));
            commands.push(this.COMMANDS.FEED_LINE);
            
            // Generate QR code with just the order ID
            commands.push(this.generateQRCode(sale.orderId));
            commands.push(this.COMMANDS.FEED_LINE);
            
            // Footer
            commands.push(this.COMMANDS.FONT_B);
            commands.push(Buffer.from('Thank you for shopping!\n'));
            commands.push(Buffer.from('Please come again\n'));
            commands.push(this.COMMANDS.FEED_LINES(3));
            
            // Cut paper
            commands.push(this.COMMANDS.CUT_FULL);
            
            return Buffer.concat(commands);
        } catch (error) {
            console.error('Error formatting receipt:', error);
            throw error;
        }
    }

    async printReceipt(sale) {
        try {
            if (!this.selectedPrinter) {
                await this.init();
            }

            console.log('Printing receipt with printer:', this.selectedPrinter);
            const receiptBuffer = await this.formatReceipt(sale);
            const tempFile = `/tmp/receipt_${Date.now()}.bin`;

            // Write binary data to temp file
            fs.writeFileSync(tempFile, receiptBuffer);

            // Print using lp command with raw option
            return new Promise((resolve, reject) => {
                exec(`lp -d ${this.selectedPrinter} -o raw ${tempFile}`, (error, stdout, stderr) => {
                    // Clean up temp file
                    fs.unlinkSync(tempFile);

                    if (error) {
                        console.error('Print error:', error);
                        reject(error);
                        return;
                    }
                    console.log('Print success:', stdout);
                    resolve(stdout);
                });
            });
        } catch (error) {
            console.error('Receipt printing error:', error);
            throw error;
        }
    }

}

module.exports = Printer;