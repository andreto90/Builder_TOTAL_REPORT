declare module 'mammoth' {
  export interface MammothMessage {
    type: 'warning' | 'error';
    message: string;
  }

  export interface MammothResult<T = string> {
    value: T;
    messages: MammothMessage[];
  }

  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<MammothResult<string>>;

  export function convertToHtml(input: {
    buffer: Buffer;
  }): Promise<MammothResult<string>>;
}
