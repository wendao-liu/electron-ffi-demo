const cluster = require('cluster');
const {
    clear,
    time
} = require('console');

if (cluster.isMaster) {
    const fs = require('fs');
    const ffi = require('ffi-napi');
    const {
        ipcMain,
    } = require('electron');

    function loggerFn(address) {
        let options = {
            flags: 'w', // 
            encoding: 'utf8', // utf8编码
        }
        let stderr = fs.createWriteStream(address, options);
        // 创建logger
        let logger = new console.Console(stderr);
        let count = 0;
        return (message) => {
            count++;
            logger.log(`${count}.${JSON.stringify(message)}`)
        }
    }
    const logger = loggerFn('./log/index.log')

    const path = require('path');
    // 文件夹下文件名称
    var pluginDir = fs.readdirSync("./plugins").map(p => (p.split('.')[0]));
    console.log(pluginDir, 'pluginDir');
    let keyPid = {};
    let globalid = 0;
    let globalData = {};

    const SOCKETEvent = [];
    let IPCEvent = null;


    function pluginCall(pluginName, fn, {
        param = {},
    }) {
        return new Promise((reslove, reject) => {
            let worker = keyPid[pluginName];
            const {
                type,
            } = param;

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
                    return reslove({});
                }

                let timer = setInterval(() => {
                    count++;
                    let d = globalData[id];
                    if (d) {
                        delete globalData[id];
                        clearInterval(timer);
                        reslove(d)
                    }
                    if (count >= 6) {
                        clearInterval(timer);
                        delete globalData[id];
                        reslove({
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

    // 监听进程崩溃 然后重启一个新的进程
    cluster.on('exit', (worker, code, signal) => {
        const diedPid = worker.process.pid;
        console.log(`worker ${diedPid} died`);
        Object.keys(keyPid).forEach((name) => {
            if (keyPid[name].process.pid === diedPid) {
                const worker = cluster.fork({
                    name,
                });
                keyPid[name] = worker;
                const newPid = keyPid[name].process.pid
                console.log(newPid, '------newPid');
                logger({
                    diedName: name,
                    diedPid,
                    newPid,
                })
                clusterOnMessage(keyPid[name]);
            }
        })
    });


    function clusterOnMessage(worker) {
        worker.on('message', async (result) => {
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
                    globalData[id] = result
                }
            }
        });

    }
    for (const name in keyPid) {
        clusterOnMessage(keyPid[name]);
    }

    function asyncCallback(result) {
        const {
            data
        } = result || {};
        console.log(result, '-----result');
        const {
            param,
        } = data || {};
        const {
            type
        } = param || {};
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
        const {
            exec
        } = require('child_process');

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
            } = params || {};
            const data = await pluginCall(pluginName, fn, params);
            res.send({
                data
            })
        })

        exec('netstat  -aon|findstr  "8080"', (error, stdout, stderr) => {
            console.log(stdout, '------stdout');
            if (!stdout) {
                http.listen(8080, 'localhost', () => {
                    console.log('服务器已经运行，请打开浏览器，输入：http://127.0.0.1:8080/来访问')
                })
            } else {
                console.log('服务器已经存在！');
            }
        });
    }

    function ipcServer() {
        // 建立通信
        ipcMain.on('CSMessage', async (event, params) => {
            IPCEvent = event;
            const {
                pluginName,
                fn,
            } = params || {};
            if (fn) {
                const data = await pluginCall(pluginName, fn, params);
                event.returnValue = data;
            }
        })
    }

    function startMessage() {
        httpServer();
        ipcServer();
    }
    startMessage()

    // dll 崩溃函数
    function dllCrash() {
        let Demo = ffi.Library('dll/libCbuild2Demo.dll', {
            'init': ['int', ['int']],
            'crash1': ['int', ['int']],
            'exit1': ['int', ['int']],
        })
        Demo.crash1(123);
        // Demo.exit1(123);
    }

    // electron 进程会直接挂掉
    // let timer = setTimeout(() => {
    //     clearTimeout(timer);
    //     dllCrash();
    // }, 3000)
} else {
    // 工作进程可以共享任何 TCP 连接
    // 在本示例中，其是 HTTP 服务器
    require('./pluginCenter.js');
}