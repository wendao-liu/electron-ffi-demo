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

process.on('message', async (query) => {
    const {
        id,
    } = query || {};
    console.log(query,'-----query');
    const result = await fnhandle(query);
    process.send({
        type: 'sync',
        id,
        data: result,
    });
});