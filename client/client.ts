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
const color_radios = document.querySelectorAll('[name="color"]') as NodeListOf<HTMLInputElement>;
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


function getSelectedColor(): string | null {
  for (let i = 0; i < color_radios.length; i++) {
    if (color_radios[i].checked) {
      return color_radios[i].value;
    }
  }
  return null; // return null if no color is selected
}

// Add an event listener to the form submit event
getElement('name_form').addEventListener('submit', function(e) {
  // Prevent the default form submission behavior
  e.preventDefault(); 

  // Get the selected color
  const selectedColor = getSelectedColor();

  socket.emit('name', {
    name: (getElement('name_input') as HTMLInputElement).value,
    color: selectedColor
  });
});

socket.on('name_error', (error: string) => {
  getElement('name_error').textContent = error;
});

socket.on('name_ok', (data: Buzzer) => {
  document.documentElement.style.setProperty('--current-player-color', 'var(--' + data.color + '-player-color)');
  getElement('name_form').style.display = 'none';
  getElement('main_div').style.display = 'block';
  document.title = data.name;
});

getElement('buzz_button').addEventListener('click', function(e) {
  socket.emit('buzz');
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

// When we receive a ping, immediately reply with a pong
socket.on('ping', () => {
  socket.emit('pong');
});

socket.on('disconnect', () => {
  socket.io.opts.reconnection = false;
  getElement('name_form').style.display = 'none';
  getElement('main_div').style.display = 'none';
  getElement('disconnected').style.display = 'block';
});
