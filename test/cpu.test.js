/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const runTool = require('../lib/Runner');
const createTool = require('../lib/Tool');

class ReportWriter {
  constructor() {
    this._reports = new Map();
  }

  async reportEventCallback(event, data) {
    if (event === 'reportStart') {
      const report = {data: '', finished: false};
      this._reports.set(data.id, report);
    } else if (event === 'reportChunk') {
      const report = this._reports.get(data.id);
      report.data += data.chunk;
    } else if (event === 'reportFinish') {
      const report = this._reports.get(data.id);
      report.finished = true;
    }
  }

  reports() {
    return Array.from(this._reports.values());
  }
}

test('basic', async() => {
  const writer = new ReportWriter();
  await runTool({
    nodeCommandLine: ['node', '-e', ''],
    toolFactory: createTool.bind(null, 'cpu'),
    ondemand: false,
    callback: writer.reportEventCallback.bind(writer)
  });
  const reports = writer.reports();
  expect(reports.length).toBe(1);
  expect(reports[0].finished).toBe(true);
  const data = JSON.parse(reports[0].data);
  expect(data.nodes.some(node => node.callFrame.url.startsWith('internal/bootstrap/'))).toBe(true);
});

test('ondemand', async() => {
  async function main() {
    for (let i = 0; i < 3; ++i) {
      await startTheTool();
      sleepA(50);
      await stopTheTool();
      sleepB(50);
    }

    function sleepA(ms) {
      const st = Date.now();
      while (Date.now() < st + ms);
    }

    function sleepB(ms) {
      const st = Date.now();
      while (Date.now() < st + ms);
    }
  }

  const writer = new ReportWriter();
  await runTool({
    nodeCommandLine: ['node', '-e', `(${main.toString()})()`],
    toolFactory: createTool.bind(null, 'cpu'),
    ondemand: true,
    callback: writer.reportEventCallback.bind(writer)
  });
  const reports = writer.reports();
  expect(reports.length).toBe(3);
  for (const report of reports) {
    expect(report.finished).toBe(true);
    const data = JSON.parse(report.data);
    expect(data.nodes.some(node => node.callFrame.functionName === 'sleepA')).toBe(true);
    expect(data.nodes.some(node => node.callFrame.functionName === 'sleepB')).toBe(false);
  }
});

