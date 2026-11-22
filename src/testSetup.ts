import { TransformStream, ReadableStream, WritableStream } from "node:stream/web";

// jsdom does not expose the Web Streams API used by Cesium's resource loader.
// Real browsers provide these constructors; use Node's implementations in tests.
Object.assign(globalThis, { TransformStream, ReadableStream, WritableStream });
