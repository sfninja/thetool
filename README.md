# thetool

<!-- [START badges] -->
[![Build Status](https://img.shields.io/travis/com/ak239/thetool/master.svg)](https://travis-ci.com/ak239/thetool)
[![NPM thetool package](https://img.shields.io/npm/v/thetool.svg)](https://npmjs.org/package/thetool)
<!-- [END badges] -->

> thetool is a CLI tool to capture different cpu, memory and other profiles for your node app in Chrome DevTools friendly format.

## Quick start
```bash
npx thetool -o . -t memorysampling npm run test
# .. open DevTools frontend and do three clicks to get:
```
<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388239-f9d25580-8024-11e9-8d35-a7ce4f6a4137.png">

## Getting Started

> thetool works only with Node >= 10.x.

thetool interface is simple as 1-2-3.
1. Specify **output folder using `-o`** flag, e.g. `-o .` to put output in current folder.
2. Specify **tool using `-t`**, available tools: [cpu](https://github.com/ak239/thetool#cpu-profiler), [memorysampling](https://github.com/ak239/thetool#sampling-memory-profiler), [memoryallocation](https://github.com/ak239/thetool#allocation-memory-profiler), [coverage](https://github.com/ak239/thetool#coverage-profiler), [type](https://github.com/ak239/thetool#type-profiler), [heapsnapshot](https://github.com/ak239/thetool#heap-snapshot-tool).
3. Specify **any command to start node**, e.g. `node index.js` or `npx thetool` or `npm run test`.

When report is ready, thetool will dump `thetool> Report captured in ...` message in terminal with a hint how to analyze it.

## Why not to use Chrome DevTools directly?
- it can be used in environments where it is not possible to run Chrome DevTools, e.g., on the server, run `thetool <yourapp>` there, send report back and analyze it locally,
- it supports child processes and workers,
- it supports some other tools, e.g., node tracing and type profiler.

## Tool selector

| Problem | Tool | Insight | DevTools tab |
|-|-|-|-|
| my app is slow | [cpu](https://github.com/ak239/thetool#cpu-profiler) | where in code does app spend most time? | Performance |
| my app requires too much memory | [memorysampling](https://github.com/ak239/thetool#sampling-memory-profiler) | where in code does app allocate most memory? | Memory |
| my app requires too much memory | [memoryallocation](https://github.com/ak239/thetool#allocation-memory-profiler) | most precise version of memorysampling with much bigger overhead | Memory |
| my app requires too much memory | [heapsnapshot](https://github.com/ak239/thetool#heap-snapshot-tool) | what is inside the heap right now? | Memory |
| my app package is too big | [coverage](https://github.com/ak239/thetool#coverage-profiler) | what code was executed and how many times? | |
| my app needs type annotations | [type](https://github.com/ak239/thetool#type-profiler) | what are the types of function arguments and returns? | |

## On-demand tooling

You can use `--ondemand` flag to profile only part of your app:
1. Add `--ondemand` flag to the list of thetool arguments.
2. Call `startTheTool/stopTheTool` from your Node scripts (thetool will add these methods to Node context).

`startTheTool/stopTheTool` methods are asynchronous, so you should await them or chain them using `promise.then`

Couple examples:
```js
async function main() {
  await startTheTool();
  // code of your app
  await stopTheTool();
}
// .. or using promises..
function main() {
  startTheTool().then(() => {
    // code of your app
  }).then(() => stopTheTool());
}
```

## CPU: Profiler

```bash
thetool -o . -t cpu npm run test
```

To analyze: open Chrome DevTools, to to Performance tab, click load button, select file with data.

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388318-f55a6c80-8025-11e9-9826-6432b588ed84.png">

## Memory: Sampling Profiler

```bash
thetool -o . -t memorysampling npm run test
```

To analyze: open Chrome DevTools, go to Memory tab, click load button, select file with data.

`--samplingInterval` option is available: average sample interval in bytes, poisson distribution is used for the intervals. The default value is 32768 bytes

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388239-f9d25580-8024-11e9-8d35-a7ce4f6a4137.png">

## Memory: Allocation Profiler

```bash
thetool -o . -t memoryallocation npm run test
```

To analyze: open Chrome DevTools, go to Memory tab, click load button, select file with data.

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388341-4cf8d800-8026-11e9-9ac5-429a33523ea0.png">

## Memory: Heap Snapshot

```bash
thetool -o . -t heapsnapshot node -e "captureTheTool.then(captureTheTool).then(captureTheTool)"
```

Given command will capture three heap snapshots.
To analyze: open Chrome DevTools, go to Memory tab, click load button, select file with data. You can load multiple snapshots and compare them from DevTools UI.

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388382-c264a880-8026-11e9-92c9-b455d05b89c4.png">

## Tracing

```bash
thetool -o . -t tracing --recordMode recordAsMuchAsPossible --includedCategories node,v8 npm run test
```

To analyze: open Chrome DevTools, go to Performance tab, click load button, select file with data.

`--recordMode` controls how the trace buffer stores data (recordUntilFull, recordContinuously, recordAsMuchAsPossible)
`--includedCategories` please take a look on different available categories on https://nodejs.org/api/tracing.html

E.g. you can capture V8 sampling profiler using following command:
```bash
thetool -o . -t tracing --recordMode recordAsMuchAsPossible --includedCategories v8.execute,v8.cpu_profiler,v8.cpu_profiler.hires npm run test
```

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388415-1ec7c800-8027-11e9-9299-165a24dd6cdb.png">

## Coverage Profiler

```bash
thetool -o . -t coverage npm run test
```

To analyze: in current folder create ./coverage/tmp folder and move files with data to this folder, run [c8](https://www.npmjs.com/package/c8): `npx c8 report`. Please take a look at c8 README.md to see what output formats are supported.

<img width="1059" alt="Screen Shot 2019-05-27 at 2 10 14 AM" src="https://user-images.githubusercontent.com/426418/58388465-e2e13280-8027-11e9-9a75-e2d278d984c7.png">

## Type Profiler

```bash
thetool -o . -t type npm run test
```

To analyze: no tool yet.
