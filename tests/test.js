process.env.NODE_ENV = "test";
const lrufiles = require("../src/index");
const fs = require("fs");



describe("store / get / delete string in cache", () => {
  const cache = new lrufiles({
    level: 1,
    dir: "cache", 			// directory to store caches files
  	files: 3,       // maximum number of files
  	size: "1 GB",     // maximum total file size
  	check: 10,  // interval of stale checks in minutes
  });

  test('store string to cache', async () => {
    let resp = await cache.set("key", "sample_value_2");
    expect(resp.endsWith("key")).toBe(true);
  });

  test('store object to cache', async () => {
    let resp = await cache.set("key", {"success": true});
    expect(resp.endsWith("key")).toBe(true);
  });

  test('store stream to cache', async () => {
    let resp = await cache.set("key", fs.createReadStream("./LICENSE"));
    expect(resp.endsWith("key")).toBe(true);
  });

  test('overwrite existing cache', async () => {
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
  const cache = new lrufiles({
    level: 1,
    dir: "cache", 			// directory to store caches files
  	files: 3,       // maximum number of files
  	size: "1 GB",     // maximum total file size
  	check: 10,  // interval of stale checks in minutes
  });

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

  test('clear entire cache when it does not exist', async () => {
    let resp = await cache.clear();
    expect(true).toBe(true);
  });

  test('check if list of keys is zero', async () => {
    let resp = await cache.keys();
    expect(resp.length).toBe(0);
  });

});


describe("non-existent cache operations", () => {
  const cache = new lrufiles({
    level: 1,
    dir: "cache", 			// directory to store caches files
  	files: 3,       // maximum number of files
  	size: "1 GB",     // maximum total file size
  	check: 10,  // interval of stale checks in minutes
  });

  test('setting / as cache key to check errror', async () => {
    try{
      await cache.set("/", "something");
    } catch(err) {
      expect(err.message).toBe("'/' is not supported character as key.");
    }
  });

  test('trying to get non-existent cache key', async () => {
    let resp = await cache.get("does_not_exist");
    expect(resp).toBe(undefined);
  });

  test('trying to stream non-existent cache key', async () => {
    let resp = await cache.stream("does_not_exist");
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


describe("write many files and check stale cache cleaner", () => {
  const bigcache = new lrufiles({
    dir: "bigcache", 			// directory to store caches files
  	files: 3,       // maximum number of files
  	size: 12,     // maximum total file size
  	check: 10,  // interval of stale checks in minutes
  });

  test('write 5 files', async () => {
    await bigcache.set("file1", "value1");
    await bigcache.set("file2", "value2");
    await bigcache.set("file3", "value3");
    await bigcache.set("file4", "value4");
    await bigcache.set("file5", "value5");
    let keys = await bigcache.keys();
    expect(keys.length).toBe(5);
  });

  test('after cache cleaner run, filecount should be 2', async () => {
    // out of 5 keys, it first removes 2 least recently used.
    // then it removes least recently used file exceeding the storage size.
    await bigcache.cache_cleaner();
    let keys = await bigcache.keys();
    expect(keys.length).toBe(2);
  });

});

describe("testing cron job", () => {
  const bigcache = new lrufiles({
    dir: "cleaner_test", 			// directory to store caches files
  	files: null,       // maximum number of files
  	size: 1,     // maximum total file size
  	check: 0.1,  // interval of stale checks in minutes
  });

  let delayPromise = new Promise((resolve) => {
    setTimeout(resolve, 8000);
  });

  test('write 5 files', async () => {
    await bigcache.set("file1", "value1");
    await bigcache.set("file2", "value2");
    await bigcache.set("file3", "value3");
    await bigcache.set("file4", "value4");
    let resp = await bigcache.set("file5", "value5");
    expect(resp.endsWith("file5")).toBe(true);
  });

  test('after 8 seconds, files should be 1', async () => {
    await delayPromise;
    let keys = await bigcache.keys();
    expect(keys.length).toBe(1);
  });

});
