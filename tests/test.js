process.env.NODE_ENV = "test";
const lrufiles = require("../src/index");

const cache = new lrufiles({
  dir: "cache", 			// directory to store caches files
	files: 10,       // maximum number of files
	size: "1 GB",     // maximum total file size
	check: 10,  // interval of stale checks in minutes
});

describe("store / get / delete string in cache", () => {
  test('store string to cache', async () => {
    let resp = await cache.set("key", "sample_value");
    expect(resp.endsWith("key")).toBe(true);
  });

  test('get string from cache', async () => {
    let value = await cache.get("key");
    expect(value.toString("utf-8")).toBe("sample_value");
  });

  test('stream string from cache', async () => {
    let stream = await cache.stream("key");

    let bufs = [];
    stream.on("end", () => {
      expect(Buffer.concat(bufs).toString("utf-8")).toBe("sample_value");
    });
    stream.on("data",(chunk) => {
      bufs.push(chunk);
    });
  });

  test('update file access time', async () => {
    let resp = await cache.touch("key");
    expect(resp).toBe(true);
  });

  test('delete key from cache', async () => {
    let value = await cache.delete("key");
    expect(value).toBe(true);
  });
});

describe("set two buffers and clear entire cache", () => {
  test('store first buffer to cache', async () => {
    let resp = await cache.set("buf1", Buffer.from("sample_1"));
    expect(resp.endsWith("buf1")).toBe(true);
  });

  test('store second buffer to cache', async () => {
    let resp = await cache.set("buf2", Buffer.from("sample_2"));
    expect(resp.endsWith("buf2")).toBe(true);
  });

  test('clear entire cache', async () => {
    let resp = await cache.clear();
    expect(true).toBe(true);
  });

});


describe("non-existent cache operations", () => {
  test('trying to get non-existent cache key', async () => {
    let resp = await cache.get("does_not_exist");
    expect(resp).toBe(undefined);
  });

  test('trying to delete non-existent cache key', async () => {
    let resp = await cache.delete("does_not_exist");
    expect(resp).toBe(false);
  });

  test('checking for non-existent key', async () => {
    let resp = await cache.has("does_not_exist");
    expect(resp).toBe(false);
  });

  test('touching non-existent key', async () => {
    try{
      await cache.touch("does_not_exist")
    } catch(err) {
      expect(err.code).toBe('ENOENT');
    }
  });

});
