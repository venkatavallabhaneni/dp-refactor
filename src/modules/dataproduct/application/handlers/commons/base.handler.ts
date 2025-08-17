export abstract class Handler<T> {
    protected next?: Handler<T>;

    setNext(handler: Handler<T>): Handler<T> {
        this.next = handler;
        return handler;
    }

    async handle(request: T): Promise<void> {
        await this.process(request);
        if (this.next) await this.next.handle(request);
    }

    protected abstract process(request: T): Promise<void>;
}