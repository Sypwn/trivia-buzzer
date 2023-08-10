// Declare 'io' as an external module (from socket.io library)
declare const io: any;

interface Buzzer {
  name: string;
  color: string;
}

// Connect to the WebSocket server using 'io()' and assign it to 'socket'
const socket = io();

function getElement(element_id: string) {
  const element = document.getElementById(element_id);
  if (!element) {
    console.error('Element "' + element_id + '" not found!');
  }
  return element;
}

// Get references to the HTML elements with the specified IDs
const buzz_list_div = getElement('buzz_list_div');
const red_player = getElement('red_player');
const yellow_player = getElement('yellow_player');
const green_player = getElement('green_player');
const blue_player = getElement('blue_player');
const purple_player = getElement('purple_player');
const none_player = getElement('none_player');

const player_map: { [key: string]: HTMLElement | null } = {
  red: red_player,
  yellow: yellow_player,
  green: green_player,
  blue: blue_player,
  purple: purple_player,
  none: none_player,
};

function clearPlayers() {
  const players = buzz_list_div.querySelectorAll('p');
  players.forEach((player: HTMLElement) => {
    player.style.display = 'none';
  });
  buzz_list_div.insertBefore(none_player, buzz_list_div.firstChild);
}

function playerIsActive(nodeA: HTMLElement): boolean {
  return !!(nodeA.compareDocumentPosition(none_player) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function buzzPlayer(buzzer: Buzzer) {
  const player = player_map[buzzer.color];
  if (!player) return;

  if (!playerIsActive(player)) {
      buzz_list_div.insertBefore(player, none_player);
      player.textContent = buzzer.name;
      player.style.display = 'block';
  }

  // Restart animation
  // Get existing animation name
  const animationName = window.getComputedStyle(player).animationName;
  player.style.animationName = 'none';

  // Force a reflow and reset the animation
  void player.offsetWidth;
  player.style.animationName = animationName;
}

function buzzList(buzzers: Buzzer[]) {
  let previousPlayer: HTMLElement | null = null;

  for (const buzzer of buzzers) {
      const currentPlayer = player_map[buzzer.color];
      if (!currentPlayer) continue;

      if (previousPlayer) {
          // If the currentPlayer is not immediately after the previousPlayer
          if (previousPlayer.nextSibling !== currentPlayer) {
              buzz_list_div.insertBefore(currentPlayer, previousPlayer.nextSibling);
          }
      } else if (currentPlayer !== buzz_list_div.firstChild) { 
          // currentPlayer should be the first child, but it's not
          buzz_list_div.insertBefore(currentPlayer, buzz_list_div.firstChild);
      }

      // Update the previousPlayer for the next iteration
      previousPlayer = currentPlayer;
  }
}

// Add an event listener to the form submit event
getElement('code_form')?.addEventListener('submit', function(e) {
    // Prevent the default form submission behavior
    e.preventDefault(); 

    // Emit a 'code' event to the server with the input value
    socket.emit('code', ((getElement('code_input') as HTMLInputElement)).value);
});

socket.on('code_ok', () => {
  getElement('code_form').style.display = 'none';
  getElement('main_div').style.display = 'block';
});

getElement('reset_button')?.addEventListener('click', () => {
  socket.emit('reset');
});

socket.on('reset', () => {
  clearPlayers();
});

socket.on('buzz_single', (buzzer: Buzzer) => {
  buzzPlayer(buzzer);
  (new Audio('/bell.mp3')).play();
});

socket.on('buzz_list', (buzzers: Buzzer[]) => {
  buzzList(buzzers);
});

socket.on('disconnect', () => {
  socket.io.opts.reconnection = false;
  getElement('code_form').style.display = 'none';
  getElement('main_div').style.display = 'none';
  getElement('disconnected').style.display = 'block';
});
