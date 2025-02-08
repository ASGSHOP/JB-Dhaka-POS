

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {


    const phoneInput = document.getElementById("phone");
    const loginButton = document.getElementById("login-btn");

    // Function to validate phone number
    function validatePhoneNumber(phone) {
        const phonePattern = /^(?:\+?88)?01[13-9]\d{8}$/;
        return phonePattern.test(phone);
    }

    // Add event listener to the phone input
    phoneInput.addEventListener("input", function () {
        // Enable button only if the phone number is valid
        loginButton.disabled = !validatePhoneNumber(phoneInput.value);
    });

    // Initially disable the button
    loginButton.disabled = true;
});


// Prevent default drag behavior
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
});


async function handleLogin(phone) {
    try {
        const response = await fetch('https://admin.jonotarbazar.today/api/v1/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone }),
        });

        const data = await response.json();

        if (data.success === true) { // Check data.success instead of response.success
            // Store the OTP
            await window.electronAPI.setStoreValue('otp', data.data.otp);
            await window.electronAPI.setStoreValue('isLoggedIn', true);
            // Send navigation request to main process
            await window.electronAPI.navigate('index.html');

            return true;
        } else {
            // Handle error case
            throw new Error(data.message || 'Login failed');
        }
    } catch (error) {
        throw error;
    }
}



document.getElementById('login-form').addEventListener('submit', async function (event) {
    event.preventDefault(); // Prevent default form submission

    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value;
    const loginButton = event.target.querySelector('button[type="submit"]');
    const toastElement = document.getElementById('liveToast');
    const toastHeader = toastElement.querySelector('.toast-header');
    const toastBody = toastElement.querySelector('.toast-body');
    const toast = new bootstrap.Toast(toastElement, { autohide: true });

    // Hide the toast initially
    toastElement.style.display = 'none';

    // Add loading state to the button
    loginButton.disabled = true;
    loginButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';

    try {
        // Disable button and show loading state
        loginButton.disabled = true;
        loginButton.innerHTML = 'Loading...';

        await handleLogin(phoneInput.value);
    } catch (error) {
        // Reset button state
        loginButton.disabled = false;
        loginButton.innerHTML = 'Login';

        // Update toast with error message
        toastBody.textContent = error.message;
        toastHeader.textContent = "Notification";

        // Show the toast
        toastElement.style.display = 'block';
        toast.show();
    }
});

function logout() {
    if (window.electronAPI) {
        window.electronAPI.send('logout');
    } else {
        console.error('electronAPI not found');
    }
}