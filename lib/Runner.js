/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const childProcess = require('child_process');
const EventEmitter = require('events');
const readline = require('readline');

const createSocket = require('./InspectorWebSocket');

class ReportWrapper {
  constructor(id, callback) {
    this._id = id;
    this._callback = callback;
  }

  reportStart(suggestedFileExtension, userHint) {
    this._callback('reportStart', {id: this._id, suggestedFileExtension, userHint});
  }

  reportChunk(chunk) {
    this._callback('reportChunk', {id: this._id, chunk});
  }

  reportFinish() {
    this._callback('reportFinish', {id: this._id});
  }
}

class ToolWrapper {
  constructor(tool, callback) {
    this._tool = tool;
    this._started = 0;
    this._callback = callback;
    this._reportWrapper = null;
  }

  start() {
    ++this._started;
    if (this._started === 1) {
      this._reportWrapper = new ReportWrapper(++ToolWrapper._lastId, this._callback);
      return this._tool.before(this._reportWrapper);
    }
  }

  stop() {
    --this._started;
    if (this._started === 0) {
      const promise = this._tool.after(this._reportWrapper);
      this._reportWrapper = null;
      return promise;
    }
  }
}

ToolWrapper._lastId = 0;

async function runTool({nodeCommandLine, toolFactory, ondemand, callback}) {
  const [nodeExecutable, ...nodeArguments] = nodeCommandLine;
  const env = process.env;
  if (!env.NODE_OPTIONS)
    env.NODE_OPTIONS = '';
  env.NODE_OPTIONS += ' --inspect-brk=0';
  const nodeProcess = childProcess.spawn(
      nodeExecutable,
      nodeArguments,
      {
        env,
        stdio: ['inherit', 'inherit', 'pipe']
      }
  );
  waitForWSEndpoint(nodeProcess, webSocket => runToolForProcess({webSocket, toolFactory, ondemand, callback}));
  await new Promise(resolve => nodeProcess.once('exit', resolve));
}

function setupEnvironment() {
  const nativeConsoleDebug = console.debug;
  function sendCommand(command, filename) {
    let resolveCallback;
    const promise = new Promise(resolve => resolveCallback = resolve);
    const id = setTimeout(resolve, 30000);
    function resolve() {
      resolveCallback();
      clearTimeout(id);
    }
    nativeConsoleDebug(command, resolve, filename);
    return promise;
  }
  this.startTheTool = sendCommand.bind(null, 'thetool:start');
  this.stopTheTool = sendCommand.bind(null, 'thetool:stop');
}

async function runToolForProcess({webSocket, toolFactory, ondemand, callback}) {
  const ws = await createSocket(webSocket);
  const connection = new Connection(ws);
  const wrapper = new ToolWrapper(toolFactory({connection}), callback);
  if (ondemand) {
    await connection.send('Runtime.evaluate', {
      expression: `(${setupEnvironment.toString()})()`
    });
  } else {
    await wrapper.start();
  }

  connection.on('Runtime.consoleAPICalled', async message => {
    if (message.type !== 'debug')
      return;
    if (!message.args.length)
      return;
    const arg0 = message.args[0].value;
    if (arg0 === 'thetool:start')
      await wrapper.start();
    else if (arg0 === 'thetool:stop')
      await wrapper.stop();
    else
      return;
    await connection.send('Runtime.callFunctionOn', {
      functionDeclaration: (function() { this(); }).toString(),
      objectId: message.args[1].objectId
    });
  });

  await connection.send('Runtime.enable');
  let finishedCallback;
  const finishedPromise = new Promise(resolve => finishedCallback = resolve);
  connection.on('Runtime.executionContextDestroyed', message => message.executionContextId === 1 && finishedCallback());
  await connection.send('Runtime.runIfWaitingForDebugger');
  await finishedPromise;

  if (!ondemand)
    await wrapper.stop();
  await connection.close();
}

const blacklist = new Set([
  'Waiting for the debugger to disconnect...',
  'For help, see: https://nodejs.org/en/docs/inspector',
  'For help see: https://nodejs.org/en/docs/inspector',
  'Debugger attached.'
]);

function waitForWSEndpoint(nodeProcess, callback) {
  const rl = readline.createInterface({ input: nodeProcess.stderr });

  rl.on('line', onLine);
  rl.on('close', cleanup);
  nodeProcess.on('exit', cleanup);
  nodeProcess.on('error', cleanup);

  function cleanup() {
    rl.removeListener('line', onLine);
    rl.removeListener('close', cleanup);
    nodeProcess.removeListener('exit', cleanup);
    nodeProcess.removeListener('error', cleanup);
  }

  function onLine(line) {
    const match = line.match(/^Debugger listening on (ws:\/\/.*)$/);
    if (!match) {
      if (!blacklist.has(line))
        process.stderr.write(line + '\n');
      return;
    }
    callback(match[1]);
  }
}

class Connection extends EventEmitter {
  constructor(ws) {
    super();
    this._lastId = 0;
    this._ws = ws;
    this._callbacks = new Map();
    this._ws.on('message', this._onMessage.bind(this));
  }

  async send(method, params = {}) {
    await this._readyPromise;
    const id = this._rawSend({method, params});
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, {resolve, error: new Error(), reject, method});
    });
  }

  _rawSend(message) {
    const id = ++this._lastId;
    message = JSON.stringify(Object.assign({}, message, {id}));
    this._ws.send(message);
    return id;
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

  async close() {
    this._ws.close();
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

module.exports = runTool;
