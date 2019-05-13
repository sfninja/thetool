/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

class MemorySamplingProfiler {
  constructor({connection}) {
    this._connection = connection;
  }

  before(reporter) {
    reporter.reportStart('heapprofile', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    return this._connection.send('HeapProfiler.startSampling');
  }

  async after(reporter) {
    const data = await this._connection.send('HeapProfiler.stopSampling');
    reporter.reportChunk(JSON.stringify(data.profile));
    reporter.reportFinish();
  }
}

class MemoryAllocationProfiler {
  constructor({connection}) {
    this._connection = connection;
  }

  before(reporter) {
    reporter.reportStart('heaptimeline', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    this._connection.on('HeapProfiler.addHeapSnapshotChunk', m => reporter.reportChunk(m.chunk));
    return this._connection.send('HeapProfiler.startTrackingHeapObjects', { trackAlocations: false});
  }

  async after(reporter) {
    await this._connection.send('HeapProfiler.stopTrackingHeapObjects');
    reporter.reportFinish();
  }
}

class CoverageProfiler {
  constructor({connection}) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('coverage', 'You can use c8 npm package to analyze this data, put file with data to ./coverage/tmp and run \'c8 report\'');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startPreciseCoverage');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.takePreciseCoverage');
    await this._connection.send('Profiler.stopPreciseCoverage');
    reporter.reportChunk(JSON.stringify(data));
    reporter.reportFinish();
  }
}

class CPUProfiler {
  constructor({connection}) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('cpuprofile', 'You can use Chrome DevTools Performance tab to load and analyze it.');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.start');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.stop');
    reporter.reportChunk(JSON.stringify(data.profile));
    reporter.reportFinish();
  }
}

class TypeProfiler {
  constructor({connection}) {
    this._connection = connection;
  }

  async before(reporter) {
    reporter.reportStart('typeprofile', 'Unfortunately there is no nice visualization tool yet. Please build one and add it here.');
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startTypeProfile');
  }

  async after(reporter) {
    const data = await this._connection.send('Profiler.takeTypeProfile');
    await this._connection.send('Profiler.stopTypeProfile');
    reporter.reportChunk(JSON.stringify(data));
    reporter.reportFinish();
  }
}

function createTool(name, options) {
  if (name === 'memorysampling')
    return new MemorySamplingProfiler(options);
  if (name === 'memoryallocation')
    return new MemoryAllocationProfiler(options);
  if (name === 'coverage')
    return new CoverageProfiler(options);
  if (name === 'cpu')
    return new CPUProfiler(options);
  if (name === 'type')
    return new TypeProfiler(options);
}

module.exports = createTool;
