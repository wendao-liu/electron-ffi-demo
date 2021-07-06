var express = require('express');
const app = express()
var http = require('http').Server(app);
const path = require('path');


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../', '/index.html'));
})

http.listen(8080, () => {
    console.log('打开8080端口')
})