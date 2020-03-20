export interface WorkerFactory<TWorker> {
    createWorker(): TWorker;
}
