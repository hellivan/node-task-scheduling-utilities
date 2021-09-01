export class ExecutionTimeoutError extends Error {
    public readonly code = 'NTSU_EXEC_TIMEOUT';

    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ExecutionTimeoutError.prototype);
    }
}
