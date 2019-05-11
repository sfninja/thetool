/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const childProcess = require('child_process');
const path = require('path');
const readline = require('readline');
const url = require('url');

const chalk = require('chalk');
const cri = require('chrome-remote-interface');

const createTool = require('./Tool');

async function runTool({nodeCommandLine, toolName, outputFolder}) {
  const [nodeExecutable, ...nodeArguments] = nodeCommandLine;
  const stdio = ['inherit', 'inherit', 'pipe'];
  const env = process.env;
  if (!env.NODE_OPTIONS)
    env.NODE_OPTIONS = '';
  env.NODE_OPTIONS += ' --inspect-brk=0';
  const nodeProcess = childProcess.spawn(
    nodeExecutable,
    nodeArguments,
    {
      env,
      stdio
    }
  );
  let nodeClosed = false;
  const waitForNodeToClose = new Promise((fulfill, reject) => {
    nodeProcess.once('exit', () => {
      nodeClosed = true;
      fulfill();
    });
  });
  waitForWSEndpoint(nodeProcess, (webSocket) => runToolForProcess({webSocket, toolName, outputFolder}));
  await waitForNodeToClose;
}

async function runToolForProcess({webSocket, toolName, outputFolder}) {
  console.log(chalk.green('thetool> node process detected'));

  const port = url.parse(webSocket).port;

  const connection = await cri({port});
  const filePathPrefix = path.join(outputFolder, '' + port);
  const tool = createTool(toolName, {connection, filePathPrefix});
  await tool.before();

  const {Runtime} = connection;
  await Runtime.enable();
  let finishedCallback;
  const finishedPromise = new Promise(resolve => finishedCallback = resolve);
  Runtime.executionContextDestroyed(message => message.executionContextId === 1 && finishedCallback());
  await Runtime.runIfWaitingForDebugger();
  await finishedPromise;

  console.log(chalk.green('thetool> node process finished, tool output:'));
  await tool.after();
  await connection.close();
}

const blacklist = new Set([
  'Waiting for the debugger to disconnect...',
  'For help, see: https://nodejs.org/en/docs/inspector',
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
