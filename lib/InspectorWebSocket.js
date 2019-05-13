/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const EventEmitter = require('events');
const http = require('http');
const url = require('url');

class InspectorWebSocket extends EventEmitter {
  constructor(socket) {
    super();

    this._socket = socket;
    let buffer = Buffer.alloc(0);
    this._socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      do {
        const { length, message, closed } = parseWSFrame(buffer);
        if (!length)
          break;
        if (closed)
          socket.write(Buffer.from([0x88, 0x00]));  // WS close frame
        buffer = buffer.slice(length);
        if (message)
          this.emit('message', message);
      } while (true);
    });
  }

  send(message) {
    const messageBuf = Buffer.from(message);

    const wsHeaderBuf = Buffer.allocUnsafe(16);
    wsHeaderBuf.writeUInt8(0x81, 0);
    let byte2 = 0x80;
    const bodyLen = messageBuf.length;

    let maskOffset = 2;
    if (bodyLen < 126) {
      byte2 = 0x80 + bodyLen;
    } else if (bodyLen < 65536) {
      byte2 = 0xFE;
      wsHeaderBuf.writeUInt16BE(bodyLen, 2);
      maskOffset = 4;
    } else {
      byte2 = 0xFF;
      wsHeaderBuf.writeUInt32BE(bodyLen, 2);
      wsHeaderBuf.writeUInt32BE(0, 6);
      maskOffset = 10;
    }
    wsHeaderBuf.writeUInt8(byte2, 1);
    wsHeaderBuf.writeUInt32BE(0x01020408, maskOffset);

    for (let i = 0; i < messageBuf.length; i++)
      messageBuf[i] = messageBuf[i] ^ (1 << (i % 4));

    this._socket.write(Buffer.concat([wsHeaderBuf.slice(0, maskOffset + 4), messageBuf]));
  }

  close() {
    this._socket.write(Buffer.from([0x88, 0x00]));
    this._socket.destroy();
  }
}

function parseWSFrame(buffer) {
  // Protocol described in https://tools.ietf.org/html/rfc6455#section-5
  let message = null;
  if (buffer.length < 2)
    return { length: 0, message };
  if (buffer[0] === 0x88 && buffer[1] === 0x00)
    return { length: 2, message, closed: true };
  let dataLen = 0x7F & buffer[1];
  let bodyOffset = 2;
  if (buffer.length < bodyOffset + dataLen)
    return { length: 0, message };
  if (dataLen === 126) {
    dataLen = buffer.readUInt16BE(2);
    bodyOffset = 4;
  } else if (dataLen === 127) {
    dataLen = buffer.readUIntBE(4, 6);
    bodyOffset = 10;
  }
  if (buffer.length < bodyOffset + dataLen)
    return { length: 0, message };
  const jsonPayload =
    buffer.slice(bodyOffset, bodyOffset + dataLen).toString('utf8');
  message = jsonPayload;
  return { length: bodyOffset + dataLen, message };
}

function createSocket(webSocketUrl) {
  let resolveCallback = null;
  const promise = new Promise(resolve => resolveCallback = resolve);
  const {path, port} = url.parse(webSocketUrl);
  http.get({
    port,
    path,
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket',
      'Sec-WebSocket-Version': 13,
      'Sec-WebSocket-Key': 'key=='
    }
  }).on('upgrade', (message, socket) => resolveCallback(new InspectorWebSocket(socket)));
  return promise;
}

module.exports = createSocket;
