const {
    join
} = require('path')

let p = join(process.cwd(), 'plugins', process.env.name, 'index');
const PluginFn = require(p);

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
    const result = await fnhandle(query);
    process.send({
        type: 'sync',
        id,
        data: result
    });
});