import type { IncomingMessage, ServerResponse } from "node:http";

/** A synchronous transformation of a buffered UTF-8 HTML response. */
export type ContentModifier = (
  content: string,
  req: IncomingMessage,
  res: ServerResponse,
) => string;

/** Buffer text/html responses and apply modifiers in order before ending. */
export declare function createHtmlTransformMiddleware(
  modifiers: readonly ContentModifier[],
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

/** Replace upstream host references with the incoming request's Host header. */
export declare function createHostRewriteModifier(
  upstream: URL,
): (content: string, req: IncomingMessage) => string;
