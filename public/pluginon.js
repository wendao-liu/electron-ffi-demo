let ipcRendererT = null;
let socket = null;
let v4uuid = uuid.v4();
try {
    createipc();
} catch (error) {
    createSocket();
}

function createipc() {
    const {
        ipcRenderer
    } = require('electron');
    ipcRendererT = ipcRenderer;
    ipcRenderer.send('CSMessage', 'ping')
    ipcRendererT.on('CSMessage', (event, res) => {
        if (res.data === 0x0001) {
            ipcRendererT = null;
            return createSocket();
        }
    });
}

function createSocket() {
    socket = io('ws://localhost:8080');
    socket.emit('CSMessage', {
        data: 'ping'
    });
}

function syncmessage({
    pluginName,
    fn,
    param
}) {
    let params = {
        pluginName,
        fn,
        param: {
            ...param,
            v4uuid,
        },
    }

    if (ipcRendererT) {
        return Promise.resolve(ipcRendererT.sendSync('CSMessage', params))
    } else {
        return fetch('http://localhost:8080/CSMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        }).then(response => response.json())
    }
}

function asyncmessage(callback) {
    if (ipcRendererT) {
        ipcRendererT.on('CSMessage', (event, res) => {
            const {
                v4uuid: uid,
            } = res.data.data.param || {};
            if (uid === v4uuid) {
                // console.log(res, 'from-ipc');
                callback(res)
            }
        });
    } else {
        socket.on('CSMessage', function (res) {
            const {
                v4uuid: uid,
            } = res.data.data.param || {};
            if (uid === v4uuid) {
                // console.log(res, 'from-websocket');
                callback(res)
            }
        });
    }
    return ({
        pluginName,
        fn,
        param
    }) => {
        if (ipcRendererT) {
            syncmessage({
                pluginName,
                fn,
                param: {
                    type: 'ipc',
                    ...param,
                }
            });
        } else {
            syncmessage({
                pluginName,
                fn,
                param: {
                    type: 'socket',
                    ...param,
                }
            });
        }
    }
}