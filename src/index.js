#!/usr/bin/env node

// require node modules
var fs = require("fs");
var fsPromises = fs.promises;
var path = require("path");
var stream = require("stream");
var utils = require("./utils");

// require npm modules
var rimraf = require("rimraf");

class FileCache {
	constructor(opts) {
		this.opts = this.parseopts(opts);

		try {
			fs.mkdirSync(this.opts.dir);
		} catch (err){

		}

		// setup cleanup timer
		var self = this;
		if (this.opts.check && (this.opts.files || this.opts.size)) {
			setInterval(function(){
				self.cache_cleaner();
			}, this.opts.check).unref();
		}
	}

	parseopts(opts) {
		let o = {};

		// determine cache directory
		if (!opts.hasOwnProperty("dir") || typeof opts.dir !== "string") opts.dir = "cache";
		o.dir = path.join(require.main.filename, "..", opts.dir);

		// determine maximal total number of files
		opts.files = (!opts.hasOwnProperty("files")) ? false : parseInt(opts.files,10);
		o.files = (isNaN(opts.files) || opts.files === 0) ? false : opts.files;

		// determine maximal total file size
		if (!opts.hasOwnProperty("size")) opts.size = false;
		if (typeof opts.size === "string") opts.size = utils.filesize(opts.size);
		if (typeof opts.size !== "number" || isNaN(opts.size) || opts.size === 0) opts.size = false;
		o.size = opts.size;


		// determine cleanup interval
		if (!opts.hasOwnProperty("check")) {
			o.check = 10 * 60 * 1000; // default check interval is 10 min
		} else {
			o.check = opts.check * 60 * 1000 // convert passed minutes to milliseconds...
		}

		return o;
	}

	async keys() {
		try {
			let files = await fsPromises.readdir(this.opts.dir);
			return files;
		} catch (e) {
			return [];
		}
	}

	async has(file, resolved_path) {
		if(!resolved_path){
			file = path.resolve(this.opts.dir, utils.sanitize(file));
		}

		try {
			await fsPromises.access(file);
			return true
		} catch (e) {
			return false;
		}
	}

	async set(file, data) {
		if(file.indexOf("/") >= 0){
			throw new Error("'/' is not supported character as key.");
		}

		file = path.resolve(this.opts.dir, utils.sanitize(file));

		if ((data instanceof stream) || (data instanceof stream.Readable) || (data.readable === true)) {
			// pipe stream to file
			return new Promise((resolve, reject) => {
				data.pipe(fs.createWriteStream(file).on("finish", function(){
					resolve(file);
				}).on("error", function(err){
					reject(err);
				}));
			});

		}else if (data instanceof Buffer) {
			// write buffer to file
			await fsPromises.writeFile(file, data);
		} else if (typeof data === "object") {
			await fsPromises.writeFile(file, JSON.stringify(data));
		} else {
			// write to file
			await fsPromises.writeFile(file, data);
		}
		return file;
	}

	async delete(file) {
		file = path.resolve(this.opts.dir, utils.sanitize(file));

		if(await this.has(file, true)){
			await fsPromises.unlink(file);
			return true;
		} else {
			return false;
		}
	}

	async touch(file, time) {
		if(!time){
			time = Date.now();
		}

		file = path.resolve(this.opts.dir, utils.sanitize(file));
		await fsPromises.utimes(file, time, time);
		return true;
	}

	async get(file) {
		file = path.resolve(this.opts.dir, utils.sanitize(file));

		if(await this.has(file, true)){
			return fsPromises.readFile(file);
		} else {
			return undefined;
		}
	}

	async stream(file) {
		file = path.resolve(this.opts.dir, utils.sanitize(file));

		if(await this.has(file, true)){
			return fs.createReadStream(file);
		} else {
			return undefined;
		}
	}

	async clear() {
		var self = this;
		return new Promise((resolve, reject) => {
			rimraf(self.opts.dir, err => {
				if(err){
					reject(err);
				} else {
					resolve(true);
				}
			});
		});
	}

	async cache_cleaner() {
		var self = this;
		let files = await fsPromises.readdir(this.opts.dir);

		let remove = [];
		let size = 0;

	  files = files.map(function (fileName) {
			let stats = fs.statSync(self.opts.dir + '/' + fileName)
	    return {
	      name: fileName,
	      atime: stats.atime.getTime(),
				size: stats.size
	    };
	  }).sort(function (a, b) {
	    return a.atime - b.atime;
		});



		// check for filecount violation
		if (this.opts.files) while (files.length > this.opts.files) {
			remove.push(files.shift());
		};

		// check for filesize violations
		if (this.opts.size) while (this.opts.size > size && files.length) {
			size += files.pop().size;
		};

		remove = remove.concat(files);


		// check if there are removable files
		if (remove.length === 0) return;

		let promises = [];
		for(const file of remove){
			promises.push(this.delete(file.name));
		}
		await Promise.all(promises);
		return true;
	}
}

module.exports = FileCache;
