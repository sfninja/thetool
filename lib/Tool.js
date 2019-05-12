/**
 * @license Copyright 2019 Aleksei Koziatinskii All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const EventEmitter = require('events');

let lastId = 0;

class Tool extends EventEmitter {
  constructor({connection}) {
    super();
    this._connection = connection;
    this._running = 0;
    this._currentId = 0;
  }

  async before() {
    ++this._running;
    if (this._running === 1) {
      this._currentId = ++lastId;
      await this._beforeImpl();
    }
  }

  async after() {
    --this._running;
    if (this._running === 0) {
      await this._afterImpl();
      this._currentId = 0;
    }
  }

  reportStart(suggestedFileExtension, userHint) {
    if (this._currentId !== 0) {
      this.emit('reportStart', {
        id: this._currentId,
        suggestedFileExtension,
        userHint
      });
    }
  }

  reportChunk(chunk) {
    if (this._currentId !== 0) {
      this.emit('reportChunk', {
        id: this._currentId,
        chunk
      });
    }
  }

  reportFinish() {
    if (this._currentId !== 0) {
      this.emit('reportFinish', {
        id: this._currentId
      });
    }
  }
}

class MemorySamplingProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  _beforeImpl() {
    return this._connection.send('HeapProfiler.startSampling');
  }

  async _afterImpl() {
    const data = await this._connection.send('HeapProfiler.stopSampling');
    this.reportStart('heapprofile', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    this.reportChunk(JSON.stringify(data.profile));
    this.reportFinish();
  }
}

class MemoryAllocationProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  _beforeImpl() {
    this.reportStart('heaptimeline', 'You can use Chrome DevTools Memory tab to load and analyze it.');
    this._connection.on('HeapProfiler.addHeapSnapshotChunk', m => this.reportChunk(m.chunk));
    return this._connection.send('HeapProfiler.startTrackingHeapObjects', { trackAlocations: false});
  }

  async _afterImpl() {
    await this._connection.send('HeapProfiler.stopTrackingHeapObjects');
    this.reportFinish();
  }
}

class CoverageProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startPreciseCoverage');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.takePreciseCoverage');
    await this._connection.send('Profiler.stopPreciseCoverage');
    this.reportStart('coverage', 'You can use c8 npm package to analyze this data, put file with data to ./coverage/tmp and run \'c8 report\'');
    this.reportChunk(JSON.stringify(data));
    this.reportFinish();
  }
}

class CPUProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.start');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.stop');
    this.reportStart('cpuprofile', 'You can use Chrome DevTools Performance tab to load and analyze it.');
    this.reportChunk(JSON.stringify(data.profile));
    this.reportFinish();
  }
}

class TypeProfiler extends Tool {
  constructor(options) {
    super(options);
  }

  async _beforeImpl() {
    await this._connection.send('Profiler.enable');
    await this._connection.send('Profiler.startTypeProfile');
  }

  async _afterImpl() {
    const data = await this._connection.send('Profiler.takeTypeProfile');
    await this._connection.send('Profiler.stopTypeProfile');
    this.reportStart('typeprofile', 'Unfortunately there is no nice visualization tool yet. Please build one and add it here.');
    this.reportChunk(JSON.stringify(data));
    this.reportFinish();
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
