console.log(process.env.name, process.pid, '------env-pid');
const {
    PluginFn
} = require(`./plugin/${process.env.name}`);
const path = require('path')
let SOCKETEvent = [];


function fnhandle(arg) {
    const {
        pluginName,
        fn
    } = arg || {};
    if (fn) {
        return PluginFn[pluginName][fn](arg);
    }
}


function server() {
    // 直接走http服务
    (function () {
        let app = require('express')();
        var http = require('http').Server(app);
        var io = require('socket.io')(http)
        var bodyParser = require('body-parser');

        io.on('connection', socket => {
            console.log('链接成功');
            // 响应用户发送的信息
            SOCKETEvent.push(socket)
            socket.on('CSMessage', function (arg) {
                const {
                    pluginName,
                    fn
                } = arg || {};
                if (fn) {
                    PluginFn[pluginName][fn](arg);
                    // eval(`${fn}(${JSON.stringify(arg)})`);
                } else {
                    io.emit('CSMessage', {
                        pluginName: null,
                        data: 'pong'
                    })
                }
            })
        });

        app.use(bodyParser.json())
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, './index.html'))
        })


        function fnhandle(arg) {
            const {
                pluginName,
                fn
            } = arg || {};
            if (fn) {
                return PluginFn[pluginName][fn](arg);
            }
        }

        app.post('/CSMessage', async (req, res) => {
            const params = req.body;
            const result = await fnhandle(params);
            console.log(result, 'result------');
            res.send({
                ...result
            })
        });

        http.listen(8080, 'localhost', () => {
            console.log('服务器已经运行，请打开浏览器，输入：http://127.0.0.1:8080/来访问')
        })
    })()
}
// server();

if (process.env.name && process.pid) {
    process.send({
        name: process.env.name,
        pid: process.pid
    });
}
process.on('message', async (param) => {
    if (process.env.name === param.pluginName) {
        const result = await fnhandle(param);
        process.send(result);
    }
});