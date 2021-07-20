const io = require('socket.io');


let socket = io('ws://localhost:8080');
socket.on('CSMessage', function (res) {
    console.log(res, 'from-websocket');
});