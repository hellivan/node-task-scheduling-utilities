/* eslint-disable */
const { isMainThread, parentPort } = require('worker_threads');
const vm = require('vm');

if (isMainThread) throw new Error('Cannot import worker-script into main thread!');

function createExexcutionContextBase(executionContext) {
    return vm.createContext({
        ...executionContext
    });
}

if (parentPort != null) {
    parentPort.on('message', (message) => {
        const { script, context } = message;

        const executionContext = createExexcutionContextBase(context);
        const pipelineScript = new vm.Script(script);

        try {
            const result = pipelineScript.runInContext(executionContext);
            parentPort.postMessage(result);
        } catch (err) {
            throw new Error(`Script-Execution-Error: ${err.message}`);
        }
    });
} else {
    throw new Error('No parent port found!');
}
