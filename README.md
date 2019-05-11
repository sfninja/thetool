# thetool

<!-- [START badges] -->
[![NPM thetool package](https://img.shields.io/npm/v/thetool.svg)](https://npmjs.org/package/thetool)
<!-- [END badges] -->

> thetool is a CLI tool to capture different cpu, memory and other profiles for your node app in Chrome DevTools friendly format.

## Quick start
```bash
npx thetool -o . -t cpu npm run test
```

## Installation

```bash
# global install with npm:
npm install -g thetool

# alternatively, with yarn:
yarn global add thetool
```

## Getting Started

> thetool works only with Node >= 10.x.

Backed command example:
```bash
thetool -o . -t cpu npm run test
```

thetool interface is simple as 1-2-3.
1. Specify output folder for captured data using `-o` flag, e.g. `-o .` to put output in current folder.
2. Specify tool name using `-t`, currently supported tools: CPU profiler (cpu), Sampling Memory Profiler (memorysampling), Allocation Memory Profiler (memoryallocation), Coverage Profiler (coverage), Type Profiler (type), you can find a little bit more details below about each of them.
3. Put any command that runs node process after arguments, e.g. `node index.js` or `npx thetool` or `npm run test`, .. thetool supports child processes.

During its work thetool will dump two kind of messages: `thetool> node process detected` and `thetool> node process finished, tool output:`. Second type of message contains some information about how to use captured data as well.

## Tools

### CPU Profiler

```bash
thetool -o . -t cpu npm run test
```

To analyze: open Chrome DevTools, to to Performance tab, click load button, select file with data.

### Sampling Memory Profiler

```bash
thetool -o . -t memorysampling npm run test
```

To analyze: open Chrome DevTools, go to Memory tab, click load button, select file with data.

### Allocation Memory Profiler

```bash
thetool -o . -t memoryallocation npm run test
```

To analyze: open Chrome DevTools, go to Memory tab, click load button, select file with data.

### Coverage Profiler

```bash
thetool -o . -t coverage npm run test
```

To analyze: in current folder create ./coverage/tmp folder and move files with data to this folder, run [c8](https://www.npmjs.com/package/c8): `npx c8 report`. Please take a look at c8 README.md to see what output formats are supported.

### Type Profiler

```bash
thetool -o . -t type npm run test
```

To analyze: please build something and I will put it here.
