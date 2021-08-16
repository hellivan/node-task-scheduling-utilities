import {
    BehaviorSubject,
    distinctUntilChanged,
    filter,
    firstValueFrom,
    mapTo,
    merge as observableMerge,
    Observable,
    of as observableOf,
    Subject,
    Subscription
} from 'rxjs';

import { LimitedObservableQueue } from '../data-structures';

export interface Task {
    exec: () => Promise<void>;
}

export class QdScheduler<TTask extends Task> {
    public readonly taskQueued$: Observable<TTask>;
    public readonly taskStarting$: Observable<TTask>;
    public readonly taskError$: Observable<{ err: Error; task: TTask }>;
    public readonly taskCompleted$: Observable<TTask>;

    public readonly size$: Observable<number>;
    public readonly queuedTasksCount$: Observable<number>;
    public readonly runningTasksCount$: Observable<number>;

    private readonly runningTasks: LimitedObservableQueue<TTask>;
    private readonly queuedTasks: LimitedObservableQueue<TTask>;

    private readonly taskQueuedSubject = new Subject<TTask>();
    private readonly taskStartingSubject = new Subject<TTask>();
    private readonly taskErrorSubject = new Subject<{ err: Error; task: TTask }>();
    private readonly taskCompletedSubject = new Subject<TTask>();
    private readonly sizeSubject = new BehaviorSubject<number>(0);

    private executionSubscription: Subscription | undefined;

    constructor(maxParallelTasks: number, maxQueuedTasks: number) {
        this.runningTasks = new LimitedObservableQueue<TTask>(maxParallelTasks);
        this.queuedTasks = new LimitedObservableQueue<TTask>(maxQueuedTasks);

        this.taskQueued$ = this.taskQueuedSubject.asObservable();
        this.taskStarting$ = this.taskStartingSubject.asObservable();
        this.taskError$ = this.taskErrorSubject.asObservable();
        this.taskCompleted$ = this.taskCompletedSubject.asObservable();

        this.size$ = this.sizeSubject.pipe(distinctUntilChanged());
        this.queuedTasksCount$ = this.queuedTasks.size$;
        this.runningTasksCount$ = this.runningTasks.size$;
    }

    public setMaxParallelTasks(count: number): void {
        this.runningTasks.setMaxSize(count);
    }

    public setMaxQueuedTasks(count: number): void {
        this.queuedTasks.setMaxSize(count);
    }

    public queueTask(t: TTask): void {
        this.queuedTasks.enqueue(t);
        this.updateSize();
        this.taskQueuedSubject.next(t);
    }

    public get size(): number {
        return this.sizeSubject.value;
    }

    public get stopped(): boolean {
        return this.executionSubscription == null;
    }

    public get runningTasksCount(): number {
        return this.runningTasks.size;
    }

    public get queuedTasksCount(): number {
        return this.queuedTasks.size;
    }

    public async workeredOff(): Promise<void> {
        await firstValueFrom(this.size$.pipe(filter((size) => size === 0)));
    }

    public start(): void {
        if (this.executionSubscription != null) {
            throw new Error('Scheduler already started. Cannot start scheduler twice!');
        }
        this.executionSubscription = observableMerge(
            this.taskCompletedSubject.pipe(mapTo(true)),
            this.taskQueuedSubject.pipe(mapTo(true)),
            observableOf(true)
        ).subscribe(() => this.executeTasks());
    }

    public stop(): void {
        if (this.executionSubscription != null) {
            this.executionSubscription.unsubscribe();
            this.executionSubscription = undefined;
        }
    }

    private executeTasks(): void {
        while (this.runningTasks.freeSlots > 0 && !this.queuedTasks.empty) {
            const task = this.queuedTasks.dequeue();
            this.runningTasks.enqueue(task);
            // NOTE: we just moved a task from one queue into another -> size did not change -> no need to updateSize
            this.taskStartingSubject.next(task);

            Promise.resolve()
                .then(() => task.exec())
                .catch((err) => this.taskErrorSubject.next({ err, task }))
                .then(() => {
                    this.runningTasks.drop(task);
                    this.updateSize();
                    this.taskCompletedSubject.next(task);
                });
        }
    }

    private updateSize(): void {
        const size = this.queuedTasks.size + this.runningTasks.size;
        this.sizeSubject.next(size);
    }
}
