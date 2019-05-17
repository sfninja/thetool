/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const EventEmitter = require('events');
const http = require('http');
const url = require('url');

class WebSocketTransport extends EventEmitter {
  constructor(socket) {
    super();

    this._socket = socket;
    let buffer = Buffer.alloc(0);
    this._socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      do {
        const { length, message, closed } = this._parseWSFrame(buffer);
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

  static async create(webSocketUrl) {
    const {path, port} = url.parse(webSocketUrl);
    const request = http.get({
      port,
      path,
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Version': 13,
        'Sec-WebSocket-Key': 'key=='
      }
    });
    return new Promise(resolve => request.once('upgrade', (message, socket) => resolve(new WebSocketTransport(socket))));
  }

  _parseWSFrame(buffer) {
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
}

class WorkerTransport extends EventEmitter {
  constructor(connection, sessionId) {
    super();
    this._connection = connection;
    this._sessionId = sessionId;
    this._connection.on('NodeWorker.receivedMessageFromWorker', message => {
      if (message.sessionId === this._sessionId)
        this.emit('message', message.message);
    });
  }

  send(message) {
    return this._connection.send('NodeWorker.sendMessageToWorker', {
      sessionId: this._sessionId,
      message
    });
  }

  close() {
  }
}

class Connection extends EventEmitter {
  constructor(transport) {
    super();
    this._lastId = 0;
    this._callbacks = new Map();
    this._transport = transport;
    this._transport.on('message', this._onMessage.bind(this));
  }

  async _onMessage(message) {
    const object = JSON.parse(message);
    if (object.id) {
      const callback = this._callbacks.get(object.id);
      if (callback) {
        this._callbacks.delete(object.id);
        if (object.error)
          callback.reject(createProtocolError(callback.error, callback.method, object));
        else
          callback.resolve(object.result);
      }
    } else {
      this.emit(object.method, object.params);
    }
  }

  send(method, params = {}) {
    const id = ++this._lastId;
    const message = JSON.stringify({method, params, id});
    this._transport.send(message);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {resolve, error: new Error(), reject, method});
    });
  }

  async close() {
    this._transport.close();
  }
}

function createProtocolError(error, method, object) {
  let message = `Protocol error (${method}): ${object.error.message}`;
  if ('data' in object.error)
    message += ` ${object.error.data}`;
  return rewriteError(error, message);
}

function rewriteError(error, message) {
  error.message = message;
  return error;
}

module.exports = {
  WebSocketTransport,
  WorkerTransport,
  Connection
};
