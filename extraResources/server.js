var express = require('express');
const app = express()
var http = require('http').Server(app);
const path = require('path');

// app.use('/node_modules', express.static(path.join(process.cwd(), 'node_modules')));
app.get('/', (req, res) => {
    // console.log(path.join(process.cwd(), 'node_modules'), '------');
    res.sendFile(__dirname + '/index.html');
})

http.listen(8080, () => {
    console.log('打开8080端口')
})