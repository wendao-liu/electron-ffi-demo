const cluster = require('cluster');
if (cluster.isMaster) {
    const {
        join
    } = require('path');
    const {
        dynamicallyRequire
    } = require(join(process.cwd(), './util/index.js'));
    const fs = require('fs');
    const ffi = dynamicallyRequire('ffi-napi');
    const {
        ipcMain,
        app
    } = require('electron');

    let gotTheLock = app.requestSingleInstanceLock();


    if (!gotTheLock) {
        let lockTimer = setInterval(() => {
            if (gotTheLock) return;
            gotTheLock = app.requestSingleInstanceLock();
            if (gotTheLock) {
                Plugin();
                clearInterval(lockTimer);
                return;
            }
        }, 2000);
        ipcMain.on('CSMessage', async (event, params) => {
            event.reply('CSMessage', {
                data: 0x0001,
            });
        })
        return;
    }

    function Plugin() {
        const path = require('path');
        // 文件夹下文件名称
        let keyPid = {};
        let globalId = 0;
        let globalData = {};
        let server = {};
        const pluginRequestStatistics = [];
        const pluginRequestStatisticsMaxLength = 20;
        const pluginDir = () => {
            return fs.readdirSync(join(process.cwd(), "./plugins")).map(p => (p.split('.')[0]));
        }
        const SOCKETEvent = [];
        let IPCEvent = null;


        function pluginStatistics(requestList) {
            if (requestList) {
                SOCKETEvent.forEach((s) => {
                    s.emit('pluginStatistics', {
                        requestList,
                    });
                })
                return;
            }

            // 统计插件
            setTimeout(() => {
                SOCKETEvent.forEach((s) => {
                    s.emit('pluginStatistics', keyPid);
                })
            }, 1000)
        }


        // 打日志
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
        const logger = loggerFn(join(process.cwd(), './log/index.log'))

        // 插件更新
        const updatePluginTimer = setInterval(() => {
            let flag = false;
            // 删除插件文件---卸载插件
            Object.keys(keyPid).forEach((name) => {
                if (!pluginDir().includes(name)) {
                    flag = true;
                    delete keyPid[name];
                }
            });
            // 新增插件文件---安装插件
            pluginDir().forEach((name) => {
                if (keyPid[name]) return;

                const worker = cluster.fork({
                    name,
                });
                flag = true;
                keyPid[name] = worker;
            })
            if (flag) {
                flag = false;
                pluginStatistics();
            }
        }, 2000)

        function createCluster() {
            // 衍生工作进程
            if (!process.argv[1]) {
                var modulePath = join(process.cwd(), 'scripts/pluginChild.js')
                process.argv[1] = modulePath;
            }
            pluginDir().forEach((name, index) => {
                const worker = cluster.fork({
                    name,
                });
                // pid 和 plugin name 对应关系
                keyPid[name] = worker;

            })
            pluginStatistics();
        }

        // 创建集群
        createCluster();

        function pluginCall(pluginName, fn, {
            param = {},
        }) {
            pluginRequestStatistics.unshift({
                pluginName,
                fn
            });
            pluginRequestStatistics.length > pluginRequestStatisticsMaxLength && (pluginRequestStatistics.length = pluginRequestStatisticsMaxLength);
            pluginStatistics(pluginRequestStatistics);
            return new Promise((reslove, reject) => {
                let worker = keyPid[pluginName];
                const {
                    type,
                } = param;

                if (worker) {
                    let count = 0;

                    let id = globalId++;
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
                        if (count >= 10) {
                            clearInterval(timer);
                            delete globalData[id];
                            reslove({
                                message: 'timeout',
                                code: 2000
                            })
                        }
                    }, 300)
                }
            })
        }


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
            pluginStatistics();
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
            let express = dynamicallyRequire('express');
            let app = express();
            const cors = dynamicallyRequire('cors');
            app.use(cors());
            app.use(express.static('public'));
            var http = require('http').Server(app);
            var io = dynamicallyRequire('socket.io')(http, {
                cors: true
            });
            var bodyParser = dynamicallyRequire('body-parser');
            const {
                exec
            } = require('child_process');

            io.on('connection', socket => {
                console.log('链接成功');
                // 响应用户发送的信息
                SOCKETEvent.push(socket);
                SOCKETEvent.forEach((s) => {
                    s.emit('pluginStatistics', keyPid);
                })
            });

            app.use(bodyParser.json())
            app.get('/', (req, res) => {
                res.sendFile(path.join(__dirname, '../static/index.html'))
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

            server = http.listen(8080, 'localhost', () => {
                console.log('服务器已经运行，请打开浏览器，输入：http://127.0.0.1:8080/来访问')
            })
        }


        // 当全部窗口关闭时退出。
        app.on('window-all-closed', () => {
            console.log('----window-all-closed');
            // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
            // 否则绝大部分应用及其菜单栏会保持激活。
            server.close(() => {
                console.log('Closed out remaining connections');
            });

            // 清空监听插件更新的定时器
            clearInterval(updatePluginTimer);
        })

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

        startMessage();
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
    }
    Plugin();
} else {
    // 工作进程可以共享任何 TCP 连接
    // 在本示例中，其是 HTTP 服务器
    const {
        join
    } = require('path')
    require(join(process.cwd(), 'scripts', 'pluginChild.js'));
}