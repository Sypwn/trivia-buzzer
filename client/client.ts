// Declare 'io' as an external module (from socket.io library)
declare const io: any;

// Connect to the WebSocket server using 'io()' and assign it to 'socket'
const socket = io();

// Get references to the HTML elements with the specified IDs
const name_form = document.getElementById('name_form');
const name_input = document.getElementById('name_input') as HTMLInputElement;
const buzz_form = document.getElementById('buzz_form');
const output_div = document.getElementById('output_div');

// Check if all required HTML elements were found
if (name_form && name_input && buzz_form && output_div) {
    // Add an event listener to the form submit event
    name_form.addEventListener('submit', function(e) {
        // Prevent the default form submission behavior
        e.preventDefault(); 

        // Emit a 'name' event to the server with the input value
        socket.emit('name', name_input.value);

        // Clear the input field after emitting the 'name' event
        name_input.value = '';
    });

    // Add an event listener to the form submit event
    buzz_form.addEventListener('submit', function(e) {
        // Prevent the default form submission behavior
        e.preventDefault(); 

        // Emit a 'buzz' event to the server with the input value
        socket.emit('buzz');
    });

    // When we receive a ping, immediately reply with a pong
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Listen for 'buzz' events emitted by the server
    socket.on('buzz_list', (data) => {      
        // Clear the previous contents of the output_div
        output_div.innerHTML = '';
      
        // Check if 'data' is an array of strings
        if (Array.isArray(data) && data.every((item) => typeof item === 'string')) {
          // Iterate over each string in the 'data' array
          data.forEach((item) => {
            // Create a new paragraph (p) element for each string
            const paragraph = document.createElement('p');
      
            // Set the text content of the paragraph to the current string item
            paragraph.textContent = item;
      
            // Append the paragraph to the 'output_div'
            output_div.appendChild(paragraph);
          });
        } else {
          // If 'data' is not a valid array of strings, display an error message
          console.error('Invalid data format. Expected an array of strings.');
        }
      });
} else {
  // If any of the required HTML elements is missing, log an error message
  console.error('HTML elements not found');
}
