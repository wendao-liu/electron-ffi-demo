var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http)
var Init = require('./test.js');
const child_process = require('child_process');


io.on('connection', socket => {
    // 响应用户发送的信息
    socket.on('chat message', function (msg) {
        console.log('client message' + msg)
        const {
            MAC
        } = msg || {};
        if (MAC) {
            Init(io);
        }
        io.emit('chat message', msg)
    })
});


// for (var i = 0; i < 3; i++) {
//     var workerProcess = child_process.spawn('node', ['support.js', i]);
//     workerProcess.stderr.on('data', function (data) {
//         console.log('stderr: ' + data);
//     });
//     workerProcess.on('close', function (code) {
//         console.log('子进程已退出，退出码 ' + code);
//     });
//     console.log();
// }


app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
})

app.post('/dllInit', (req, res) => {
    Init(io);
    res.send({
        code: 200,
        data: true,
        message: '初始化成功！'
    })
})

http.listen(8000, () => {
    console.log('打开8000端口')
})