#!/usr/bin/env node

// require node modules
var fs = require("fs");
var path = require("path");
var stream = require("stream");

// require npm modules
var rimraf = require("rimraf");

function filecache(opts){
	if (!(this instanceof filecache)) return new filecache(opts);

	var self = this;

	// get options
	self.opts = self.parseopts(opts);

	// initialize
	self.init();

	return this;

};

// check and apply options
filecache.prototype.parseopts = function(opts) {
	var self = this;
	var o = {};

	// determine cache directory
	if (!opts.hasOwnProperty("dir") || typeof opts.dir !== "string") opts.dir = "cache";
	o.dir = path.join(__dirname, "..", opts.dir);

	// determine maximal total number of files
	opts.files = (!opts.hasOwnProperty("files")) ? false : parseInt(opts.files,10);
	o.files = (isNaN(opts.files) || opts.files === 0) ? false : opts.files;

	// determine maximal total file size
	if (!opts.hasOwnProperty("size")) opts.size = false;
	if (typeof opts.size === "string") opts.size = self.filesize(opts.size);
	if (typeof opts.size !== "number" || isNaN(opts.size) || opts.size === 0) opts.size = false;
	o.size = opts.size;


	// determine cleanup interval
	if (!opts.hasOwnProperty("check")) {
		opts.check = 10 * 60 * 1000; // default check interval is 10 min
	} else {
		opts.check = opts.check * 60 * 1000 // convert passed minutes to milliseconds...
	}

	return o;
};

// initialize file cache
filecache.prototype.init = function() {
	var self = this;

	try {
		fs.mkdirSync(self.opts.dir);
	} catch (err){

	}


	// setup cleanup timer
	if (self.opts.check && (self.opts.files || self.opts.size)) setInterval(function(){
		self.clean();
	}, self.opts.check).unref();

	return this;
};

// check if a file exists
filecache.prototype.has = async function(file, resolved_path) {
	var self = this;
	if(!resolved_path){
		file = path.resolve(self.opts.dir, self.sanitize(file));
	}
	return new Promise((resolve, reject) => {
		fs.access(file, (err) => {
				if(err){
					resolve(false);
				} else {
					resolve(true);
				}
		});
	});
};

// add a file
filecache.prototype.set = async function(file, data) {
	var self = this;

	if(file.indexOf("/") >= 0){
		throw new Error("'/' is not supported character as key.");
	}

	var file = path.resolve(this.opts.dir, self.sanitize(file));

	return new Promise((resolve, reject) => {
		if ((data instanceof stream) || (data instanceof stream.Readable) || (data.readable === true)) {
			// pipe stream to file
			data.pipe(fs.createWriteStream(file).on("finish", function(){
				resolve(file);
			}).on("error", function(err){
				reject(err);
			}));

		} else if (data instanceof Buffer) {

			// write buffer to file
			fs.writeFile(file, data, function(err){
				if(err){
					reject(err);
				} else {
					resolve(file);
				}
			});

		} else if (typeof data === "object") {

			// serialize object and write to file
			try {
				fs.writeFile(file, JSON.stringify(data), function(err){
					if(err){
						reject(err);
					} else {
						resolve(file);
					}
				});
			} catch (err) {
				return reject(err);
			};

		} else {
			// write to file
			fs.writeFile(file, data, function(err){
				if(err){
					reject(err);
				} else {
					resolve(file);
				}
			});

		};
	});
};

// remove file from cache
filecache.prototype.delete = async function(file) {
	var self = this;

	var file = path.resolve(this.opts.dir, self.sanitize(file));

	if(await self.has(file, true)){
		return new Promise((resolve, reject) => {
			fs.unlink(file, function(err){
				if (err){
					reject(err);
				} else {
					resolve(true);
				}
			});
		});
	} else {
		return false;
	}
};

