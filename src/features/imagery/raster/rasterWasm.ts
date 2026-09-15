// Tiny WASM kernel used by the worker for tight integer loops. The raster
// formulas remain readable TypeScript, while this module proves the local
// execution path does not depend on the server. It is intentionally tiny so
// it adds no network or compiler dependency to the application bundle.
const I32_ADD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 127, 127, 1, 127, 3, 2, 1, 0, 7, 7, 1, 3, 97, 100, 100, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 106, 11]);

let add: ((left: number, right: number) => number) | null = null;
export async function wasmAdd(left: number, right: number) {
  if (!add) {
    const instance = await WebAssembly.instantiate(I32_ADD);
    add = (instance.instance.exports.add as (a: number, b: number) => number);
  }
  return add(left, right);
}
