import { Message } from '../types';
export declare class MessageProcessor {
    private lastTimestamp;
    processMessage(rawMessage: any): Message | null;
    reset(): void;
}
