/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const childProcess = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const readline = require('readline');
const url = require('url');

const GREEN_OPEN = '\u001B[32m';
const GREEN_CLOSE = '\u001B[39m';

const WebSocket = require('ws');

const createTool = require('./Tool');

async function runTool({nodeCommandLine, toolName, ondemand, outputFolder}) {
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
  waitForWSEndpoint(nodeProcess, (webSocket) => runToolForProcess({webSocket, toolName, ondemand, outputFolder}));
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

async function runToolForProcess({webSocket, toolName, ondemand, outputFolder}) {
  console.log(`${GREEN_OPEN}> node process detected${GREEN_CLOSE}`);

  const connection = new Connection(new WebSocket(webSocket));
  const port = url.parse(webSocket).port;
  const filePathPrefix = path.join(outputFolder, '' + port);
  const tool = createTool(toolName, {connection, filePathPrefix});

  if (ondemand) {
    await connection.send('Runtime.evaluate', {
      expression: `(${setupEnvironment.toString()})()`
    });
  } else {
    await tool.before();
  }

  connection.on('Runtime.consoleAPICalled', async message => {
    if (message.type !== 'debug')
      return;
    if (!message.args.length)
      return;
    const arg0 = message.args[0].value;
    if (arg0 === 'thetool:start')
      await tool.before();
    else if (arg0 === 'thetool:stop') {
      console.log(`${GREEN_OPEN}thetool> stopTheTool called, tool output:`);
      await tool.after();
      console.log(GREEN_CLOSE);
    } else
      return;
    await connection.send('Runtime.callFunctionOn', {
      functionDeclaration: (function() { this(); }).toString(),
      objectId: message.args[1].objectId
    });
  });

  await connection.send('Runtime.enable');
  let finishedCallback;
  const finishedPromise = new Promise(resolve => finishedCallback = resolve);
  connection.on('Runtime.executionContextDestroyed', message => {
    console.log(message);
    message.executionContextId === 1 && finishedCallback()
  });
  await connection.send('Runtime.runIfWaitingForDebugger');
  await finishedPromise;

  if (!ondemand) {
    console.log(`${GREEN_OPEN}thetool> node process finished, tool output:`);
    await tool.after();
    console.log(GREEN_CLOSE);
  }
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
    this._readyPromise = new Promise(resolve => this._ws.on('open', resolve));
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
};

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
