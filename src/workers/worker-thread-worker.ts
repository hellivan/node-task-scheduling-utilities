import { Worker } from 'worker_threads';
import { Subject, Observable } from 'rxjs';

import { EventRegistrationList } from './event-registration-list';
import { TimerEventRegistration } from './timer-event-registration';

export interface WorkerThreadTask<TData> {
    readonly timeout: number;
    readonly data: TData;
}

interface WorkerInstance<TWorker> {
    readonly worker: TWorker;
    readonly eventRegistrations: EventRegistrationList;
}

export class WorkerThreadWorker<TData, TResult, TTask extends WorkerThreadTask<TData>> {
    public readonly error$: Observable<Error>;

    private workerInstance: WorkerInstance<Worker> | undefined;
    private working = false;
    private disposed = false;
    private readonly errorsSubject = new Subject<Error>();

    constructor(private readonly workerScriptPath: string) {
        this.error$ = this.errorsSubject.asObservable();
    }

    public async executeTask({ timeout, data }: TTask): Promise<TResult> {
        if (this.working) throw new Error('Worker busy. Cannot execute mutiple tasks in parallel!');
        this.working = true;

        try {
            const worker = this.getWorker();

            const resultPromise = new Promise<TResult>((resolve, reject) => {
                const eventRegistrationsList = new EventRegistrationList();

                const onMessage = (message: TResult): void => {
                    eventRegistrationsList.unregisterAll();
                    resolve(message);
                };

                const onError = (err: Error): void => {
                    eventRegistrationsList.unregisterAll();
                    reject(err);
                };

                const onExit = (code: number): void => {
                    eventRegistrationsList.unregisterAll();
                    reject(new Error(`Worker terminated with code ${code}`));
                };

                eventRegistrationsList.push(
                    new TimerEventRegistration(() => {
                        eventRegistrationsList.unregisterAll();
                        // NOTE: terminateWorker will never reject. Hence we can do not have to catch rejection here
                        this.terminateWorker();
                        const timeoutError = new Error(`Worker execution timed out after ${timeout} ms`);
                        this.errorsSubject.next(timeoutError);
                        reject(timeoutError);
                    }, timeout)
                );

                eventRegistrationsList.push({
                    register: () => worker.on('message', onMessage),
                    unregister: () => worker.removeListener('message', onMessage)
                });

                eventRegistrationsList.push({
                    register: () => worker.on('error', onError),
                    unregister: () => worker.removeListener('error', onError)
                });

                eventRegistrationsList.push({
                    register: () => worker.on('exit', onExit),
                    unregister: () => worker.removeListener('exit', onExit)
                });

                eventRegistrationsList.registerAll();
            });

            worker.postMessage(data);

            return await resultPromise;
        } finally {
            this.working = false;
        }
    }

    public async dispose(): Promise<void> {
        this.disposed = true;
        await this.terminateWorker();
    }

    public async terminateWorker(): Promise<void> {
        if (this.workerInstance != null) {
            this.workerInstance.eventRegistrations.unregisterAll();

            const terminationPromise = this.workerInstance.worker
                .terminate()
                .catch((err) => this.errorsSubject.next(new Error(`Error while terminating worker: ${err.message}`)));

            this.workerInstance = undefined;
            await terminationPromise;
        }
    }

    private getWorker(): Worker {
        if (this.disposed) throw new Error('Cannot get worker in a disposed WorkerThreadWorker!');

        if (this.workerInstance == null) {
            const newWorker = new Worker(this.workerScriptPath);
            const eventRegistrationsList = new EventRegistrationList();

            const onError = (err: Error): void => {
                eventRegistrationsList.unregisterAll();
                this.workerInstance = undefined;
                this.errorsSubject.next(new Error(`Worker failed with error: ${err.message}`));
            };

            const onExit = (code: number): void => {
                eventRegistrationsList.unregisterAll();
                this.workerInstance = undefined;
                if (code !== 0) {
                    this.errorsSubject.next(new Error(`Worker terminated with exit code ${code}!`));
                } else {
                    this.errorsSubject.next(
                        new Error(`Worker terminated gracefully. This hould not happen in a WorkerThreadWorker!`)
                    );
                }
            };

            eventRegistrationsList.push({
                register: () => newWorker.on('error', onError),
                unregister: () => newWorker.removeListener('error', onError)
            });

            eventRegistrationsList.push({
                register: () => newWorker.on('exit', onExit),
                unregister: () => newWorker.removeListener('exit', onExit)
            });

            eventRegistrationsList.registerAll();

            this.workerInstance = {
                worker: newWorker,
                eventRegistrations: eventRegistrationsList
            };
        }
        return this.workerInstance.worker;
    }
}
