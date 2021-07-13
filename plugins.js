const PluginFn = require(`./plugin/${process.env.name}`);

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
        fn,
    } = qeury || {};
    const result = await fnhandle(qeury);
    process.send({
        id,
        data: result,
    });
});