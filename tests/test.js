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

  test('delete key from cache', async () => {
    let value = await cache.delete("key");
    expect(value).toBe(true);
  });
});

//
// test('downloadImage() function test for AWS S3 request', async () => {
//   let data = await origin.downloadImage("https://s3.ap-south-1.amazonaws.com/gumlet/unit_test_images/car.png", {
//     type: 'aws',
//     awskey: core.params.aws.id,
//     awssecret: core.params.aws.secret
//   });
//   expect(md5(data.body)).toBe('7d8a023e8a24346f3a54b0e9a8155015');
// });

// test('lossy compression', async () => {
//   let data = await origin.downloadImage("https://storage.googleapis.com/gumlet/unit_test_images/forest.jpg");
//   let compressed = await transform.lossyCompressIfEnabled(data.body, {
//     query: {
//       compress: 'true'
//     }
//   }, {
//     format: 'jpg'
//   });
//   expect(data.body.length).toBe(3805232);
//   expect(compressed.length).toBe(1681417);
//   expect(md5(compressed)).toBe('7b96e9eac0d9bf4fc796ea89d69be099');
// });

// test('tint=red', async () => {
//   let data = await origin.downloadImage("https://storage.googleapis.com/gumlet/unit_test_images/lemon.jpg");
//   let transformed = await transform.do({
//     query: {
//       tint: 'red'
//     },
//     headers: {}
//   }, data.body);
//   let reference = await origin.downloadImage("https://storage.googleapis.com/gumlet/unit_test_images/lemon-tint-red.jpg");
//   expect(reference.body.equals(transformed.data)).toBe(true);
// });
//
// test('extract=50,50,300,300', async () => {
//   let data = await origin.downloadImage("https://storage.googleapis.com/gumlet/unit_test_images/lemon.jpg");
//   let transformed = await transform.do({
//     query: {
//       extract: '50,50,300,300'
//     },
//     headers: {}
//   }, data.body);
//   // fs.writeFile("lemon-extract-50,50,300,300.jpg", transformed.data, () => {});
//   let reference = await origin.downloadImage("https://storage.googleapis.com/gumlet/unit_test_images/lemon-extract-50%2C50%2C300%2C300.jpg");
//   expect(reference.body.equals(transformed.data)).toBe(true);
// });



function md5(string) {
  return crypto.createHash('md5').update(string).digest('hex');
}
