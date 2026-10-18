# proxy-html-rewrite

Small, dependency-free Node.js middleware for transforming HTML responses and rewriting upstream links. Works with Connect-style middleware stacks, including Express and development servers.

## Install

```sh
npm install proxy-html-rewrite
```

Requires Node.js 20 or newer. ESM; TypeScript declarations are included. TypeScript projects should also install `@types/node` as a development dependency.

## Use with a proxy

Register the middleware **before** your proxy so it can intercept the outgoing response:

```js
import { createHtmlTransformMiddleware, createHostRewriteModifier } from 'proxy-html-rewrite';

app.use(createHtmlTransformMiddleware([
  createHostRewriteModifier(new URL('http://backend.local:8080')),
  (html) => html.replace('</head>', '<meta name="local-preview" content="true"></head>'),
]));

// Register your existing proxy middleware after this.
app.use(proxyMiddleware);
```

`app` is your Connect or Express application; `proxyMiddleware` is provided by your chosen proxy library. This package transforms responses and does not create a proxy server.

Configure your proxy to remove `Accept-Encoding` from upstream requests so the backend returns uncompressed HTML. Install any downstream compression middleware before `createHtmlTransformMiddleware`, so the transformed response is compressed afterward.

## API

### `createHtmlTransformMiddleware(modifiers)`

Returns `(req, res, next) => void`. Each modifier receives `(html, req, res)` and returns a string synchronously. Modifiers run in array order when `res.end()` is called.

Only responses whose `Content-Type` is `text/html` (with optional parameters) are buffered. Other responses pass through, including binary data and server-sent events. HTML must be UTF-8 and is buffered entirely in memory; use this for bounded responses rather than streaming or very large documents.

Set `Content-Type` before writing body chunks. A stale `Content-Length` is removed when HTML headers are written, or recalculated if headers have not yet been sent. Node's string, Buffer, Uint8Array, encoding, and callback write/end forms are supported.

Do not flush headers before the middleware can remove a stale content length. Modifiers should not throw: errors are not converted into middleware `next(error)` calls. If the upstream sends integrity headers such as `ETag` or `Content-MD5`, remove or regenerate them when changing the body.

### `createHostRewriteModifier(upstream)`

Accepts a `URL` and returns a content modifier. It replaces matching upstream host references, including the port, with `req.headers.host`:

```js
const rewrite = createHostRewriteModifier(new URL('http://backend.local:8080'));

// Given an incoming Host header of localhost:3000:
// http://backend.local:8080/page -> //localhost:3000/page
// https://backend.local:8080/page -> //localhost:3000/page
```

Also handles protocol-relative links, quoted host references, and JSON-style escaped slashes. Paths, queries, and fragments are preserved. Similar-looking hosts and host prefixes are left alone. With no incoming Host header, content is returned unchanged.

This is a text replacement helper, not an HTML parser. It does not rewrite response headers (such as `Location` or `Set-Cookie`), compressed bodies, or relative paths. Treat the incoming Host header as trusted configuration, or validate it in middleware before using this helper on a public server.

## Development

```sh
npm test
npm pack --dry-run
```

No build step or runtime dependencies are required.

## License

MIT
