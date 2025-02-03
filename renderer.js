// renderer.js
let cart = [];
let selectedPrinter = null;
let currentCategory = 'All';
let products = [];

// Initialize POS
async function initializePOS() {
    try {
        // Get products from main process
        products = await window.electronAPI.getProducts();
        
        // Get unique categories
        const categories = ['All', ...new Set(products.map(p => p.category))];
        
        // Create category tabs
        const categoryTabs = document.getElementById('category-tabs');
        categoryTabs.innerHTML = '';
        
        categories.forEach(category => {
            const tab = document.createElement('button');
            tab.className = `category-tab ${category === 'All' ? 'active' : ''}`;
            tab.textContent = category;
            tab.onclick = () => {
                currentCategory = category;
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderProducts();
            };
            categoryTabs.appendChild(tab);
        });

        renderProducts();
        await listPrinters();
    } catch (error) {
        console.error('Failed to initialize POS:', error);
        alert('Error initializing POS system');
    }
}

// Render products grid
function renderProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    const filteredProducts = currentCategory === 'All' 
        ? products 
        : products.filter(p => p.category === currentCategory);

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h3>${product.name}</h3>
            <p>$${product.price.toFixed(2)}</p>
        `;
        card.onclick = () => addToCart(product);
        grid.appendChild(card);
    });
}

// Add item to cart
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }
    
    updateCartDisplay();
}

// Update cart display
function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    cartItems.innerHTML = '';
    
    cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div>
                <div>${item.name}</div>
                <div class="quantity-controls">
                    <button onclick="updateQuantity(${item.id}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
            </div>
            <div>$${(item.price * item.quantity).toFixed(2)}</div>
        `;
        cartItems.appendChild(itemElement);
    });
    
    updateTotals();
}

// Update item quantity
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        updateCartDisplay();
    }
}

// Update totals
function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;
    
    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('tax').textContent = tax.toFixed(2);
    document.getElementById('total').textContent = total.toFixed(2);
}

// Process sale and print receipt
async function processSale(paymentMethod) {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }

    try {
        // Calculate totals
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.1;
        const total = subtotal + tax;

        // Create sale object
        const sale = {
            orderId: Date.now(),
            items: cart,
            subtotal,
            tax,
            total,
            paymentMethod,
            timestamp: new Date().toISOString()
        };

        // Print receipt
        const printResult = await window.electronAPI.printReceipt(sale);
        
        if (printResult.success) {
            // Clear cart after successful print
            cart = [];
            updateCartDisplay();
            alert(`Sale completed! Payment method: ${paymentMethod.toUpperCase()}`);
        } else {
            throw new Error(printResult.error || 'Failed to print receipt');
        }
    } catch (error) {
        console.error('Sale processing error:', error);
        alert('Error processing sale: ' + error.message);
    }
}

// List available printers
async function listPrinters() {
    try {
        const result = await window.electronAPI.listPrinters();
        if (result.success) {
            selectedPrinter = result.printers[0];  // Select first available printer
            console.log('Selected printer:', selectedPrinter);
        } else {
            console.error('Failed to list printers:', result.error);
        }
    } catch (error) {
        console.error('Printer list error:', error);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializePOS);