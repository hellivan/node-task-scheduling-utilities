export interface WorkerPool<TTask, TResult> {
    executeTask(task: TTask): Promise<TResult>;
}
