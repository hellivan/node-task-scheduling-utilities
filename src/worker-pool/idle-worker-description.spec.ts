import { IdleWorkerDescription } from './idle-worker-description';

describe('IdleWorkerDescription', () => {
    jest.useFakeTimers();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('creating a new IdleWorkerDescription should start idleTimout if specified', () => {
        const idleWorkerDescription = new IdleWorkerDescription<unknown>(undefined, 3000);
        // required to avoid unused local variable warning
        expect(idleWorkerDescription).toBeDefined();
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);
    });

    test('cancelIdleTimeout should clear idle-teardown-logic timeout', () => {
        const idleWorkerDescription = new IdleWorkerDescription<unknown>(undefined, 3000);
        idleWorkerDescription.cancelIdleTimeout();
        expect(clearTimeout).toHaveBeenCalledTimes(1);
    });

    test('cancelIdleTimeout should not have any effect if no timeout was specified', () => {
        const idleWorkerDescription = new IdleWorkerDescription<unknown>(undefined);
        idleWorkerDescription.cancelIdleTimeout();
        expect(clearTimeout).toHaveBeenCalledTimes(0);
    });

    test('creating a new IdleWorkerDescription should not start idleTimout if not specified', () => {
        const idleWorkerDescription = new IdleWorkerDescription<unknown>(undefined);
        // required to avoid unused local variable warning
        expect(idleWorkerDescription).toBeDefined();
        expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    test('IdleWorkerDescription should execute teardown logics if idle timeout times out', () => {
        const idleWorkerDescription = new IdleWorkerDescription<unknown>(undefined, 3000);
        const tearDownLogics = [jest.fn(), jest.fn()];
        for (const tearDownLogic of tearDownLogics) {
            idleWorkerDescription.addTeardownLogic(tearDownLogic);
        }
        jest.runAllTimers();
        for (const tearDownLogic of tearDownLogics) {
            expect(tearDownLogic).toHaveBeenCalledTimes(1);
        }
    });
});
