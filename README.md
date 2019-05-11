# thetool

<!-- [START badges] -->
[![NPM thetool package](https://img.shields.io/npm/v/thetool.svg)](https://npmjs.org/package/thetool)
<!-- [END badges] -->

> thetool is CLI app to extract a lot of different information out of node processes

## Installation

```bash
# global install with npm:
npm install -g thetool

# alternatively, with yarn:
yarn global add thetool

# or just use npx
npx thetool -o . -t cpu npm run test
```

## Getting Started

thetool interface is simple as 1-2-3.
1. Specify output folder for captured data using `-o` flag, e.g. `-o .` to put output in current folder.
2. Specify tool name using `-t`, currently supported tools: CPU profiler (cpu), Sampling Memory Profiler (memorysampling), Allocation Memory Profiler (memoryallocation), Coverage Profiler (coverage), Type Profiler (type), you can find a little bit more details below about each of them.
3. Put any command that runs node process after arguments, e.g. `node index.js` or `npx thetool` or `npm run test`, .. thetool supports child processes.

Result command should look like following one:

```bash
thetool -o . -t cpu npm run test
```

During its work thetool will dump two kind of messages: `thetool> node process detected` and `thetool> node process finished, tool output:`. Second type of message contains some information about how to use captured data as well.

## Tools

### CPU Profiler

```bash
thetool -o . -t cpu npm run test
```

The easiest way to analyze this data is to use Chrome DevTools Performance tab. Go to this tab, find load button (that is located in top left corner), select file with data.

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

To analyze: in current folder create ./coverage/tmp folder and move files with data to this folder, run [c8](https://www.npmjs.com/package/c8): `c8 report` or `npx c8 report`. Please take a look c8 README file to see what report format options are available.

### Type Profiler

```bash
thetool -o . -t type npm run test
```

Unfortunately I do not know any good tool to visualize this data. Feel free to create PR to add it here!
