import { QdScheduler } from './qd-scheduler';
import { first, bufferCount } from 'rxjs/operators';

describe('QdScheduler', () => {
    test('calling start on a started scheduler should throw an error', () => {
        const scheduler = new QdScheduler(0, 0);
        scheduler.start();
        expect(() => scheduler.start()).toThrowError('Scheduler already started. Cannot start scheduler twice!');
    });

    test('size of a new scheduler should be 0', () => {
        const scheduler = new QdScheduler(10, 200);
        expect(scheduler.size).toEqual(0);
    });

    test('queueTask should throw an error if taskqueue is full', () => {
        const scheduler = new QdScheduler(0, 1);
        scheduler.queueTask({ exec: () => Promise.resolve() });
        expect(() => scheduler.queueTask({ exec: () => Promise.resolve() })).toThrowError(
            'Queue full! Cannot enqueue any more items!'
        );
    });

    test('start should start tasks execution', async () => {
        const scheduler = new QdScheduler(1, 2);

        const execSpy = jest.fn().mockImplementation(() => Promise.resolve());
        scheduler.queueTask({ exec: execSpy });
        scheduler.queueTask({ exec: execSpy });

        await new Promise((resolve) => setImmediate(resolve));

        expect(execSpy).toHaveBeenCalledTimes(0);
        scheduler.start();

        await scheduler.workeredOff();

        expect(execSpy).toHaveBeenCalledTimes(2);
    });

    test('failing tasks should emit on taskError$ and taskCompleted$', async () => {
        const scheduler = new QdScheduler(1, 2);
        const testError = new Error('TaskError');
        const testTask = { exec: (): Promise<void> => Promise.reject(testError) };

        const completedPromise = scheduler.taskCompleted$.pipe(first()).toPromise();
        const errorPromise = scheduler.taskError$.pipe(first()).toPromise();

        scheduler.queueTask(testTask);

        scheduler.start();

        await scheduler.workeredOff();

        expect(await completedPromise).toEqual(testTask);
        expect(await errorPromise).toEqual({ task: testTask, err: testError });
    });

    test('taskQueued$ should emit queued tasks', async () => {
        const scheduler = new QdScheduler(1, 2);
        const queuedPromise = scheduler.taskQueued$.pipe(bufferCount(2), first()).toPromise();

        const testTask1 = { exec: (): Promise<void> => Promise.resolve() };
        const testTask2 = { exec: (): Promise<void> => Promise.reject() };

        scheduler.queueTask(testTask1);
        scheduler.queueTask(testTask2);

        expect(await queuedPromise).toEqual([testTask1, testTask2]);
    });

    test('taskStarting$ should emit started tasks', async () => {
        const scheduler = new QdScheduler(1, 2);
        const startingPromise = scheduler.taskStarting$.pipe(bufferCount(2), first()).toPromise();

        const testTask1 = { exec: (): Promise<void> => Promise.resolve() };
        const testTask2 = { exec: (): Promise<void> => Promise.reject() };

        scheduler.queueTask(testTask1);
        scheduler.queueTask(testTask2);

        scheduler.start();
        await scheduler.workeredOff();

        expect(await startingPromise).toEqual([testTask1, testTask2]);
    });

    test('workeredOff should resolve if all tasks are completed and no tasks are waiting to be scheduled', async () => {
        const scheduler = new QdScheduler(1, 2);
        await scheduler.workeredOff();
        expect(scheduler.size).toEqual(0);

        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);
        expect(scheduler.size).toEqual(2);

        scheduler.start();

        await scheduler.workeredOff();
        expect(scheduler.size).toEqual(0);
    });

    test('size$ should emit the current task count in the queue', async () => {
        const scheduler = new QdScheduler(1, 2);

        const sizePromise = scheduler.size$.pipe(bufferCount(5), first()).toPromise();

        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();

        expect(await sizePromise).toEqual([0, 1, 2, 1, 0]);
    });

    test('size should returnt the current task count in the queue', async () => {
        const scheduler = new QdScheduler(1, 2);

        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        expect(scheduler.size).toEqual(0);

        scheduler.queueTask(testTask);
        expect(scheduler.size).toEqual(1);

        scheduler.queueTask(testTask);
        expect(scheduler.size).toEqual(2);

        scheduler.start();
        await scheduler.workeredOff();

        expect(scheduler.size).toEqual(0);
    });

    test('queuedTasksCount$ should emit the number of queued tasks', async () => {
        const scheduler = new QdScheduler(2, 2);

        const queuedPromise = scheduler.queuedTasksCount$.pipe(bufferCount(5), first()).toPromise();

        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();

        expect(await queuedPromise).toEqual([0, 1, 2, 1, 0]);
    });

    test('runningTasksCount$ should emit the number of currently running tasks', async () => {
        const scheduler = new QdScheduler(2, 2);

        const runningPromise = scheduler.runningTasksCount$.pipe(bufferCount(5), first()).toPromise();

        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();

        expect(await runningPromise).toEqual([0, 1, 2, 1, 0]);
    });

    test('stopped should be true for a new scheduler', () => {
        const scheduler = new QdScheduler(2, 2);
        expect(scheduler.stopped).toBeTruthy();
    });

    test('stopped should be false for a started scheduler', () => {
        const scheduler = new QdScheduler(2, 2);
        scheduler.start();
        expect(scheduler.stopped).toBeFalsy();
    });

    test('stop on a not started scheduler should not anything', async () => {
        const scheduler = new QdScheduler(2, 2);
        scheduler.stop();
        expect(scheduler.stopped).toBeTruthy();
    });

    test('stop should prevent scheduler from scheduling new tasks', async () => {
        const scheduler = new QdScheduler(2, 2);
        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();
        scheduler.stop();

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        // wait a bit to ensure tasks are not scheduled
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(scheduler.size).toEqual(2);
        expect(scheduler.runningTasksCount).toEqual(0);
        expect(scheduler.queuedTasksCount).toEqual(2);
    });

    test('setMaxQueuedTasks should change the task-queue capacity', () => {
        const scheduler = new QdScheduler(0, 0);
        scheduler.setMaxQueuedTasks(1);
        scheduler.queueTask({ exec: (): Promise<void> => Promise.resolve() });
        expect(scheduler.queuedTasksCount).toEqual(1);
    });

    test('setMaxParallelTasks should change the number of possible parallel executed task', async () => {
        const scheduler = new QdScheduler(1, 2);
        const testTask = { exec: (): Promise<void> => Promise.resolve() };

        const runningPromise1 = scheduler.runningTasksCount$.pipe(bufferCount(5), first()).toPromise();

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();
        scheduler.stop();
        expect(await runningPromise1).toEqual([0, 1, 0, 1, 0]);

        const runningPromise2 = scheduler.runningTasksCount$.pipe(bufferCount(5), first()).toPromise();

        scheduler.setMaxParallelTasks(2);

        scheduler.queueTask(testTask);
        scheduler.queueTask(testTask);

        scheduler.start();
        await scheduler.workeredOff();
        expect(await runningPromise2).toEqual([0, 1, 2, 1, 0]);
    });
});
