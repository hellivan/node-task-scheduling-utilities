import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, filter, first } from 'rxjs/operators';

import { ObservableQueue } from '../data-structures';
import { WorkerFactory } from '../worker-factory';
import { AbstractWorkerPool, AbstractWorkerPoolWorker } from './abstract-worker-pool';

export interface DynamicWorkerPoolWorker<TTask, TResult> extends AbstractWorkerPoolWorker<TTask, TResult> {
    dispose(): Promise<void>;
}

export class DynamicWorkerPool<
    TTask,
    TResult,
    TWorker extends DynamicWorkerPoolWorker<TTask, TResult>
> extends AbstractWorkerPool<TTask, TResult, TWorker> {
    public readonly error$: Observable<Error>;
    public readonly size$: Observable<number>;
    public readonly availableWorkers$: Observable<number>;
    public readonly idleWorkers$: Observable<number>;
    public readonly busyWorkers$: Observable<number>;

    // NOTE: we need a subject that holds poolsize. This is because using busyWorkers.size$ + idleWorkers.size$
    // would not behave correct when moving elements from one queue into another. In this moment size would be
    // realworkercount +-1 since one worker is either in both queues or in none of them
    private readonly sizeSubject = new BehaviorSubject<number>(0);
    private readonly availableWorkersSubject: BehaviorSubject<number>;
    private readonly errorSubject = new Subject<Error>();
    private readonly busyWorkersQueue = new ObservableQueue<TWorker>();
    private readonly idleWorkersQueue = new ObservableQueue<TWorker>();
    private stopped = false;

    constructor(
        private readonly workerFactory: WorkerFactory<TWorker>,
        private readonly minSize: number,
        private readonly maxSize: number
    ) {
        super();

        this.availableWorkersSubject = new BehaviorSubject<number>(this.maxSize);
        this.availableWorkers$ = this.availableWorkersSubject.pipe(distinctUntilChanged());
        this.error$ = this.errorSubject.asObservable();
        this.idleWorkers$ = this.idleWorkersQueue.size$;
        this.busyWorkers$ = this.busyWorkersQueue.size$;
        this.size$ = this.sizeSubject.pipe(distinctUntilChanged());
    }

    public get size(): number {
        return this.sizeSubject.value;
    }

    public get availableWorkers(): number {
        return this.availableWorkersSubject.value;
    }

    public get idleWorkers(): number {
        return this.idleWorkersQueue.size;
    }

    public get busyWorkers(): number {
        return this.busyWorkersQueue.size;
    }

    public async stop(): Promise<void> {
        this.stopped = true;

        await this.busyWorkers$
            .pipe(
                filter((x) => x === 0),
                first()
            )
            .toPromise();

        const existingWorkers = this.idleWorkersQueue.clear();
        this.updatePoolSize();
        this.updateAvailableWorkers();
        await Promise.all(existingWorkers.map((w) => this.safeDispose(w)));
    }

    protected aquireWorker(): TWorker {
        if (this.stopped) {
            throw new Error('Cannot aquire worker from stopped worker pool!');
        } else if (this.idleWorkersQueue.size > 0) {
            const worker = this.idleWorkersQueue.dequeue();
            this.busyWorkersQueue.enqueue(worker);
            // NOTE: poolsize did not change since we reused an existing worker -> no need to update poolsize
            this.updateAvailableWorkers();
            return worker;
        } else if (this.size < this.maxSize) {
            const worker = this.workerFactory.createWorker();
            this.busyWorkersQueue.enqueue(worker);
            this.updatePoolSize();
            this.updateAvailableWorkers();
            return worker;
        } else {
            throw new Error(`No free workers available in worker pool of max-size ${this.maxSize}`);
        }
    }

    protected releaseWorker(worker: TWorker): void {
        const currentWorkersCount = this.size;
        this.busyWorkersQueue.drop(worker);
        if (currentWorkersCount > this.minSize) {
            // NOTE: safeDispose will never reject -> leave promise uncatched is safe
            this.safeDispose(worker);
            this.updatePoolSize();
        } else {
            this.idleWorkersQueue.enqueue(worker);
            // NOTE: poolsize did not change since we standbyed an existing worker -> no need to update poolsize
        }
        this.updateAvailableWorkers();
    }

    private async safeDispose(worker: TWorker): Promise<void> {
        try {
            await worker.dispose();
        } catch (err) {
            this.errorSubject.next(new Error(`Error while disposing worker-pool worker: ${err.message}`));
        }
    }

    private updatePoolSize(): void {
        const poolSize = this.idleWorkersQueue.size + this.busyWorkersQueue.size;
        this.sizeSubject.next(poolSize);
    }

    private updateAvailableWorkers(): void {
        if (this.stopped) {
            this.availableWorkersSubject.next(0);
        } else {
            this.availableWorkersSubject.next(this.maxSize - this.busyWorkersQueue.size);
        }
    }
}
