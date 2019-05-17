/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const childProcess = require('child_process');
const readline = require('readline');

const { WebSocketTransport, WorkerTransport, Connection } = require('./Connection');

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

  capture() {
    const reportWrapper = new ReportWrapper(++ToolWrapper._lastId, this._callback);
    return this._tool.capture(reportWrapper);
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

async function setupOnDemand(connection, wrapper) {
  function setupEnvironment() {
    const nativeConsoleDebug = console.debug;
    function sendCommand(command) {
      let resolveCallback;
      const promise = new Promise(resolve => resolveCallback = resolve);
      const id = setTimeout(resolve, 30000);
      function resolve() {
        resolveCallback();
        clearTimeout(id);
      }
      nativeConsoleDebug(command, resolve);
      return promise;
    }
    this.startTheTool = sendCommand.bind(null, 'thetool:start');
    this.stopTheTool = sendCommand.bind(null, 'thetool:stop');
    this.captureTheTool = sendCommand.bind(null, 'thetool:capture');
  }

  await connection.send('Runtime.evaluate', {
    expression: `(${setupEnvironment.toString()})()`
  });
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
    else if (arg0 === 'thetool:capture')
      await wrapper.capture();
    else
      return;
    await connection.send('Runtime.callFunctionOn', {
      functionDeclaration: (function() { this(); }).toString(),
      objectId: message.args[1].objectId
    });
  });
}

async function runToolForProcess({webSocket, toolFactory, ondemand, callback}) {
  const connection = new Connection(await WebSocketTransport.create(webSocket));
  const tool = toolFactory(connection);
  const wrapper = new ToolWrapper(tool, callback);
  if (ondemand) {
    await setupOnDemand(connection, wrapper);
    await connection.send('NodeWorker.enable', {
      waitForDebuggerOnStart: true
    });
    connection.on('NodeWorker.attachedToWorker', ({sessionId}) => runToolForWorker({
      connection,
      sessionId,
      toolFactory,
      callback,
      wrapper: tool.onlyMain() ? wrapper : null
    }));
  } else {
    await wrapper.start();
  }

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

async function runToolForWorker({connection: mainConnection, sessionId, toolFactory, wrapper, callback}) {
  const connection = new Connection(new WorkerTransport(mainConnection, sessionId));
  wrapper = wrapper || new ToolWrapper(toolFactory(connection), callback);
  await setupOnDemand(connection, wrapper);
  await connection.send('Runtime.enable');
  await connection.send('Runtime.runIfWaitingForDebugger', {});
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

module.exports = runTool;
