export type TeardownLogic = () => void;

// TODO: test
export class IdleWorkerDescription<TWorker> {
    private readonly timeoutTimer: NodeJS.Timeout | undefined;
    private readonly teardownLogics: Array<TeardownLogic> = [];

    constructor(public readonly worker: TWorker, idleTimeout?: number) {
        if (idleTimeout != null) {
            this.timeoutTimer = setTimeout(
                () => this.teardownLogics.forEach((teardownLogic) => teardownLogic()),
                idleTimeout
            );
        }
    }

    public addTeardownLogic(teardownLogic: () => void): void {
        this.teardownLogics.push(teardownLogic);
    }

    public cancelIdleTimeout(): void {
        if (this.timeoutTimer != null) {
            clearTimeout(this.timeoutTimer);
        }
    }
}
