const {
    join
} = require('path')
const PluginFn = require(join(__dirname, 'plugins', process.env.name));

function fnhandle(arg) {
    const {
        fn
    } = arg || {};
    if (fn) {
        return PluginFn[fn](arg);
    }
}

process.on('message', async (qeury) => {
    const {
        id,
    } = qeury || {};
    const result = await fnhandle(qeury);
    process.send({
        type: 'sync',
        id,
        data: result,
    });
});