const io = require('socket.io-client');

let socket = io('http://localhost:4000');

socket.on('connect', () => console.log('connected'));
socket.on('BPM', (data) => {
	console.log(data);
});
