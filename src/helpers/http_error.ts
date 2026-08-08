// Error con código HTTP asociado, para que los controladores respondan el status correcto
// (400/404/409...) en vez del 500 genérico.
export class HttpError extends Error {
    public readonly status: number;
    public readonly code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        Object.setPrototypeOf(this, HttpError.prototype);
    }
}
