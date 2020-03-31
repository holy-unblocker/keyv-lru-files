#!/usr/bin/env node

// require node modules
var fs = require("fs");
var fsPromises = fs.promises;
var path = require("path");
var stream = require("stream");
var utils = require("./utils");
const util = require('util');
const exec = util.promisify(require('child_process').exec);

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
		let resolved_file;
		if(!resolved_path){
				resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));

		} else {
			resolved_file = file;
		}

		try {
			await fsPromises.access(resolved_file);
			return true
		} catch (e) {
			return false;
		}
	}

	async set(file, data) {
		if(file.indexOf("/") >= 0){
			throw new Error("'/' is not supported character as key.");
		}

		let resolved_file = await this.get_resolved_file(file);

		if ((data instanceof stream) || (data instanceof stream.Readable) || (data.readable === true)) {
			// pipe stream to file
			return new Promise((resolve, reject) => {
				data.pipe(fs.createWriteStream(resolved_file).on("finish", function(){
					resolve(resolved_file);
				}).on("error", function(err){
					reject(err);
				}));
			});

		}else if (data instanceof Buffer) {
			// write buffer to file
			await fsPromises.writeFile(resolved_file, data);
		} else if (typeof data === "object") {
			await fsPromises.writeFile(resolved_file, JSON.stringify(data));
		} else {
			// write to file
			await fsPromises.writeFile(resolved_file, data);
		}
		return resolved_file;
	}

	async get_resolved_file(file) {
		if(file.indexOf("/") >= 0){
			throw new Error("'/' is not supported character as key.");
		}

		let resolved_file;
			resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));

		return resolved_file;
	}

	async delete(file) {
		let resolved_file;

			resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));


		if(await this.has(resolved_file, true)){
			await fsPromises.unlink(resolved_file);
			return true;
		} else {
			return false;
		}
	}

	async touch(file, time) {
		if(!time){
			time = Date.now();
		}

		let resolved_file = await this.get_resolved_file(file);
		await fsPromises.utimes(resolved_file, time, time);
		return true;
	}

	async get(file) {
		let resolved_file;

			resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));


		if(await this.has(resolved_file, true)){
			return fsPromises.readFile(resolved_file);
		} else {
			return undefined;
		}
	}

	async stream(file, opts) {
		let resolved_file;
			resolved_file = path.resolve(this.opts.dir, utils.sanitize(file));


		if(await this.has(resolved_file, true)){
			return fs.createReadStream(resolved_file, opts);
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

		// remove files which exceed the specified GBs
		if(this.opts.size) await exec(`cd ${this.opts.dir} && ls -ltu | awk '{t+=$5} t > ${this.opts.size}'| awk '{print $9}' | xargs -d '\n' -r rm --`);

		// remove files which exceed the given count
		if(this.opts.files) await exec(`cd ${this.opts.dir} && ls -1u | tail -n+${this.opts.files + 1} | xargs -d '\n' -r rm --`);
	}
}

module.exports = FileCache;
