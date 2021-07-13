const cluster = require('cluster');
const fs = require('fs');
const {
    ipcMain,
} = require('electron');
const path = require('path');

if (!cluster.isMaster) return;
// 文件夹下文件名称
var pluginDir = fs.readdirSync("./plugins").map(p => (p.split('.')[0]));
console.log(pluginDir, 'pluginDir');
let keyPid = {};
let globalid = 0;
let globalData = {};
const SOCKETEvent = [];
let IPCEvent = null;

function pluginCall(pluginName, fn, param) {
    return new Promise((reslove, reject) => {
        let worker = keyPid[pluginName];
        const {
            type
        } = param || {};
        if (worker) {
            let count = 0;

            let id = globalid++;
            globalData[id] = null;
            worker.send({
                id,
                fn,
                param
            });

            if (type) {
                reslove({});
            }

            let timer = setInterval(() => {
                count++;
                let d = globalData[id];
                if (d) {
                    delete globalData[id];
                    clearInterval(timer);
                    reslove(d)
                }
                if (count >= 20) {
                    clearInterval(timer);
                    delete globalData[id];
                    reject({
                        err: 'timeout'
                    })
                }
            }, 300)
        }
    })
}

// 衍生工作进程
pluginDir.forEach((name) => {
    const worker = cluster.fork({
        name,
    });
    // pid 和 plugin name 对应关系
    keyPid[name] = worker;
})

cluster.on('exit', (worker, code, signal) => {
    // console.log(`worker ${worker.process.pid} died`);
});

for (const id in cluster.workers) {
    cluster.workers[id].on('message', async (result) => {
        const {
            id,
            data,
            err,
            type
        } = result || {};
        if (type === 'async') {
            asyncCallback(result);
        } else if (type === 'sync') {
            if (globalData[id] !== undefined) {
                globalData[id] = data
            }
        }
    });
}

function asyncCallback(result) {
    const {
        data
    } = result || {};
    const {
        type
    } = data || {};
    if (type === 'ipc') {
        IPCEvent.reply('CSMessage', {
            data: result,
        });
    } else {
        SOCKETEvent.forEach((socket) => {
            socket.emit('CSMessage', {
                data: result
            });
        })
    }
}

function httpServer() {
    // 直接走http服务
    let app = require('express')();
    var http = require('http').Server(app);
    var io = require('socket.io')(http)
    var bodyParser = require('body-parser');

    io.on('connection', socket => {
        console.log('链接成功');
        // 响应用户发送的信息
        SOCKETEvent.push(socket);
    });

    app.use(bodyParser.json())
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, './index.html'))
    })

    app.post('/CSMessage', async (req, res) => {
        const params = req.body;
        const {
            pluginName,
            fn,
            param = {}
        } = params || {};
        const data = await pluginCall(pluginName, fn, params.param);
        res.send({
            data
        })
    })

    http.listen(8080, 'localhost', () => {
        console.log('服务器已经运行，请打开浏览器，输入：http://127.0.0.1:8080/来访问')
    })
}

function ipcServer() {
    // 建立通信
    ipcMain.on('CSMessage', async (event, arg) => {
        IPCEvent = event;
        const {
            pluginName,
            fn,
            param = {}
        } = arg || {};
        const {
            type
        } = param;
        if (fn) {
            const data = await pluginCall(pluginName, fn, param);
            event.returnValue = data;
        }
    })
}

function startMessage() {
    httpServer();
    ipcServer();
}

module.exports = {
    startMessage,
}