// update file access time
filecache.prototype.touch = async function(file) {
	var self = this;

	var file = path.resolve(this.opts.dir, self.sanitize(file));

	return new Promise((resolve, reject) => {
		fs.utimes(file, Date.now(), Date.now(), function(err){
			if(err){
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
};

// get a file as buffer
filecache.prototype.get = async function(file) {
	var self = this;

	var file = path.resolve(this.opts.dir, self.sanitize(file));

	if(await self.has(file, true)){
		return new Promise((resolve, reject) => {
			fs.readFile(file, function(err, buffer){
				if (err) {
					reject(err);
				} else {
					resolve(buffer);
				}
			});
		});
	} else {
		return undefined;
	}
};

// get a file as stream
filecache.prototype.stream = async function(file) {
	var self = this;
	var file = path.resolve(this.opts.dir, self.sanitize(file));

	if(await self.has(file, true)){
		return fs.createReadStream(file);
	} else {
		return undefined;
	}
};

// empty the file store
filecache.prototype.clear = async function() {
	var self = this;

	return new Promise((resolve, reject) => {
		rimraf(self.opts.dir, (err) => {
			if(err){
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
};

// cleanup files
filecache.prototype.clean = function() {
	var self = this;

	fs.readdir(dir, async function(err, files){
		let remove = [];
		let size = 0;

	  files = files.map(function (fileName) {
			let stats = fs.statSync(dir + '/' + fileName)
	    return {
	      name: fileName,
	      atime: stats.atime.getTime(),
				size: stats.size
	    };
	  }).sort(function (a, b) {
	    return a.atime - b.atime;
		});

		// check for filecount violation
		if (self.opts.files) while (files.length > self.opts.files) {
			remove.push(files.shift());
		};

		// check for filesize violations
		if (self.opts.size) while (self.opts.size < size && files.length) {
			size += files.shift().size;
		};
		remove.concat(files);

		// check if there are removable files
		if (remove.length === 0) return;

		for(const file of remove){
			await self.delete(file);
		}
	});
};


// make filename parameter safe
filecache.prototype.sanitize = function(f) {
	return path.normalize(f).replace(/^\//,'');
};

// convert human-readable filesize to an integer of bytes
filecache.prototype.filesize = function(s) {
	if (typeof s === "number") return s;
	if (typeof s !== "string") return 0;
	var match = s.toLowerCase().match(/^([0-9]+([\.,]([0-9]+))?)(\s*)([a-z]+)?$/);
	if (!match) return 0;
	var num = parseFloat(match[1].replace(/,/,'.'));
	switch (match[5]) {
		case "k":
		case "kb":
		case "kbyte":
			return Math.round(num * Math.pow(10, 3));
		break;
		case "m":
		case "mb":
		case "mbyte":
			return Math.round(num * Math.pow(10, 6));
		break;
		case "g":
		case "gb":
		case "gbyte":
			return Math.round(num * Math.pow(10, 9));
		break;
		case "t":
		case "tb":
		case "tbyte":
			return Math.round(num * Math.pow(10, 12));
		break;
		case "p":
		case "pb":
		case "pbyte":
			// be aware that javascript can't represent much more than 9 of those because integers are only 2^53
			return Math.round(num * Math.pow(10, 15));
		break;
		case "ki":
		case "kib":
		case "kibi":
		case "kibyte":
		case "kibibyte":
			return Math.round(num * Math.pow(2, 10));
		break;
		case "mi":
		case "mib":
		case "mebi":
		case "mibyte":
		case "mebibyte":
			return Math.round(num * Math.pow(2, 20));
		break;
		case "gi":
		case "gib":
		case "gibi":
		case "gibyte":
		case "gibibyte":
			return Math.round(num * Math.pow(2, 30));
		break;
		case "ti":
		case "tib":
		case "tebi":
		case "tibyte":
		case "tebibyte":
			return Math.round(num * Math.pow(2, 40));
		break;
		case "pi":
		case "pib":
		case "pebi":
		case "pibyte":
		case "pebibyte":
			// be aware that javascript can't represent more than 8 of those because integers are only 2^53
			return Math.round(num * Math.pow(2, 50));
		break;
		default:
			// everything else is treated as bytes
			return Math.round(num);
		break;
	}
};

// export
module.exports = filecache;
