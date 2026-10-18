export function createHtmlTransformMiddleware(modifiers) {
  return (req, res, next) => {
    const end = res.end.bind(res);
    const write = res.write.bind(res);
    const writeHead = res.writeHead.bind(res);
    const chunks = [];
    let ending = false;
    const isHtml = () =>
      /^text\/html(?:\s*;|$)/i.test(res.getHeader("content-type")?.toString() || "");
    const toBuffer = (chunk, encoding) =>
      typeof chunk === "string" ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
    res.writeHead = function (statusCode, statusMessageOrHeaders, headers) {
      const suppliedHeaders =
        typeof statusMessageOrHeaders === "string" ? headers : statusMessageOrHeaders;
      if (Array.isArray(suppliedHeaders)) {
        const seen = new Set();
        for (let i = 0; i < suppliedHeaders.length; i += 2) {
          const name = suppliedHeaders[i];
          if (seen.has(name.toLowerCase())) {
            res.appendHeader(name, suppliedHeaders[i + 1]);
          } else {
            res.setHeader(name, suppliedHeaders[i + 1]);
            seen.add(name.toLowerCase());
          }
        }
      } else if (suppliedHeaders) {
        for (const [name, value] of Object.entries(suppliedHeaders)) {
          if (value !== undefined) res.setHeader(name, value);
        }
      }
      if (isHtml() && !ending) res.removeHeader("content-length");
      return typeof statusMessageOrHeaders === "string"
        ? writeHead(statusCode, statusMessageOrHeaders)
        : writeHead(statusCode);
    };
    res.write = function (chunk, encodingOrCallback, callback) {
      const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : "utf8";
      const done = typeof encodingOrCallback === "function" ? encodingOrCallback : callback;
      if (!isHtml()) return write(chunk, encoding, done);
      chunks.push(toBuffer(chunk, encoding));
      if (done) process.nextTick(done);
      return true;
    };
    res.end = function (chunk, encodingOrCallback, callback) {
      const encoding = typeof encodingOrCallback === "string" ? encodingOrCallback : "utf8";
      const done =
        typeof chunk === "function"
          ? chunk
          : typeof encodingOrCallback === "function"
            ? encodingOrCallback
            : callback;
      const data = typeof chunk === "function" ? undefined : chunk;
      if (!isHtml() && chunks.length === 0) {
        return data == null ? end(done) : end(data, encoding, done);
      }
      if (data != null) chunks.push(toBuffer(data, encoding));
      let content = Buffer.concat(chunks).toString("utf8");
      for (const modifier of modifiers) content = modifier(content, req, res);
      chunks.length = 0;
      if (!res.headersSent) {
        res.setHeader("content-length", Buffer.byteLength(content));
      }
      ending = true;
      return end(content, "utf8", done);
    };
    return next();
  };
}

export function createHostRewriteModifier(upstream) {
  const host = upstream.host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = String.raw`(?=$|[/?#\\\s"'<> ,])`;
  const hostPattern = new RegExp(
    `(https?:\\/\\/|https?:\\\\/\\\\/|["'](?://|\\\\/\\\\/|/)?|["']\\.)${host}${boundary}`,
    "gi",
  );
  return function modify(content, req) {
    const target = req.headers.host;
    if (!target) return content;
    return content.replace(hostPattern, (match, prefix) => {
      if (prefix.endsWith(".")) return match;
      if (/^https?:/i.test(prefix)) {
        return prefix.includes("\\") ? `\\/\\/${target}` : `//${target}`;
      }
      return prefix + target;
    });
  };
}
