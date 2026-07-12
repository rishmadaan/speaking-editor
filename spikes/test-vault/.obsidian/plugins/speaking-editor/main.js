"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
)), __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);

// node_modules/delayed-stream/lib/delayed_stream.js
var require_delayed_stream = __commonJS({
  "node_modules/delayed-stream/lib/delayed_stream.js"(exports2, module2) {
    var Stream = require("stream").Stream, util = require("util");
    module2.exports = DelayedStream;
    function DelayedStream() {
      this.source = null, this.dataSize = 0, this.maxDataSize = 1024 * 1024, this.pauseStream = !0, this._maxDataSizeExceeded = !1, this._released = !1, this._bufferedEvents = [];
    }
    util.inherits(DelayedStream, Stream);
    DelayedStream.create = function(source, options) {
      var delayedStream = new this();
      options = options || {};
      for (var option in options)
        delayedStream[option] = options[option];
      delayedStream.source = source;
      var realEmit = source.emit;
      return source.emit = function() {
        return delayedStream._handleEmit(arguments), realEmit.apply(source, arguments);
      }, source.on("error", function() {
      }), delayedStream.pauseStream && source.pause(), delayedStream;
    };
    Object.defineProperty(DelayedStream.prototype, "readable", {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return this.source.readable;
      }
    });
    DelayedStream.prototype.setEncoding = function() {
      return this.source.setEncoding.apply(this.source, arguments);
    };
    DelayedStream.prototype.resume = function() {
      this._released || this.release(), this.source.resume();
    };
    DelayedStream.prototype.pause = function() {
      this.source.pause();
    };
    DelayedStream.prototype.release = function() {
      this._released = !0, this._bufferedEvents.forEach(function(args) {
        this.emit.apply(this, args);
      }.bind(this)), this._bufferedEvents = [];
    };
    DelayedStream.prototype.pipe = function() {
      var r = Stream.prototype.pipe.apply(this, arguments);
      return this.resume(), r;
    };
    DelayedStream.prototype._handleEmit = function(args) {
      if (this._released) {
        this.emit.apply(this, args);
        return;
      }
      args[0] === "data" && (this.dataSize += args[1].length, this._checkIfMaxDataSizeExceeded()), this._bufferedEvents.push(args);
    };
    DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
      if (!this._maxDataSizeExceeded && !(this.dataSize <= this.maxDataSize)) {
        this._maxDataSizeExceeded = !0;
        var message = "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
        this.emit("error", new Error(message));
      }
    };
  }
});

// node_modules/combined-stream/lib/combined_stream.js
var require_combined_stream = __commonJS({
  "node_modules/combined-stream/lib/combined_stream.js"(exports2, module2) {
    var util = require("util"), Stream = require("stream").Stream, DelayedStream = require_delayed_stream();
    module2.exports = CombinedStream;
    function CombinedStream() {
      this.writable = !1, this.readable = !0, this.dataSize = 0, this.maxDataSize = 2 * 1024 * 1024, this.pauseStreams = !0, this._released = !1, this._streams = [], this._currentStream = null, this._insideLoop = !1, this._pendingNext = !1;
    }
    util.inherits(CombinedStream, Stream);
    CombinedStream.create = function(options) {
      var combinedStream = new this();
      options = options || {};
      for (var option in options)
        combinedStream[option] = options[option];
      return combinedStream;
    };
    CombinedStream.isStreamLike = function(stream) {
      return typeof stream != "function" && typeof stream != "string" && typeof stream != "boolean" && typeof stream != "number" && !Buffer.isBuffer(stream);
    };
    CombinedStream.prototype.append = function(stream) {
      var isStreamLike = CombinedStream.isStreamLike(stream);
      if (isStreamLike) {
        if (!(stream instanceof DelayedStream)) {
          var newStream = DelayedStream.create(stream, {
            maxDataSize: 1 / 0,
            pauseStream: this.pauseStreams
          });
          stream.on("data", this._checkDataSize.bind(this)), stream = newStream;
        }
        this._handleErrors(stream), this.pauseStreams && stream.pause();
      }
      return this._streams.push(stream), this;
    };
    CombinedStream.prototype.pipe = function(dest, options) {
      return Stream.prototype.pipe.call(this, dest, options), this.resume(), dest;
    };
    CombinedStream.prototype._getNext = function() {
      if (this._currentStream = null, this._insideLoop) {
        this._pendingNext = !0;
        return;
      }
      this._insideLoop = !0;
      try {
        do
          this._pendingNext = !1, this._realGetNext();
        while (this._pendingNext);
      } finally {
        this._insideLoop = !1;
      }
    };
    CombinedStream.prototype._realGetNext = function() {
      var stream = this._streams.shift();
      if (typeof stream > "u") {
        this.end();
        return;
      }
      if (typeof stream != "function") {
        this._pipeNext(stream);
        return;
      }
      var getStream = stream;
      getStream(function(stream2) {
        var isStreamLike = CombinedStream.isStreamLike(stream2);
        isStreamLike && (stream2.on("data", this._checkDataSize.bind(this)), this._handleErrors(stream2)), this._pipeNext(stream2);
      }.bind(this));
    };
    CombinedStream.prototype._pipeNext = function(stream) {
      this._currentStream = stream;
      var isStreamLike = CombinedStream.isStreamLike(stream);
      if (isStreamLike) {
        stream.on("end", this._getNext.bind(this)), stream.pipe(this, { end: !1 });
        return;
      }
      var value = stream;
      this.write(value), this._getNext();
    };
    CombinedStream.prototype._handleErrors = function(stream) {
      var self2 = this;
      stream.on("error", function(err) {
        self2._emitError(err);
      });
    };
    CombinedStream.prototype.write = function(data) {
      this.emit("data", data);
    };
    CombinedStream.prototype.pause = function() {
      this.pauseStreams && (this.pauseStreams && this._currentStream && typeof this._currentStream.pause == "function" && this._currentStream.pause(), this.emit("pause"));
    };
    CombinedStream.prototype.resume = function() {
      this._released || (this._released = !0, this.writable = !0, this._getNext()), this.pauseStreams && this._currentStream && typeof this._currentStream.resume == "function" && this._currentStream.resume(), this.emit("resume");
    };
    CombinedStream.prototype.end = function() {
      this._reset(), this.emit("end");
    };
    CombinedStream.prototype.destroy = function() {
      this._reset(), this.emit("close");
    };
    CombinedStream.prototype._reset = function() {
      this.writable = !1, this._streams = [], this._currentStream = null;
    };
    CombinedStream.prototype._checkDataSize = function() {
      if (this._updateDataSize(), !(this.dataSize <= this.maxDataSize)) {
        var message = "DelayedStream#maxDataSize of " + this.maxDataSize + " bytes exceeded.";
        this._emitError(new Error(message));
      }
    };
    CombinedStream.prototype._updateDataSize = function() {
      this.dataSize = 0;
      var self2 = this;
      this._streams.forEach(function(stream) {
        stream.dataSize && (self2.dataSize += stream.dataSize);
      }), this._currentStream && this._currentStream.dataSize && (this.dataSize += this._currentStream.dataSize);
    };
    CombinedStream.prototype._emitError = function(err) {
      this._reset(), this.emit("error", err);
    };
  }
});

// node_modules/mime-db/db.json
var require_db = __commonJS({
  "node_modules/mime-db/db.json"(exports2, module2) {
    module2.exports = {
      "application/1d-interleaved-parityfec": {
        source: "iana"
      },
      "application/3gpdash-qoe-report+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/3gpp-ims+xml": {
        source: "iana",
        compressible: !0
      },
      "application/3gpphal+json": {
        source: "iana",
        compressible: !0
      },
      "application/3gpphalforms+json": {
        source: "iana",
        compressible: !0
      },
      "application/a2l": {
        source: "iana"
      },
      "application/ace+cbor": {
        source: "iana"
      },
      "application/activemessage": {
        source: "iana"
      },
      "application/activity+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-costmap+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-costmapfilter+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-directory+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-endpointcost+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-endpointcostparams+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-endpointprop+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-endpointpropparams+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-error+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-networkmap+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-networkmapfilter+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-updatestreamcontrol+json": {
        source: "iana",
        compressible: !0
      },
      "application/alto-updatestreamparams+json": {
        source: "iana",
        compressible: !0
      },
      "application/aml": {
        source: "iana"
      },
      "application/andrew-inset": {
        source: "iana",
        extensions: ["ez"]
      },
      "application/applefile": {
        source: "iana"
      },
      "application/applixware": {
        source: "apache",
        extensions: ["aw"]
      },
      "application/at+jwt": {
        source: "iana"
      },
      "application/atf": {
        source: "iana"
      },
      "application/atfx": {
        source: "iana"
      },
      "application/atom+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["atom"]
      },
      "application/atomcat+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["atomcat"]
      },
      "application/atomdeleted+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["atomdeleted"]
      },
      "application/atomicmail": {
        source: "iana"
      },
      "application/atomsvc+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["atomsvc"]
      },
      "application/atsc-dwd+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["dwd"]
      },
      "application/atsc-dynamic-event-message": {
        source: "iana"
      },
      "application/atsc-held+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["held"]
      },
      "application/atsc-rdt+json": {
        source: "iana",
        compressible: !0
      },
      "application/atsc-rsat+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rsat"]
      },
      "application/atxml": {
        source: "iana"
      },
      "application/auth-policy+xml": {
        source: "iana",
        compressible: !0
      },
      "application/bacnet-xdd+zip": {
        source: "iana",
        compressible: !1
      },
      "application/batch-smtp": {
        source: "iana"
      },
      "application/bdoc": {
        compressible: !1,
        extensions: ["bdoc"]
      },
      "application/beep+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/calendar+json": {
        source: "iana",
        compressible: !0
      },
      "application/calendar+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xcs"]
      },
      "application/call-completion": {
        source: "iana"
      },
      "application/cals-1840": {
        source: "iana"
      },
      "application/captive+json": {
        source: "iana",
        compressible: !0
      },
      "application/cbor": {
        source: "iana"
      },
      "application/cbor-seq": {
        source: "iana"
      },
      "application/cccex": {
        source: "iana"
      },
      "application/ccmp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/ccxml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["ccxml"]
      },
      "application/cdfx+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["cdfx"]
      },
      "application/cdmi-capability": {
        source: "iana",
        extensions: ["cdmia"]
      },
      "application/cdmi-container": {
        source: "iana",
        extensions: ["cdmic"]
      },
      "application/cdmi-domain": {
        source: "iana",
        extensions: ["cdmid"]
      },
      "application/cdmi-object": {
        source: "iana",
        extensions: ["cdmio"]
      },
      "application/cdmi-queue": {
        source: "iana",
        extensions: ["cdmiq"]
      },
      "application/cdni": {
        source: "iana"
      },
      "application/cea": {
        source: "iana"
      },
      "application/cea-2018+xml": {
        source: "iana",
        compressible: !0
      },
      "application/cellml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/cfw": {
        source: "iana"
      },
      "application/city+json": {
        source: "iana",
        compressible: !0
      },
      "application/clr": {
        source: "iana"
      },
      "application/clue+xml": {
        source: "iana",
        compressible: !0
      },
      "application/clue_info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/cms": {
        source: "iana"
      },
      "application/cnrp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/coap-group+json": {
        source: "iana",
        compressible: !0
      },
      "application/coap-payload": {
        source: "iana"
      },
      "application/commonground": {
        source: "iana"
      },
      "application/conference-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/cose": {
        source: "iana"
      },
      "application/cose-key": {
        source: "iana"
      },
      "application/cose-key-set": {
        source: "iana"
      },
      "application/cpl+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["cpl"]
      },
      "application/csrattrs": {
        source: "iana"
      },
      "application/csta+xml": {
        source: "iana",
        compressible: !0
      },
      "application/cstadata+xml": {
        source: "iana",
        compressible: !0
      },
      "application/csvm+json": {
        source: "iana",
        compressible: !0
      },
      "application/cu-seeme": {
        source: "apache",
        extensions: ["cu"]
      },
      "application/cwt": {
        source: "iana"
      },
      "application/cybercash": {
        source: "iana"
      },
      "application/dart": {
        compressible: !0
      },
      "application/dash+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mpd"]
      },
      "application/dash-patch+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mpp"]
      },
      "application/dashdelta": {
        source: "iana"
      },
      "application/davmount+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["davmount"]
      },
      "application/dca-rft": {
        source: "iana"
      },
      "application/dcd": {
        source: "iana"
      },
      "application/dec-dx": {
        source: "iana"
      },
      "application/dialog-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/dicom": {
        source: "iana"
      },
      "application/dicom+json": {
        source: "iana",
        compressible: !0
      },
      "application/dicom+xml": {
        source: "iana",
        compressible: !0
      },
      "application/dii": {
        source: "iana"
      },
      "application/dit": {
        source: "iana"
      },
      "application/dns": {
        source: "iana"
      },
      "application/dns+json": {
        source: "iana",
        compressible: !0
      },
      "application/dns-message": {
        source: "iana"
      },
      "application/docbook+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["dbk"]
      },
      "application/dots+cbor": {
        source: "iana"
      },
      "application/dskpp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/dssc+der": {
        source: "iana",
        extensions: ["dssc"]
      },
      "application/dssc+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xdssc"]
      },
      "application/dvcs": {
        source: "iana"
      },
      "application/ecmascript": {
        source: "iana",
        compressible: !0,
        extensions: ["es", "ecma"]
      },
      "application/edi-consent": {
        source: "iana"
      },
      "application/edi-x12": {
        source: "iana",
        compressible: !1
      },
      "application/edifact": {
        source: "iana",
        compressible: !1
      },
      "application/efi": {
        source: "iana"
      },
      "application/elm+json": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/elm+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.cap+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/emergencycalldata.comment+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.control+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.deviceinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.ecall.msd": {
        source: "iana"
      },
      "application/emergencycalldata.providerinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.serviceinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.subscriberinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emergencycalldata.veds+xml": {
        source: "iana",
        compressible: !0
      },
      "application/emma+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["emma"]
      },
      "application/emotionml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["emotionml"]
      },
      "application/encaprtp": {
        source: "iana"
      },
      "application/epp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/epub+zip": {
        source: "iana",
        compressible: !1,
        extensions: ["epub"]
      },
      "application/eshop": {
        source: "iana"
      },
      "application/exi": {
        source: "iana",
        extensions: ["exi"]
      },
      "application/expect-ct-report+json": {
        source: "iana",
        compressible: !0
      },
      "application/express": {
        source: "iana",
        extensions: ["exp"]
      },
      "application/fastinfoset": {
        source: "iana"
      },
      "application/fastsoap": {
        source: "iana"
      },
      "application/fdt+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["fdt"]
      },
      "application/fhir+json": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/fhir+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/fido.trusted-apps+json": {
        compressible: !0
      },
      "application/fits": {
        source: "iana"
      },
      "application/flexfec": {
        source: "iana"
      },
      "application/font-sfnt": {
        source: "iana"
      },
      "application/font-tdpfr": {
        source: "iana",
        extensions: ["pfr"]
      },
      "application/font-woff": {
        source: "iana",
        compressible: !1
      },
      "application/framework-attributes+xml": {
        source: "iana",
        compressible: !0
      },
      "application/geo+json": {
        source: "iana",
        compressible: !0,
        extensions: ["geojson"]
      },
      "application/geo+json-seq": {
        source: "iana"
      },
      "application/geopackage+sqlite3": {
        source: "iana"
      },
      "application/geoxacml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/gltf-buffer": {
        source: "iana"
      },
      "application/gml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["gml"]
      },
      "application/gpx+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["gpx"]
      },
      "application/gxf": {
        source: "apache",
        extensions: ["gxf"]
      },
      "application/gzip": {
        source: "iana",
        compressible: !1,
        extensions: ["gz"]
      },
      "application/h224": {
        source: "iana"
      },
      "application/held+xml": {
        source: "iana",
        compressible: !0
      },
      "application/hjson": {
        extensions: ["hjson"]
      },
      "application/http": {
        source: "iana"
      },
      "application/hyperstudio": {
        source: "iana",
        extensions: ["stk"]
      },
      "application/ibe-key-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/ibe-pkg-reply+xml": {
        source: "iana",
        compressible: !0
      },
      "application/ibe-pp-data": {
        source: "iana"
      },
      "application/iges": {
        source: "iana"
      },
      "application/im-iscomposing+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/index": {
        source: "iana"
      },
      "application/index.cmd": {
        source: "iana"
      },
      "application/index.obj": {
        source: "iana"
      },
      "application/index.response": {
        source: "iana"
      },
      "application/index.vnd": {
        source: "iana"
      },
      "application/inkml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["ink", "inkml"]
      },
      "application/iotp": {
        source: "iana"
      },
      "application/ipfix": {
        source: "iana",
        extensions: ["ipfix"]
      },
      "application/ipp": {
        source: "iana"
      },
      "application/isup": {
        source: "iana"
      },
      "application/its+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["its"]
      },
      "application/java-archive": {
        source: "apache",
        compressible: !1,
        extensions: ["jar", "war", "ear"]
      },
      "application/java-serialized-object": {
        source: "apache",
        compressible: !1,
        extensions: ["ser"]
      },
      "application/java-vm": {
        source: "apache",
        compressible: !1,
        extensions: ["class"]
      },
      "application/javascript": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["js", "mjs"]
      },
      "application/jf2feed+json": {
        source: "iana",
        compressible: !0
      },
      "application/jose": {
        source: "iana"
      },
      "application/jose+json": {
        source: "iana",
        compressible: !0
      },
      "application/jrd+json": {
        source: "iana",
        compressible: !0
      },
      "application/jscalendar+json": {
        source: "iana",
        compressible: !0
      },
      "application/json": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["json", "map"]
      },
      "application/json-patch+json": {
        source: "iana",
        compressible: !0
      },
      "application/json-seq": {
        source: "iana"
      },
      "application/json5": {
        extensions: ["json5"]
      },
      "application/jsonml+json": {
        source: "apache",
        compressible: !0,
        extensions: ["jsonml"]
      },
      "application/jwk+json": {
        source: "iana",
        compressible: !0
      },
      "application/jwk-set+json": {
        source: "iana",
        compressible: !0
      },
      "application/jwt": {
        source: "iana"
      },
      "application/kpml-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/kpml-response+xml": {
        source: "iana",
        compressible: !0
      },
      "application/ld+json": {
        source: "iana",
        compressible: !0,
        extensions: ["jsonld"]
      },
      "application/lgr+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["lgr"]
      },
      "application/link-format": {
        source: "iana"
      },
      "application/load-control+xml": {
        source: "iana",
        compressible: !0
      },
      "application/lost+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["lostxml"]
      },
      "application/lostsync+xml": {
        source: "iana",
        compressible: !0
      },
      "application/lpf+zip": {
        source: "iana",
        compressible: !1
      },
      "application/lxf": {
        source: "iana"
      },
      "application/mac-binhex40": {
        source: "iana",
        extensions: ["hqx"]
      },
      "application/mac-compactpro": {
        source: "apache",
        extensions: ["cpt"]
      },
      "application/macwriteii": {
        source: "iana"
      },
      "application/mads+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mads"]
      },
      "application/manifest+json": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["webmanifest"]
      },
      "application/marc": {
        source: "iana",
        extensions: ["mrc"]
      },
      "application/marcxml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mrcx"]
      },
      "application/mathematica": {
        source: "iana",
        extensions: ["ma", "nb", "mb"]
      },
      "application/mathml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mathml"]
      },
      "application/mathml-content+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mathml-presentation+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-associated-procedure-description+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-deregister+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-envelope+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-msk+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-msk-response+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-protection-description+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-reception-report+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-register+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-register-response+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-schedule+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbms-user-service-description+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mbox": {
        source: "iana",
        extensions: ["mbox"]
      },
      "application/media-policy-dataset+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mpf"]
      },
      "application/media_control+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mediaservercontrol+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mscml"]
      },
      "application/merge-patch+json": {
        source: "iana",
        compressible: !0
      },
      "application/metalink+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["metalink"]
      },
      "application/metalink4+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["meta4"]
      },
      "application/mets+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mets"]
      },
      "application/mf4": {
        source: "iana"
      },
      "application/mikey": {
        source: "iana"
      },
      "application/mipc": {
        source: "iana"
      },
      "application/missing-blocks+cbor-seq": {
        source: "iana"
      },
      "application/mmt-aei+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["maei"]
      },
      "application/mmt-usd+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["musd"]
      },
      "application/mods+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mods"]
      },
      "application/moss-keys": {
        source: "iana"
      },
      "application/moss-signature": {
        source: "iana"
      },
      "application/mosskey-data": {
        source: "iana"
      },
      "application/mosskey-request": {
        source: "iana"
      },
      "application/mp21": {
        source: "iana",
        extensions: ["m21", "mp21"]
      },
      "application/mp4": {
        source: "iana",
        extensions: ["mp4s", "m4p"]
      },
      "application/mpeg4-generic": {
        source: "iana"
      },
      "application/mpeg4-iod": {
        source: "iana"
      },
      "application/mpeg4-iod-xmt": {
        source: "iana"
      },
      "application/mrb-consumer+xml": {
        source: "iana",
        compressible: !0
      },
      "application/mrb-publish+xml": {
        source: "iana",
        compressible: !0
      },
      "application/msc-ivr+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/msc-mixer+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/msword": {
        source: "iana",
        compressible: !1,
        extensions: ["doc", "dot"]
      },
      "application/mud+json": {
        source: "iana",
        compressible: !0
      },
      "application/multipart-core": {
        source: "iana"
      },
      "application/mxf": {
        source: "iana",
        extensions: ["mxf"]
      },
      "application/n-quads": {
        source: "iana",
        extensions: ["nq"]
      },
      "application/n-triples": {
        source: "iana",
        extensions: ["nt"]
      },
      "application/nasdata": {
        source: "iana"
      },
      "application/news-checkgroups": {
        source: "iana",
        charset: "US-ASCII"
      },
      "application/news-groupinfo": {
        source: "iana",
        charset: "US-ASCII"
      },
      "application/news-transmission": {
        source: "iana"
      },
      "application/nlsml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/node": {
        source: "iana",
        extensions: ["cjs"]
      },
      "application/nss": {
        source: "iana"
      },
      "application/oauth-authz-req+jwt": {
        source: "iana"
      },
      "application/oblivious-dns-message": {
        source: "iana"
      },
      "application/ocsp-request": {
        source: "iana"
      },
      "application/ocsp-response": {
        source: "iana"
      },
      "application/octet-stream": {
        source: "iana",
        compressible: !1,
        extensions: ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"]
      },
      "application/oda": {
        source: "iana",
        extensions: ["oda"]
      },
      "application/odm+xml": {
        source: "iana",
        compressible: !0
      },
      "application/odx": {
        source: "iana"
      },
      "application/oebps-package+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["opf"]
      },
      "application/ogg": {
        source: "iana",
        compressible: !1,
        extensions: ["ogx"]
      },
      "application/omdoc+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["omdoc"]
      },
      "application/onenote": {
        source: "apache",
        extensions: ["onetoc", "onetoc2", "onetmp", "onepkg"]
      },
      "application/opc-nodeset+xml": {
        source: "iana",
        compressible: !0
      },
      "application/oscore": {
        source: "iana"
      },
      "application/oxps": {
        source: "iana",
        extensions: ["oxps"]
      },
      "application/p21": {
        source: "iana"
      },
      "application/p21+zip": {
        source: "iana",
        compressible: !1
      },
      "application/p2p-overlay+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["relo"]
      },
      "application/parityfec": {
        source: "iana"
      },
      "application/passport": {
        source: "iana"
      },
      "application/patch-ops-error+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xer"]
      },
      "application/pdf": {
        source: "iana",
        compressible: !1,
        extensions: ["pdf"]
      },
      "application/pdx": {
        source: "iana"
      },
      "application/pem-certificate-chain": {
        source: "iana"
      },
      "application/pgp-encrypted": {
        source: "iana",
        compressible: !1,
        extensions: ["pgp"]
      },
      "application/pgp-keys": {
        source: "iana",
        extensions: ["asc"]
      },
      "application/pgp-signature": {
        source: "iana",
        extensions: ["asc", "sig"]
      },
      "application/pics-rules": {
        source: "apache",
        extensions: ["prf"]
      },
      "application/pidf+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/pidf-diff+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/pkcs10": {
        source: "iana",
        extensions: ["p10"]
      },
      "application/pkcs12": {
        source: "iana"
      },
      "application/pkcs7-mime": {
        source: "iana",
        extensions: ["p7m", "p7c"]
      },
      "application/pkcs7-signature": {
        source: "iana",
        extensions: ["p7s"]
      },
      "application/pkcs8": {
        source: "iana",
        extensions: ["p8"]
      },
      "application/pkcs8-encrypted": {
        source: "iana"
      },
      "application/pkix-attr-cert": {
        source: "iana",
        extensions: ["ac"]
      },
      "application/pkix-cert": {
        source: "iana",
        extensions: ["cer"]
      },
      "application/pkix-crl": {
        source: "iana",
        extensions: ["crl"]
      },
      "application/pkix-pkipath": {
        source: "iana",
        extensions: ["pkipath"]
      },
      "application/pkixcmp": {
        source: "iana",
        extensions: ["pki"]
      },
      "application/pls+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["pls"]
      },
      "application/poc-settings+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/postscript": {
        source: "iana",
        compressible: !0,
        extensions: ["ai", "eps", "ps"]
      },
      "application/ppsp-tracker+json": {
        source: "iana",
        compressible: !0
      },
      "application/problem+json": {
        source: "iana",
        compressible: !0
      },
      "application/problem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/provenance+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["provx"]
      },
      "application/prs.alvestrand.titrax-sheet": {
        source: "iana"
      },
      "application/prs.cww": {
        source: "iana",
        extensions: ["cww"]
      },
      "application/prs.cyn": {
        source: "iana",
        charset: "7-BIT"
      },
      "application/prs.hpub+zip": {
        source: "iana",
        compressible: !1
      },
      "application/prs.nprend": {
        source: "iana"
      },
      "application/prs.plucker": {
        source: "iana"
      },
      "application/prs.rdf-xml-crypt": {
        source: "iana"
      },
      "application/prs.xsf+xml": {
        source: "iana",
        compressible: !0
      },
      "application/pskc+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["pskcxml"]
      },
      "application/pvd+json": {
        source: "iana",
        compressible: !0
      },
      "application/qsig": {
        source: "iana"
      },
      "application/raml+yaml": {
        compressible: !0,
        extensions: ["raml"]
      },
      "application/raptorfec": {
        source: "iana"
      },
      "application/rdap+json": {
        source: "iana",
        compressible: !0
      },
      "application/rdf+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rdf", "owl"]
      },
      "application/reginfo+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rif"]
      },
      "application/relax-ng-compact-syntax": {
        source: "iana",
        extensions: ["rnc"]
      },
      "application/remote-printing": {
        source: "iana"
      },
      "application/reputon+json": {
        source: "iana",
        compressible: !0
      },
      "application/resource-lists+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rl"]
      },
      "application/resource-lists-diff+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rld"]
      },
      "application/rfc+xml": {
        source: "iana",
        compressible: !0
      },
      "application/riscos": {
        source: "iana"
      },
      "application/rlmi+xml": {
        source: "iana",
        compressible: !0
      },
      "application/rls-services+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rs"]
      },
      "application/route-apd+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rapd"]
      },
      "application/route-s-tsid+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["sls"]
      },
      "application/route-usd+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rusd"]
      },
      "application/rpki-ghostbusters": {
        source: "iana",
        extensions: ["gbr"]
      },
      "application/rpki-manifest": {
        source: "iana",
        extensions: ["mft"]
      },
      "application/rpki-publication": {
        source: "iana"
      },
      "application/rpki-roa": {
        source: "iana",
        extensions: ["roa"]
      },
      "application/rpki-updown": {
        source: "iana"
      },
      "application/rsd+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["rsd"]
      },
      "application/rss+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["rss"]
      },
      "application/rtf": {
        source: "iana",
        compressible: !0,
        extensions: ["rtf"]
      },
      "application/rtploopback": {
        source: "iana"
      },
      "application/rtx": {
        source: "iana"
      },
      "application/samlassertion+xml": {
        source: "iana",
        compressible: !0
      },
      "application/samlmetadata+xml": {
        source: "iana",
        compressible: !0
      },
      "application/sarif+json": {
        source: "iana",
        compressible: !0
      },
      "application/sarif-external-properties+json": {
        source: "iana",
        compressible: !0
      },
      "application/sbe": {
        source: "iana"
      },
      "application/sbml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["sbml"]
      },
      "application/scaip+xml": {
        source: "iana",
        compressible: !0
      },
      "application/scim+json": {
        source: "iana",
        compressible: !0
      },
      "application/scvp-cv-request": {
        source: "iana",
        extensions: ["scq"]
      },
      "application/scvp-cv-response": {
        source: "iana",
        extensions: ["scs"]
      },
      "application/scvp-vp-request": {
        source: "iana",
        extensions: ["spq"]
      },
      "application/scvp-vp-response": {
        source: "iana",
        extensions: ["spp"]
      },
      "application/sdp": {
        source: "iana",
        extensions: ["sdp"]
      },
      "application/secevent+jwt": {
        source: "iana"
      },
      "application/senml+cbor": {
        source: "iana"
      },
      "application/senml+json": {
        source: "iana",
        compressible: !0
      },
      "application/senml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["senmlx"]
      },
      "application/senml-etch+cbor": {
        source: "iana"
      },
      "application/senml-etch+json": {
        source: "iana",
        compressible: !0
      },
      "application/senml-exi": {
        source: "iana"
      },
      "application/sensml+cbor": {
        source: "iana"
      },
      "application/sensml+json": {
        source: "iana",
        compressible: !0
      },
      "application/sensml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["sensmlx"]
      },
      "application/sensml-exi": {
        source: "iana"
      },
      "application/sep+xml": {
        source: "iana",
        compressible: !0
      },
      "application/sep-exi": {
        source: "iana"
      },
      "application/session-info": {
        source: "iana"
      },
      "application/set-payment": {
        source: "iana"
      },
      "application/set-payment-initiation": {
        source: "iana",
        extensions: ["setpay"]
      },
      "application/set-registration": {
        source: "iana"
      },
      "application/set-registration-initiation": {
        source: "iana",
        extensions: ["setreg"]
      },
      "application/sgml": {
        source: "iana"
      },
      "application/sgml-open-catalog": {
        source: "iana"
      },
      "application/shf+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["shf"]
      },
      "application/sieve": {
        source: "iana",
        extensions: ["siv", "sieve"]
      },
      "application/simple-filter+xml": {
        source: "iana",
        compressible: !0
      },
      "application/simple-message-summary": {
        source: "iana"
      },
      "application/simplesymbolcontainer": {
        source: "iana"
      },
      "application/sipc": {
        source: "iana"
      },
      "application/slate": {
        source: "iana"
      },
      "application/smil": {
        source: "iana"
      },
      "application/smil+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["smi", "smil"]
      },
      "application/smpte336m": {
        source: "iana"
      },
      "application/soap+fastinfoset": {
        source: "iana"
      },
      "application/soap+xml": {
        source: "iana",
        compressible: !0
      },
      "application/sparql-query": {
        source: "iana",
        extensions: ["rq"]
      },
      "application/sparql-results+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["srx"]
      },
      "application/spdx+json": {
        source: "iana",
        compressible: !0
      },
      "application/spirits-event+xml": {
        source: "iana",
        compressible: !0
      },
      "application/sql": {
        source: "iana"
      },
      "application/srgs": {
        source: "iana",
        extensions: ["gram"]
      },
      "application/srgs+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["grxml"]
      },
      "application/sru+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["sru"]
      },
      "application/ssdl+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["ssdl"]
      },
      "application/ssml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["ssml"]
      },
      "application/stix+json": {
        source: "iana",
        compressible: !0
      },
      "application/swid+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["swidtag"]
      },
      "application/tamp-apex-update": {
        source: "iana"
      },
      "application/tamp-apex-update-confirm": {
        source: "iana"
      },
      "application/tamp-community-update": {
        source: "iana"
      },
      "application/tamp-community-update-confirm": {
        source: "iana"
      },
      "application/tamp-error": {
        source: "iana"
      },
      "application/tamp-sequence-adjust": {
        source: "iana"
      },
      "application/tamp-sequence-adjust-confirm": {
        source: "iana"
      },
      "application/tamp-status-query": {
        source: "iana"
      },
      "application/tamp-status-response": {
        source: "iana"
      },
      "application/tamp-update": {
        source: "iana"
      },
      "application/tamp-update-confirm": {
        source: "iana"
      },
      "application/tar": {
        compressible: !0
      },
      "application/taxii+json": {
        source: "iana",
        compressible: !0
      },
      "application/td+json": {
        source: "iana",
        compressible: !0
      },
      "application/tei+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["tei", "teicorpus"]
      },
      "application/tetra_isi": {
        source: "iana"
      },
      "application/thraud+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["tfi"]
      },
      "application/timestamp-query": {
        source: "iana"
      },
      "application/timestamp-reply": {
        source: "iana"
      },
      "application/timestamped-data": {
        source: "iana",
        extensions: ["tsd"]
      },
      "application/tlsrpt+gzip": {
        source: "iana"
      },
      "application/tlsrpt+json": {
        source: "iana",
        compressible: !0
      },
      "application/tnauthlist": {
        source: "iana"
      },
      "application/token-introspection+jwt": {
        source: "iana"
      },
      "application/toml": {
        compressible: !0,
        extensions: ["toml"]
      },
      "application/trickle-ice-sdpfrag": {
        source: "iana"
      },
      "application/trig": {
        source: "iana",
        extensions: ["trig"]
      },
      "application/ttml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["ttml"]
      },
      "application/tve-trigger": {
        source: "iana"
      },
      "application/tzif": {
        source: "iana"
      },
      "application/tzif-leap": {
        source: "iana"
      },
      "application/ubjson": {
        compressible: !1,
        extensions: ["ubj"]
      },
      "application/ulpfec": {
        source: "iana"
      },
      "application/urc-grpsheet+xml": {
        source: "iana",
        compressible: !0
      },
      "application/urc-ressheet+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["rsheet"]
      },
      "application/urc-targetdesc+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["td"]
      },
      "application/urc-uisocketdesc+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vcard+json": {
        source: "iana",
        compressible: !0
      },
      "application/vcard+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vemmi": {
        source: "iana"
      },
      "application/vividence.scriptfile": {
        source: "apache"
      },
      "application/vnd.1000minds.decision-model+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["1km"]
      },
      "application/vnd.3gpp-prose+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp-prose-pc3ch+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp-v2x-local-service-information": {
        source: "iana"
      },
      "application/vnd.3gpp.5gnas": {
        source: "iana"
      },
      "application/vnd.3gpp.access-transfer-events+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.bsf+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.gmop+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.gtpc": {
        source: "iana"
      },
      "application/vnd.3gpp.interworking-data": {
        source: "iana"
      },
      "application/vnd.3gpp.lpp": {
        source: "iana"
      },
      "application/vnd.3gpp.mc-signalling-ear": {
        source: "iana"
      },
      "application/vnd.3gpp.mcdata-affiliation-command+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcdata-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcdata-payload": {
        source: "iana"
      },
      "application/vnd.3gpp.mcdata-service-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcdata-signalling": {
        source: "iana"
      },
      "application/vnd.3gpp.mcdata-ue-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcdata-user-profile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-affiliation-command+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-floor-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-location-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-mbms-usage-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-service-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-signed+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-ue-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-ue-init-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcptt-user-profile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-affiliation-command+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-affiliation-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-location-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-mbms-usage-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-service-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-transmission-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-ue-config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mcvideo-user-profile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.mid-call+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.ngap": {
        source: "iana"
      },
      "application/vnd.3gpp.pfcp": {
        source: "iana"
      },
      "application/vnd.3gpp.pic-bw-large": {
        source: "iana",
        extensions: ["plb"]
      },
      "application/vnd.3gpp.pic-bw-small": {
        source: "iana",
        extensions: ["psb"]
      },
      "application/vnd.3gpp.pic-bw-var": {
        source: "iana",
        extensions: ["pvb"]
      },
      "application/vnd.3gpp.s1ap": {
        source: "iana"
      },
      "application/vnd.3gpp.sms": {
        source: "iana"
      },
      "application/vnd.3gpp.sms+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.srvcc-ext+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.srvcc-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.state-and-event-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp.ussd+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp2.bcmcsinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.3gpp2.sms": {
        source: "iana"
      },
      "application/vnd.3gpp2.tcap": {
        source: "iana",
        extensions: ["tcap"]
      },
      "application/vnd.3lightssoftware.imagescal": {
        source: "iana"
      },
      "application/vnd.3m.post-it-notes": {
        source: "iana",
        extensions: ["pwn"]
      },
      "application/vnd.accpac.simply.aso": {
        source: "iana",
        extensions: ["aso"]
      },
      "application/vnd.accpac.simply.imp": {
        source: "iana",
        extensions: ["imp"]
      },
      "application/vnd.acucobol": {
        source: "iana",
        extensions: ["acu"]
      },
      "application/vnd.acucorp": {
        source: "iana",
        extensions: ["atc", "acutc"]
      },
      "application/vnd.adobe.air-application-installer-package+zip": {
        source: "apache",
        compressible: !1,
        extensions: ["air"]
      },
      "application/vnd.adobe.flash.movie": {
        source: "iana"
      },
      "application/vnd.adobe.formscentral.fcdt": {
        source: "iana",
        extensions: ["fcdt"]
      },
      "application/vnd.adobe.fxp": {
        source: "iana",
        extensions: ["fxp", "fxpl"]
      },
      "application/vnd.adobe.partial-upload": {
        source: "iana"
      },
      "application/vnd.adobe.xdp+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xdp"]
      },
      "application/vnd.adobe.xfdf": {
        source: "iana",
        extensions: ["xfdf"]
      },
      "application/vnd.aether.imp": {
        source: "iana"
      },
      "application/vnd.afpc.afplinedata": {
        source: "iana"
      },
      "application/vnd.afpc.afplinedata-pagedef": {
        source: "iana"
      },
      "application/vnd.afpc.cmoca-cmresource": {
        source: "iana"
      },
      "application/vnd.afpc.foca-charset": {
        source: "iana"
      },
      "application/vnd.afpc.foca-codedfont": {
        source: "iana"
      },
      "application/vnd.afpc.foca-codepage": {
        source: "iana"
      },
      "application/vnd.afpc.modca": {
        source: "iana"
      },
      "application/vnd.afpc.modca-cmtable": {
        source: "iana"
      },
      "application/vnd.afpc.modca-formdef": {
        source: "iana"
      },
      "application/vnd.afpc.modca-mediummap": {
        source: "iana"
      },
      "application/vnd.afpc.modca-objectcontainer": {
        source: "iana"
      },
      "application/vnd.afpc.modca-overlay": {
        source: "iana"
      },
      "application/vnd.afpc.modca-pagesegment": {
        source: "iana"
      },
      "application/vnd.age": {
        source: "iana",
        extensions: ["age"]
      },
      "application/vnd.ah-barcode": {
        source: "iana"
      },
      "application/vnd.ahead.space": {
        source: "iana",
        extensions: ["ahead"]
      },
      "application/vnd.airzip.filesecure.azf": {
        source: "iana",
        extensions: ["azf"]
      },
      "application/vnd.airzip.filesecure.azs": {
        source: "iana",
        extensions: ["azs"]
      },
      "application/vnd.amadeus+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.amazon.ebook": {
        source: "apache",
        extensions: ["azw"]
      },
      "application/vnd.amazon.mobi8-ebook": {
        source: "iana"
      },
      "application/vnd.americandynamics.acc": {
        source: "iana",
        extensions: ["acc"]
      },
      "application/vnd.amiga.ami": {
        source: "iana",
        extensions: ["ami"]
      },
      "application/vnd.amundsen.maze+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.android.ota": {
        source: "iana"
      },
      "application/vnd.android.package-archive": {
        source: "apache",
        compressible: !1,
        extensions: ["apk"]
      },
      "application/vnd.anki": {
        source: "iana"
      },
      "application/vnd.anser-web-certificate-issue-initiation": {
        source: "iana",
        extensions: ["cii"]
      },
      "application/vnd.anser-web-funds-transfer-initiation": {
        source: "apache",
        extensions: ["fti"]
      },
      "application/vnd.antix.game-component": {
        source: "iana",
        extensions: ["atx"]
      },
      "application/vnd.apache.arrow.file": {
        source: "iana"
      },
      "application/vnd.apache.arrow.stream": {
        source: "iana"
      },
      "application/vnd.apache.thrift.binary": {
        source: "iana"
      },
      "application/vnd.apache.thrift.compact": {
        source: "iana"
      },
      "application/vnd.apache.thrift.json": {
        source: "iana"
      },
      "application/vnd.api+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.aplextor.warrp+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.apothekende.reservation+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.apple.installer+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mpkg"]
      },
      "application/vnd.apple.keynote": {
        source: "iana",
        extensions: ["key"]
      },
      "application/vnd.apple.mpegurl": {
        source: "iana",
        extensions: ["m3u8"]
      },
      "application/vnd.apple.numbers": {
        source: "iana",
        extensions: ["numbers"]
      },
      "application/vnd.apple.pages": {
        source: "iana",
        extensions: ["pages"]
      },
      "application/vnd.apple.pkpass": {
        compressible: !1,
        extensions: ["pkpass"]
      },
      "application/vnd.arastra.swi": {
        source: "iana"
      },
      "application/vnd.aristanetworks.swi": {
        source: "iana",
        extensions: ["swi"]
      },
      "application/vnd.artisan+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.artsquare": {
        source: "iana"
      },
      "application/vnd.astraea-software.iota": {
        source: "iana",
        extensions: ["iota"]
      },
      "application/vnd.audiograph": {
        source: "iana",
        extensions: ["aep"]
      },
      "application/vnd.autopackage": {
        source: "iana"
      },
      "application/vnd.avalon+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.avistar+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.balsamiq.bmml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["bmml"]
      },
      "application/vnd.balsamiq.bmpr": {
        source: "iana"
      },
      "application/vnd.banana-accounting": {
        source: "iana"
      },
      "application/vnd.bbf.usp.error": {
        source: "iana"
      },
      "application/vnd.bbf.usp.msg": {
        source: "iana"
      },
      "application/vnd.bbf.usp.msg+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.bekitzur-stech+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.bint.med-content": {
        source: "iana"
      },
      "application/vnd.biopax.rdf+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.blink-idb-value-wrapper": {
        source: "iana"
      },
      "application/vnd.blueice.multipass": {
        source: "iana",
        extensions: ["mpm"]
      },
      "application/vnd.bluetooth.ep.oob": {
        source: "iana"
      },
      "application/vnd.bluetooth.le.oob": {
        source: "iana"
      },
      "application/vnd.bmi": {
        source: "iana",
        extensions: ["bmi"]
      },
      "application/vnd.bpf": {
        source: "iana"
      },
      "application/vnd.bpf3": {
        source: "iana"
      },
      "application/vnd.businessobjects": {
        source: "iana",
        extensions: ["rep"]
      },
      "application/vnd.byu.uapi+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cab-jscript": {
        source: "iana"
      },
      "application/vnd.canon-cpdl": {
        source: "iana"
      },
      "application/vnd.canon-lips": {
        source: "iana"
      },
      "application/vnd.capasystems-pg+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cendio.thinlinc.clientconf": {
        source: "iana"
      },
      "application/vnd.century-systems.tcp_stream": {
        source: "iana"
      },
      "application/vnd.chemdraw+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["cdxml"]
      },
      "application/vnd.chess-pgn": {
        source: "iana"
      },
      "application/vnd.chipnuts.karaoke-mmd": {
        source: "iana",
        extensions: ["mmd"]
      },
      "application/vnd.ciedi": {
        source: "iana"
      },
      "application/vnd.cinderella": {
        source: "iana",
        extensions: ["cdy"]
      },
      "application/vnd.cirpack.isdn-ext": {
        source: "iana"
      },
      "application/vnd.citationstyles.style+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["csl"]
      },
      "application/vnd.claymore": {
        source: "iana",
        extensions: ["cla"]
      },
      "application/vnd.cloanto.rp9": {
        source: "iana",
        extensions: ["rp9"]
      },
      "application/vnd.clonk.c4group": {
        source: "iana",
        extensions: ["c4g", "c4d", "c4f", "c4p", "c4u"]
      },
      "application/vnd.cluetrust.cartomobile-config": {
        source: "iana",
        extensions: ["c11amc"]
      },
      "application/vnd.cluetrust.cartomobile-config-pkg": {
        source: "iana",
        extensions: ["c11amz"]
      },
      "application/vnd.coffeescript": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.document": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.document-template": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.presentation": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.presentation-template": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.spreadsheet": {
        source: "iana"
      },
      "application/vnd.collabio.xodocuments.spreadsheet-template": {
        source: "iana"
      },
      "application/vnd.collection+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.collection.doc+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.collection.next+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.comicbook+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.comicbook-rar": {
        source: "iana"
      },
      "application/vnd.commerce-battelle": {
        source: "iana"
      },
      "application/vnd.commonspace": {
        source: "iana",
        extensions: ["csp"]
      },
      "application/vnd.contact.cmsg": {
        source: "iana",
        extensions: ["cdbcmsg"]
      },
      "application/vnd.coreos.ignition+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cosmocaller": {
        source: "iana",
        extensions: ["cmc"]
      },
      "application/vnd.crick.clicker": {
        source: "iana",
        extensions: ["clkx"]
      },
      "application/vnd.crick.clicker.keyboard": {
        source: "iana",
        extensions: ["clkk"]
      },
      "application/vnd.crick.clicker.palette": {
        source: "iana",
        extensions: ["clkp"]
      },
      "application/vnd.crick.clicker.template": {
        source: "iana",
        extensions: ["clkt"]
      },
      "application/vnd.crick.clicker.wordbank": {
        source: "iana",
        extensions: ["clkw"]
      },
      "application/vnd.criticaltools.wbs+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["wbs"]
      },
      "application/vnd.cryptii.pipe+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.crypto-shade-file": {
        source: "iana"
      },
      "application/vnd.cryptomator.encrypted": {
        source: "iana"
      },
      "application/vnd.cryptomator.vault": {
        source: "iana"
      },
      "application/vnd.ctc-posml": {
        source: "iana",
        extensions: ["pml"]
      },
      "application/vnd.ctct.ws+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cups-pdf": {
        source: "iana"
      },
      "application/vnd.cups-postscript": {
        source: "iana"
      },
      "application/vnd.cups-ppd": {
        source: "iana",
        extensions: ["ppd"]
      },
      "application/vnd.cups-raster": {
        source: "iana"
      },
      "application/vnd.cups-raw": {
        source: "iana"
      },
      "application/vnd.curl": {
        source: "iana"
      },
      "application/vnd.curl.car": {
        source: "apache",
        extensions: ["car"]
      },
      "application/vnd.curl.pcurl": {
        source: "apache",
        extensions: ["pcurl"]
      },
      "application/vnd.cyan.dean.root+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cybank": {
        source: "iana"
      },
      "application/vnd.cyclonedx+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.cyclonedx+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.d2l.coursepackage1p0+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.d3m-dataset": {
        source: "iana"
      },
      "application/vnd.d3m-problem": {
        source: "iana"
      },
      "application/vnd.dart": {
        source: "iana",
        compressible: !0,
        extensions: ["dart"]
      },
      "application/vnd.data-vision.rdz": {
        source: "iana",
        extensions: ["rdz"]
      },
      "application/vnd.datapackage+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dataresource+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dbf": {
        source: "iana",
        extensions: ["dbf"]
      },
      "application/vnd.debian.binary-package": {
        source: "iana"
      },
      "application/vnd.dece.data": {
        source: "iana",
        extensions: ["uvf", "uvvf", "uvd", "uvvd"]
      },
      "application/vnd.dece.ttml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["uvt", "uvvt"]
      },
      "application/vnd.dece.unspecified": {
        source: "iana",
        extensions: ["uvx", "uvvx"]
      },
      "application/vnd.dece.zip": {
        source: "iana",
        extensions: ["uvz", "uvvz"]
      },
      "application/vnd.denovo.fcselayout-link": {
        source: "iana",
        extensions: ["fe_launch"]
      },
      "application/vnd.desmume.movie": {
        source: "iana"
      },
      "application/vnd.dir-bi.plate-dl-nosuffix": {
        source: "iana"
      },
      "application/vnd.dm.delegation+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dna": {
        source: "iana",
        extensions: ["dna"]
      },
      "application/vnd.document+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dolby.mlp": {
        source: "apache",
        extensions: ["mlp"]
      },
      "application/vnd.dolby.mobile.1": {
        source: "iana"
      },
      "application/vnd.dolby.mobile.2": {
        source: "iana"
      },
      "application/vnd.doremir.scorecloud-binary-document": {
        source: "iana"
      },
      "application/vnd.dpgraph": {
        source: "iana",
        extensions: ["dpg"]
      },
      "application/vnd.dreamfactory": {
        source: "iana",
        extensions: ["dfac"]
      },
      "application/vnd.drive+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ds-keypoint": {
        source: "apache",
        extensions: ["kpxx"]
      },
      "application/vnd.dtg.local": {
        source: "iana"
      },
      "application/vnd.dtg.local.flash": {
        source: "iana"
      },
      "application/vnd.dtg.local.html": {
        source: "iana"
      },
      "application/vnd.dvb.ait": {
        source: "iana",
        extensions: ["ait"]
      },
      "application/vnd.dvb.dvbisl+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.dvbj": {
        source: "iana"
      },
      "application/vnd.dvb.esgcontainer": {
        source: "iana"
      },
      "application/vnd.dvb.ipdcdftnotifaccess": {
        source: "iana"
      },
      "application/vnd.dvb.ipdcesgaccess": {
        source: "iana"
      },
      "application/vnd.dvb.ipdcesgaccess2": {
        source: "iana"
      },
      "application/vnd.dvb.ipdcesgpdd": {
        source: "iana"
      },
      "application/vnd.dvb.ipdcroaming": {
        source: "iana"
      },
      "application/vnd.dvb.iptv.alfec-base": {
        source: "iana"
      },
      "application/vnd.dvb.iptv.alfec-enhancement": {
        source: "iana"
      },
      "application/vnd.dvb.notif-aggregate-root+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-container+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-generic+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-ia-msglist+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-ia-registration-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-ia-registration-response+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.notif-init+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.dvb.pfr": {
        source: "iana"
      },
      "application/vnd.dvb.service": {
        source: "iana",
        extensions: ["svc"]
      },
      "application/vnd.dxr": {
        source: "iana"
      },
      "application/vnd.dynageo": {
        source: "iana",
        extensions: ["geo"]
      },
      "application/vnd.dzr": {
        source: "iana"
      },
      "application/vnd.easykaraoke.cdgdownload": {
        source: "iana"
      },
      "application/vnd.ecdis-update": {
        source: "iana"
      },
      "application/vnd.ecip.rlp": {
        source: "iana"
      },
      "application/vnd.eclipse.ditto+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ecowin.chart": {
        source: "iana",
        extensions: ["mag"]
      },
      "application/vnd.ecowin.filerequest": {
        source: "iana"
      },
      "application/vnd.ecowin.fileupdate": {
        source: "iana"
      },
      "application/vnd.ecowin.series": {
        source: "iana"
      },
      "application/vnd.ecowin.seriesrequest": {
        source: "iana"
      },
      "application/vnd.ecowin.seriesupdate": {
        source: "iana"
      },
      "application/vnd.efi.img": {
        source: "iana"
      },
      "application/vnd.efi.iso": {
        source: "iana"
      },
      "application/vnd.emclient.accessrequest+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.enliven": {
        source: "iana",
        extensions: ["nml"]
      },
      "application/vnd.enphase.envoy": {
        source: "iana"
      },
      "application/vnd.eprints.data+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.epson.esf": {
        source: "iana",
        extensions: ["esf"]
      },
      "application/vnd.epson.msf": {
        source: "iana",
        extensions: ["msf"]
      },
      "application/vnd.epson.quickanime": {
        source: "iana",
        extensions: ["qam"]
      },
      "application/vnd.epson.salt": {
        source: "iana",
        extensions: ["slt"]
      },
      "application/vnd.epson.ssf": {
        source: "iana",
        extensions: ["ssf"]
      },
      "application/vnd.ericsson.quickcall": {
        source: "iana"
      },
      "application/vnd.espass-espass+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.eszigno3+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["es3", "et3"]
      },
      "application/vnd.etsi.aoc+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.asic-e+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.etsi.asic-s+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.etsi.cug+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvcommand+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvdiscovery+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvprofile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvsad-bc+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvsad-cod+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvsad-npvr+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvservice+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvsync+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.iptvueprofile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.mcid+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.mheg5": {
        source: "iana"
      },
      "application/vnd.etsi.overload-control-policy-dataset+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.pstn+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.sci+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.simservs+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.timestamp-token": {
        source: "iana"
      },
      "application/vnd.etsi.tsl+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.etsi.tsl.der": {
        source: "iana"
      },
      "application/vnd.eu.kasparian.car+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.eudora.data": {
        source: "iana"
      },
      "application/vnd.evolv.ecig.profile": {
        source: "iana"
      },
      "application/vnd.evolv.ecig.settings": {
        source: "iana"
      },
      "application/vnd.evolv.ecig.theme": {
        source: "iana"
      },
      "application/vnd.exstream-empower+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.exstream-package": {
        source: "iana"
      },
      "application/vnd.ezpix-album": {
        source: "iana",
        extensions: ["ez2"]
      },
      "application/vnd.ezpix-package": {
        source: "iana",
        extensions: ["ez3"]
      },
      "application/vnd.f-secure.mobile": {
        source: "iana"
      },
      "application/vnd.familysearch.gedcom+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.fastcopy-disk-image": {
        source: "iana"
      },
      "application/vnd.fdf": {
        source: "iana",
        extensions: ["fdf"]
      },
      "application/vnd.fdsn.mseed": {
        source: "iana",
        extensions: ["mseed"]
      },
      "application/vnd.fdsn.seed": {
        source: "iana",
        extensions: ["seed", "dataless"]
      },
      "application/vnd.ffsns": {
        source: "iana"
      },
      "application/vnd.ficlab.flb+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.filmit.zfc": {
        source: "iana"
      },
      "application/vnd.fints": {
        source: "iana"
      },
      "application/vnd.firemonkeys.cloudcell": {
        source: "iana"
      },
      "application/vnd.flographit": {
        source: "iana",
        extensions: ["gph"]
      },
      "application/vnd.fluxtime.clip": {
        source: "iana",
        extensions: ["ftc"]
      },
      "application/vnd.font-fontforge-sfd": {
        source: "iana"
      },
      "application/vnd.framemaker": {
        source: "iana",
        extensions: ["fm", "frame", "maker", "book"]
      },
      "application/vnd.frogans.fnc": {
        source: "iana",
        extensions: ["fnc"]
      },
      "application/vnd.frogans.ltf": {
        source: "iana",
        extensions: ["ltf"]
      },
      "application/vnd.fsc.weblaunch": {
        source: "iana",
        extensions: ["fsc"]
      },
      "application/vnd.fujifilm.fb.docuworks": {
        source: "iana"
      },
      "application/vnd.fujifilm.fb.docuworks.binder": {
        source: "iana"
      },
      "application/vnd.fujifilm.fb.docuworks.container": {
        source: "iana"
      },
      "application/vnd.fujifilm.fb.jfi+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.fujitsu.oasys": {
        source: "iana",
        extensions: ["oas"]
      },
      "application/vnd.fujitsu.oasys2": {
        source: "iana",
        extensions: ["oa2"]
      },
      "application/vnd.fujitsu.oasys3": {
        source: "iana",
        extensions: ["oa3"]
      },
      "application/vnd.fujitsu.oasysgp": {
        source: "iana",
        extensions: ["fg5"]
      },
      "application/vnd.fujitsu.oasysprs": {
        source: "iana",
        extensions: ["bh2"]
      },
      "application/vnd.fujixerox.art-ex": {
        source: "iana"
      },
      "application/vnd.fujixerox.art4": {
        source: "iana"
      },
      "application/vnd.fujixerox.ddd": {
        source: "iana",
        extensions: ["ddd"]
      },
      "application/vnd.fujixerox.docuworks": {
        source: "iana",
        extensions: ["xdw"]
      },
      "application/vnd.fujixerox.docuworks.binder": {
        source: "iana",
        extensions: ["xbd"]
      },
      "application/vnd.fujixerox.docuworks.container": {
        source: "iana"
      },
      "application/vnd.fujixerox.hbpl": {
        source: "iana"
      },
      "application/vnd.fut-misnet": {
        source: "iana"
      },
      "application/vnd.futoin+cbor": {
        source: "iana"
      },
      "application/vnd.futoin+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.fuzzysheet": {
        source: "iana",
        extensions: ["fzs"]
      },
      "application/vnd.genomatix.tuxedo": {
        source: "iana",
        extensions: ["txd"]
      },
      "application/vnd.gentics.grd+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.geo+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.geocube+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.geogebra.file": {
        source: "iana",
        extensions: ["ggb"]
      },
      "application/vnd.geogebra.slides": {
        source: "iana"
      },
      "application/vnd.geogebra.tool": {
        source: "iana",
        extensions: ["ggt"]
      },
      "application/vnd.geometry-explorer": {
        source: "iana",
        extensions: ["gex", "gre"]
      },
      "application/vnd.geonext": {
        source: "iana",
        extensions: ["gxt"]
      },
      "application/vnd.geoplan": {
        source: "iana",
        extensions: ["g2w"]
      },
      "application/vnd.geospace": {
        source: "iana",
        extensions: ["g3w"]
      },
      "application/vnd.gerber": {
        source: "iana"
      },
      "application/vnd.globalplatform.card-content-mgt": {
        source: "iana"
      },
      "application/vnd.globalplatform.card-content-mgt-response": {
        source: "iana"
      },
      "application/vnd.gmx": {
        source: "iana",
        extensions: ["gmx"]
      },
      "application/vnd.google-apps.document": {
        compressible: !1,
        extensions: ["gdoc"]
      },
      "application/vnd.google-apps.presentation": {
        compressible: !1,
        extensions: ["gslides"]
      },
      "application/vnd.google-apps.spreadsheet": {
        compressible: !1,
        extensions: ["gsheet"]
      },
      "application/vnd.google-earth.kml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["kml"]
      },
      "application/vnd.google-earth.kmz": {
        source: "iana",
        compressible: !1,
        extensions: ["kmz"]
      },
      "application/vnd.gov.sk.e-form+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.gov.sk.e-form+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.gov.sk.xmldatacontainer+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.grafeq": {
        source: "iana",
        extensions: ["gqf", "gqs"]
      },
      "application/vnd.gridmp": {
        source: "iana"
      },
      "application/vnd.groove-account": {
        source: "iana",
        extensions: ["gac"]
      },
      "application/vnd.groove-help": {
        source: "iana",
        extensions: ["ghf"]
      },
      "application/vnd.groove-identity-message": {
        source: "iana",
        extensions: ["gim"]
      },
      "application/vnd.groove-injector": {
        source: "iana",
        extensions: ["grv"]
      },
      "application/vnd.groove-tool-message": {
        source: "iana",
        extensions: ["gtm"]
      },
      "application/vnd.groove-tool-template": {
        source: "iana",
        extensions: ["tpl"]
      },
      "application/vnd.groove-vcard": {
        source: "iana",
        extensions: ["vcg"]
      },
      "application/vnd.hal+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hal+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["hal"]
      },
      "application/vnd.handheld-entertainment+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["zmm"]
      },
      "application/vnd.hbci": {
        source: "iana",
        extensions: ["hbci"]
      },
      "application/vnd.hc+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hcl-bireports": {
        source: "iana"
      },
      "application/vnd.hdt": {
        source: "iana"
      },
      "application/vnd.heroku+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hhe.lesson-player": {
        source: "iana",
        extensions: ["les"]
      },
      "application/vnd.hl7cda+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.hl7v2+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.hp-hpgl": {
        source: "iana",
        extensions: ["hpgl"]
      },
      "application/vnd.hp-hpid": {
        source: "iana",
        extensions: ["hpid"]
      },
      "application/vnd.hp-hps": {
        source: "iana",
        extensions: ["hps"]
      },
      "application/vnd.hp-jlyt": {
        source: "iana",
        extensions: ["jlt"]
      },
      "application/vnd.hp-pcl": {
        source: "iana",
        extensions: ["pcl"]
      },
      "application/vnd.hp-pclxl": {
        source: "iana",
        extensions: ["pclxl"]
      },
      "application/vnd.httphone": {
        source: "iana"
      },
      "application/vnd.hydrostatix.sof-data": {
        source: "iana",
        extensions: ["sfd-hdstx"]
      },
      "application/vnd.hyper+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hyper-item+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hyperdrive+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.hzn-3d-crossword": {
        source: "iana"
      },
      "application/vnd.ibm.afplinedata": {
        source: "iana"
      },
      "application/vnd.ibm.electronic-media": {
        source: "iana"
      },
      "application/vnd.ibm.minipay": {
        source: "iana",
        extensions: ["mpy"]
      },
      "application/vnd.ibm.modcap": {
        source: "iana",
        extensions: ["afp", "listafp", "list3820"]
      },
      "application/vnd.ibm.rights-management": {
        source: "iana",
        extensions: ["irm"]
      },
      "application/vnd.ibm.secure-container": {
        source: "iana",
        extensions: ["sc"]
      },
      "application/vnd.iccprofile": {
        source: "iana",
        extensions: ["icc", "icm"]
      },
      "application/vnd.ieee.1905": {
        source: "iana"
      },
      "application/vnd.igloader": {
        source: "iana",
        extensions: ["igl"]
      },
      "application/vnd.imagemeter.folder+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.imagemeter.image+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.immervision-ivp": {
        source: "iana",
        extensions: ["ivp"]
      },
      "application/vnd.immervision-ivu": {
        source: "iana",
        extensions: ["ivu"]
      },
      "application/vnd.ims.imsccv1p1": {
        source: "iana"
      },
      "application/vnd.ims.imsccv1p2": {
        source: "iana"
      },
      "application/vnd.ims.imsccv1p3": {
        source: "iana"
      },
      "application/vnd.ims.lis.v2.result+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ims.lti.v2.toolconsumerprofile+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ims.lti.v2.toolproxy+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ims.lti.v2.toolproxy.id+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ims.lti.v2.toolsettings+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ims.lti.v2.toolsettings.simple+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.informedcontrol.rms+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.informix-visionary": {
        source: "iana"
      },
      "application/vnd.infotech.project": {
        source: "iana"
      },
      "application/vnd.infotech.project+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.innopath.wamp.notification": {
        source: "iana"
      },
      "application/vnd.insors.igm": {
        source: "iana",
        extensions: ["igm"]
      },
      "application/vnd.intercon.formnet": {
        source: "iana",
        extensions: ["xpw", "xpx"]
      },
      "application/vnd.intergeo": {
        source: "iana",
        extensions: ["i2g"]
      },
      "application/vnd.intertrust.digibox": {
        source: "iana"
      },
      "application/vnd.intertrust.nncp": {
        source: "iana"
      },
      "application/vnd.intu.qbo": {
        source: "iana",
        extensions: ["qbo"]
      },
      "application/vnd.intu.qfx": {
        source: "iana",
        extensions: ["qfx"]
      },
      "application/vnd.iptc.g2.catalogitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.conceptitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.knowledgeitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.newsitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.newsmessage+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.packageitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.iptc.g2.planningitem+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ipunplugged.rcprofile": {
        source: "iana",
        extensions: ["rcprofile"]
      },
      "application/vnd.irepository.package+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["irp"]
      },
      "application/vnd.is-xpr": {
        source: "iana",
        extensions: ["xpr"]
      },
      "application/vnd.isac.fcs": {
        source: "iana",
        extensions: ["fcs"]
      },
      "application/vnd.iso11783-10+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.jam": {
        source: "iana",
        extensions: ["jam"]
      },
      "application/vnd.japannet-directory-service": {
        source: "iana"
      },
      "application/vnd.japannet-jpnstore-wakeup": {
        source: "iana"
      },
      "application/vnd.japannet-payment-wakeup": {
        source: "iana"
      },
      "application/vnd.japannet-registration": {
        source: "iana"
      },
      "application/vnd.japannet-registration-wakeup": {
        source: "iana"
      },
      "application/vnd.japannet-setstore-wakeup": {
        source: "iana"
      },
      "application/vnd.japannet-verification": {
        source: "iana"
      },
      "application/vnd.japannet-verification-wakeup": {
        source: "iana"
      },
      "application/vnd.jcp.javame.midlet-rms": {
        source: "iana",
        extensions: ["rms"]
      },
      "application/vnd.jisp": {
        source: "iana",
        extensions: ["jisp"]
      },
      "application/vnd.joost.joda-archive": {
        source: "iana",
        extensions: ["joda"]
      },
      "application/vnd.jsk.isdn-ngn": {
        source: "iana"
      },
      "application/vnd.kahootz": {
        source: "iana",
        extensions: ["ktz", "ktr"]
      },
      "application/vnd.kde.karbon": {
        source: "iana",
        extensions: ["karbon"]
      },
      "application/vnd.kde.kchart": {
        source: "iana",
        extensions: ["chrt"]
      },
      "application/vnd.kde.kformula": {
        source: "iana",
        extensions: ["kfo"]
      },
      "application/vnd.kde.kivio": {
        source: "iana",
        extensions: ["flw"]
      },
      "application/vnd.kde.kontour": {
        source: "iana",
        extensions: ["kon"]
      },
      "application/vnd.kde.kpresenter": {
        source: "iana",
        extensions: ["kpr", "kpt"]
      },
      "application/vnd.kde.kspread": {
        source: "iana",
        extensions: ["ksp"]
      },
      "application/vnd.kde.kword": {
        source: "iana",
        extensions: ["kwd", "kwt"]
      },
      "application/vnd.kenameaapp": {
        source: "iana",
        extensions: ["htke"]
      },
      "application/vnd.kidspiration": {
        source: "iana",
        extensions: ["kia"]
      },
      "application/vnd.kinar": {
        source: "iana",
        extensions: ["kne", "knp"]
      },
      "application/vnd.koan": {
        source: "iana",
        extensions: ["skp", "skd", "skt", "skm"]
      },
      "application/vnd.kodak-descriptor": {
        source: "iana",
        extensions: ["sse"]
      },
      "application/vnd.las": {
        source: "iana"
      },
      "application/vnd.las.las+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.las.las+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["lasxml"]
      },
      "application/vnd.laszip": {
        source: "iana"
      },
      "application/vnd.leap+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.liberty-request+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.llamagraphics.life-balance.desktop": {
        source: "iana",
        extensions: ["lbd"]
      },
      "application/vnd.llamagraphics.life-balance.exchange+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["lbe"]
      },
      "application/vnd.logipipe.circuit+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.loom": {
        source: "iana"
      },
      "application/vnd.lotus-1-2-3": {
        source: "iana",
        extensions: ["123"]
      },
      "application/vnd.lotus-approach": {
        source: "iana",
        extensions: ["apr"]
      },
      "application/vnd.lotus-freelance": {
        source: "iana",
        extensions: ["pre"]
      },
      "application/vnd.lotus-notes": {
        source: "iana",
        extensions: ["nsf"]
      },
      "application/vnd.lotus-organizer": {
        source: "iana",
        extensions: ["org"]
      },
      "application/vnd.lotus-screencam": {
        source: "iana",
        extensions: ["scm"]
      },
      "application/vnd.lotus-wordpro": {
        source: "iana",
        extensions: ["lwp"]
      },
      "application/vnd.macports.portpkg": {
        source: "iana",
        extensions: ["portpkg"]
      },
      "application/vnd.mapbox-vector-tile": {
        source: "iana",
        extensions: ["mvt"]
      },
      "application/vnd.marlin.drm.actiontoken+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.marlin.drm.conftoken+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.marlin.drm.license+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.marlin.drm.mdcf": {
        source: "iana"
      },
      "application/vnd.mason+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.maxar.archive.3tz+zip": {
        source: "iana",
        compressible: !1
      },
      "application/vnd.maxmind.maxmind-db": {
        source: "iana"
      },
      "application/vnd.mcd": {
        source: "iana",
        extensions: ["mcd"]
      },
      "application/vnd.medcalcdata": {
        source: "iana",
        extensions: ["mc1"]
      },
      "application/vnd.mediastation.cdkey": {
        source: "iana",
        extensions: ["cdkey"]
      },
      "application/vnd.meridian-slingshot": {
        source: "iana"
      },
      "application/vnd.mfer": {
        source: "iana",
        extensions: ["mwf"]
      },
      "application/vnd.mfmp": {
        source: "iana",
        extensions: ["mfm"]
      },
      "application/vnd.micro+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.micrografx.flo": {
        source: "iana",
        extensions: ["flo"]
      },
      "application/vnd.micrografx.igx": {
        source: "iana",
        extensions: ["igx"]
      },
      "application/vnd.microsoft.portable-executable": {
        source: "iana"
      },
      "application/vnd.microsoft.windows.thumbnail-cache": {
        source: "iana"
      },
      "application/vnd.miele+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.mif": {
        source: "iana",
        extensions: ["mif"]
      },
      "application/vnd.minisoft-hp3000-save": {
        source: "iana"
      },
      "application/vnd.mitsubishi.misty-guard.trustweb": {
        source: "iana"
      },
      "application/vnd.mobius.daf": {
        source: "iana",
        extensions: ["daf"]
      },
      "application/vnd.mobius.dis": {
        source: "iana",
        extensions: ["dis"]
      },
      "application/vnd.mobius.mbk": {
        source: "iana",
        extensions: ["mbk"]
      },
      "application/vnd.mobius.mqy": {
        source: "iana",
        extensions: ["mqy"]
      },
      "application/vnd.mobius.msl": {
        source: "iana",
        extensions: ["msl"]
      },
      "application/vnd.mobius.plc": {
        source: "iana",
        extensions: ["plc"]
      },
      "application/vnd.mobius.txf": {
        source: "iana",
        extensions: ["txf"]
      },
      "application/vnd.mophun.application": {
        source: "iana",
        extensions: ["mpn"]
      },
      "application/vnd.mophun.certificate": {
        source: "iana",
        extensions: ["mpc"]
      },
      "application/vnd.motorola.flexsuite": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.adsi": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.fis": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.gotap": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.kmr": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.ttc": {
        source: "iana"
      },
      "application/vnd.motorola.flexsuite.wem": {
        source: "iana"
      },
      "application/vnd.motorola.iprm": {
        source: "iana"
      },
      "application/vnd.mozilla.xul+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xul"]
      },
      "application/vnd.ms-3mfdocument": {
        source: "iana"
      },
      "application/vnd.ms-artgalry": {
        source: "iana",
        extensions: ["cil"]
      },
      "application/vnd.ms-asf": {
        source: "iana"
      },
      "application/vnd.ms-cab-compressed": {
        source: "iana",
        extensions: ["cab"]
      },
      "application/vnd.ms-color.iccprofile": {
        source: "apache"
      },
      "application/vnd.ms-excel": {
        source: "iana",
        compressible: !1,
        extensions: ["xls", "xlm", "xla", "xlc", "xlt", "xlw"]
      },
      "application/vnd.ms-excel.addin.macroenabled.12": {
        source: "iana",
        extensions: ["xlam"]
      },
      "application/vnd.ms-excel.sheet.binary.macroenabled.12": {
        source: "iana",
        extensions: ["xlsb"]
      },
      "application/vnd.ms-excel.sheet.macroenabled.12": {
        source: "iana",
        extensions: ["xlsm"]
      },
      "application/vnd.ms-excel.template.macroenabled.12": {
        source: "iana",
        extensions: ["xltm"]
      },
      "application/vnd.ms-fontobject": {
        source: "iana",
        compressible: !0,
        extensions: ["eot"]
      },
      "application/vnd.ms-htmlhelp": {
        source: "iana",
        extensions: ["chm"]
      },
      "application/vnd.ms-ims": {
        source: "iana",
        extensions: ["ims"]
      },
      "application/vnd.ms-lrm": {
        source: "iana",
        extensions: ["lrm"]
      },
      "application/vnd.ms-office.activex+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ms-officetheme": {
        source: "iana",
        extensions: ["thmx"]
      },
      "application/vnd.ms-opentype": {
        source: "apache",
        compressible: !0
      },
      "application/vnd.ms-outlook": {
        compressible: !1,
        extensions: ["msg"]
      },
      "application/vnd.ms-package.obfuscated-opentype": {
        source: "apache"
      },
      "application/vnd.ms-pki.seccat": {
        source: "apache",
        extensions: ["cat"]
      },
      "application/vnd.ms-pki.stl": {
        source: "apache",
        extensions: ["stl"]
      },
      "application/vnd.ms-playready.initiator+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ms-powerpoint": {
        source: "iana",
        compressible: !1,
        extensions: ["ppt", "pps", "pot"]
      },
      "application/vnd.ms-powerpoint.addin.macroenabled.12": {
        source: "iana",
        extensions: ["ppam"]
      },
      "application/vnd.ms-powerpoint.presentation.macroenabled.12": {
        source: "iana",
        extensions: ["pptm"]
      },
      "application/vnd.ms-powerpoint.slide.macroenabled.12": {
        source: "iana",
        extensions: ["sldm"]
      },
      "application/vnd.ms-powerpoint.slideshow.macroenabled.12": {
        source: "iana",
        extensions: ["ppsm"]
      },
      "application/vnd.ms-powerpoint.template.macroenabled.12": {
        source: "iana",
        extensions: ["potm"]
      },
      "application/vnd.ms-printdevicecapabilities+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ms-printing.printticket+xml": {
        source: "apache",
        compressible: !0
      },
      "application/vnd.ms-printschematicket+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ms-project": {
        source: "iana",
        extensions: ["mpp", "mpt"]
      },
      "application/vnd.ms-tnef": {
        source: "iana"
      },
      "application/vnd.ms-windows.devicepairing": {
        source: "iana"
      },
      "application/vnd.ms-windows.nwprinting.oob": {
        source: "iana"
      },
      "application/vnd.ms-windows.printerpairing": {
        source: "iana"
      },
      "application/vnd.ms-windows.wsd.oob": {
        source: "iana"
      },
      "application/vnd.ms-wmdrm.lic-chlg-req": {
        source: "iana"
      },
      "application/vnd.ms-wmdrm.lic-resp": {
        source: "iana"
      },
      "application/vnd.ms-wmdrm.meter-chlg-req": {
        source: "iana"
      },
      "application/vnd.ms-wmdrm.meter-resp": {
        source: "iana"
      },
      "application/vnd.ms-word.document.macroenabled.12": {
        source: "iana",
        extensions: ["docm"]
      },
      "application/vnd.ms-word.template.macroenabled.12": {
        source: "iana",
        extensions: ["dotm"]
      },
      "application/vnd.ms-works": {
        source: "iana",
        extensions: ["wps", "wks", "wcm", "wdb"]
      },
      "application/vnd.ms-wpl": {
        source: "iana",
        extensions: ["wpl"]
      },
      "application/vnd.ms-xpsdocument": {
        source: "iana",
        compressible: !1,
        extensions: ["xps"]
      },
      "application/vnd.msa-disk-image": {
        source: "iana"
      },
      "application/vnd.mseq": {
        source: "iana",
        extensions: ["mseq"]
      },
      "application/vnd.msign": {
        source: "iana"
      },
      "application/vnd.multiad.creator": {
        source: "iana"
      },
      "application/vnd.multiad.creator.cif": {
        source: "iana"
      },
      "application/vnd.music-niff": {
        source: "iana"
      },
      "application/vnd.musician": {
        source: "iana",
        extensions: ["mus"]
      },
      "application/vnd.muvee.style": {
        source: "iana",
        extensions: ["msty"]
      },
      "application/vnd.mynfc": {
        source: "iana",
        extensions: ["taglet"]
      },
      "application/vnd.nacamar.ybrid+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.ncd.control": {
        source: "iana"
      },
      "application/vnd.ncd.reference": {
        source: "iana"
      },
      "application/vnd.nearst.inv+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nebumind.line": {
        source: "iana"
      },
      "application/vnd.nervana": {
        source: "iana"
      },
      "application/vnd.netfpx": {
        source: "iana"
      },
      "application/vnd.neurolanguage.nlu": {
        source: "iana",
        extensions: ["nlu"]
      },
      "application/vnd.nimn": {
        source: "iana"
      },
      "application/vnd.nintendo.nitro.rom": {
        source: "iana"
      },
      "application/vnd.nintendo.snes.rom": {
        source: "iana"
      },
      "application/vnd.nitf": {
        source: "iana",
        extensions: ["ntf", "nitf"]
      },
      "application/vnd.noblenet-directory": {
        source: "iana",
        extensions: ["nnd"]
      },
      "application/vnd.noblenet-sealer": {
        source: "iana",
        extensions: ["nns"]
      },
      "application/vnd.noblenet-web": {
        source: "iana",
        extensions: ["nnw"]
      },
      "application/vnd.nokia.catalogs": {
        source: "iana"
      },
      "application/vnd.nokia.conml+wbxml": {
        source: "iana"
      },
      "application/vnd.nokia.conml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nokia.iptv.config+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nokia.isds-radio-presets": {
        source: "iana"
      },
      "application/vnd.nokia.landmark+wbxml": {
        source: "iana"
      },
      "application/vnd.nokia.landmark+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nokia.landmarkcollection+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nokia.n-gage.ac+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["ac"]
      },
      "application/vnd.nokia.n-gage.data": {
        source: "iana",
        extensions: ["ngdat"]
      },
      "application/vnd.nokia.n-gage.symbian.install": {
        source: "iana",
        extensions: ["n-gage"]
      },
      "application/vnd.nokia.ncd": {
        source: "iana"
      },
      "application/vnd.nokia.pcd+wbxml": {
        source: "iana"
      },
      "application/vnd.nokia.pcd+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.nokia.radio-preset": {
        source: "iana",
        extensions: ["rpst"]
      },
      "application/vnd.nokia.radio-presets": {
        source: "iana",
        extensions: ["rpss"]
      },
      "application/vnd.novadigm.edm": {
        source: "iana",
        extensions: ["edm"]
      },
      "application/vnd.novadigm.edx": {
        source: "iana",
        extensions: ["edx"]
      },
      "application/vnd.novadigm.ext": {
        source: "iana",
        extensions: ["ext"]
      },
      "application/vnd.ntt-local.content-share": {
        source: "iana"
      },
      "application/vnd.ntt-local.file-transfer": {
        source: "iana"
      },
      "application/vnd.ntt-local.ogw_remote-access": {
        source: "iana"
      },
      "application/vnd.ntt-local.sip-ta_remote": {
        source: "iana"
      },
      "application/vnd.ntt-local.sip-ta_tcp_stream": {
        source: "iana"
      },
      "application/vnd.oasis.opendocument.chart": {
        source: "iana",
        extensions: ["odc"]
      },
      "application/vnd.oasis.opendocument.chart-template": {
        source: "iana",
        extensions: ["otc"]
      },
      "application/vnd.oasis.opendocument.database": {
        source: "iana",
        extensions: ["odb"]
      },
      "application/vnd.oasis.opendocument.formula": {
        source: "iana",
        extensions: ["odf"]
      },
      "application/vnd.oasis.opendocument.formula-template": {
        source: "iana",
        extensions: ["odft"]
      },
      "application/vnd.oasis.opendocument.graphics": {
        source: "iana",
        compressible: !1,
        extensions: ["odg"]
      },
      "application/vnd.oasis.opendocument.graphics-template": {
        source: "iana",
        extensions: ["otg"]
      },
      "application/vnd.oasis.opendocument.image": {
        source: "iana",
        extensions: ["odi"]
      },
      "application/vnd.oasis.opendocument.image-template": {
        source: "iana",
        extensions: ["oti"]
      },
      "application/vnd.oasis.opendocument.presentation": {
        source: "iana",
        compressible: !1,
        extensions: ["odp"]
      },
      "application/vnd.oasis.opendocument.presentation-template": {
        source: "iana",
        extensions: ["otp"]
      },
      "application/vnd.oasis.opendocument.spreadsheet": {
        source: "iana",
        compressible: !1,
        extensions: ["ods"]
      },
      "application/vnd.oasis.opendocument.spreadsheet-template": {
        source: "iana",
        extensions: ["ots"]
      },
      "application/vnd.oasis.opendocument.text": {
        source: "iana",
        compressible: !1,
        extensions: ["odt"]
      },
      "application/vnd.oasis.opendocument.text-master": {
        source: "iana",
        extensions: ["odm"]
      },
      "application/vnd.oasis.opendocument.text-template": {
        source: "iana",
        extensions: ["ott"]
      },
      "application/vnd.oasis.opendocument.text-web": {
        source: "iana",
        extensions: ["oth"]
      },
      "application/vnd.obn": {
        source: "iana"
      },
      "application/vnd.ocf+cbor": {
        source: "iana"
      },
      "application/vnd.oci.image.manifest.v1+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oftn.l10n+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.contentaccessdownload+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.contentaccessstreaming+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.cspg-hexbinary": {
        source: "iana"
      },
      "application/vnd.oipf.dae.svg+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.dae.xhtml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.mippvcontrolmessage+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.pae.gem": {
        source: "iana"
      },
      "application/vnd.oipf.spdiscovery+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.spdlist+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.ueprofile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oipf.userprofile+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.olpc-sugar": {
        source: "iana",
        extensions: ["xo"]
      },
      "application/vnd.oma-scws-config": {
        source: "iana"
      },
      "application/vnd.oma-scws-http-request": {
        source: "iana"
      },
      "application/vnd.oma-scws-http-response": {
        source: "iana"
      },
      "application/vnd.oma.bcast.associated-procedure-parameter+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.drm-trigger+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.imd+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.ltkm": {
        source: "iana"
      },
      "application/vnd.oma.bcast.notification+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.provisioningtrigger": {
        source: "iana"
      },
      "application/vnd.oma.bcast.sgboot": {
        source: "iana"
      },
      "application/vnd.oma.bcast.sgdd+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.sgdu": {
        source: "iana"
      },
      "application/vnd.oma.bcast.simple-symbol-container": {
        source: "iana"
      },
      "application/vnd.oma.bcast.smartcard-trigger+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.sprov+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.bcast.stkm": {
        source: "iana"
      },
      "application/vnd.oma.cab-address-book+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.cab-feature-handler+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.cab-pcc+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.cab-subs-invite+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.cab-user-prefs+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.dcd": {
        source: "iana"
      },
      "application/vnd.oma.dcdc": {
        source: "iana"
      },
      "application/vnd.oma.dd2+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["dd2"]
      },
      "application/vnd.oma.drm.risd+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.group-usage-list+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.lwm2m+cbor": {
        source: "iana"
      },
      "application/vnd.oma.lwm2m+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.lwm2m+tlv": {
        source: "iana"
      },
      "application/vnd.oma.pal+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.poc.detailed-progress-report+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.poc.final-report+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.poc.groups+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.poc.invocation-descriptor+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.poc.optimized-progress-report+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.push": {
        source: "iana"
      },
      "application/vnd.oma.scidm.messages+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oma.xcap-directory+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.omads-email+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.omads-file+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.omads-folder+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.omaloc-supl-init": {
        source: "iana"
      },
      "application/vnd.onepager": {
        source: "iana"
      },
      "application/vnd.onepagertamp": {
        source: "iana"
      },
      "application/vnd.onepagertamx": {
        source: "iana"
      },
      "application/vnd.onepagertat": {
        source: "iana"
      },
      "application/vnd.onepagertatp": {
        source: "iana"
      },
      "application/vnd.onepagertatx": {
        source: "iana"
      },
      "application/vnd.openblox.game+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["obgx"]
      },
      "application/vnd.openblox.game-binary": {
        source: "iana"
      },
      "application/vnd.openeye.oeb": {
        source: "iana"
      },
      "application/vnd.openofficeorg.extension": {
        source: "apache",
        extensions: ["oxt"]
      },
      "application/vnd.openstreetmap.data+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["osm"]
      },
      "application/vnd.opentimestamps.ots": {
        source: "iana"
      },
      "application/vnd.openxmlformats-officedocument.custom-properties+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.customxmlproperties+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawing+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.chart+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.chartshapes+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.diagramcolors+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.diagramdata+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.diagramlayout+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.drawingml.diagramstyle+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.extended-properties+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.commentauthors+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.comments+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.handoutmaster+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.notesmaster+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.notesslide+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        source: "iana",
        compressible: !1,
        extensions: ["pptx"]
      },
      "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.presprops+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slide": {
        source: "iana",
        extensions: ["sldx"]
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slide+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slidelayout+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slidemaster+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slideshow": {
        source: "iana",
        extensions: ["ppsx"]
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.slideupdateinfo+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.tablestyles+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.tags+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.template": {
        source: "iana",
        extensions: ["potx"]
      },
      "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.presentationml.viewprops+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.calcchain+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.chartsheet+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.dialogsheet+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.externallink+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcachedefinition+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotcacherecords+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.pivottable+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.querytable+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionheaders+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.revisionlog+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedstrings+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        source: "iana",
        compressible: !1,
        extensions: ["xlsx"]
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheetmetadata+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.tablesinglecells+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.template": {
        source: "iana",
        extensions: ["xltx"]
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.usernames+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.volatiledependencies+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.theme+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.themeoverride+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.vmldrawing": {
        source: "iana"
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        source: "iana",
        compressible: !1,
        extensions: ["docx"]
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.glossary+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.fonttable+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template": {
        source: "iana",
        extensions: ["dotx"]
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-officedocument.wordprocessingml.websettings+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-package.core-properties+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-package.digital-signature-xmlsignature+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.openxmlformats-package.relationships+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oracle.resource+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.orange.indata": {
        source: "iana"
      },
      "application/vnd.osa.netdeploy": {
        source: "iana"
      },
      "application/vnd.osgeo.mapguide.package": {
        source: "iana",
        extensions: ["mgp"]
      },
      "application/vnd.osgi.bundle": {
        source: "iana"
      },
      "application/vnd.osgi.dp": {
        source: "iana",
        extensions: ["dp"]
      },
      "application/vnd.osgi.subsystem": {
        source: "iana",
        extensions: ["esa"]
      },
      "application/vnd.otps.ct-kip+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.oxli.countgraph": {
        source: "iana"
      },
      "application/vnd.pagerduty+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.palm": {
        source: "iana",
        extensions: ["pdb", "pqa", "oprc"]
      },
      "application/vnd.panoply": {
        source: "iana"
      },
      "application/vnd.paos.xml": {
        source: "iana"
      },
      "application/vnd.patentdive": {
        source: "iana"
      },
      "application/vnd.patientecommsdoc": {
        source: "iana"
      },
      "application/vnd.pawaafile": {
        source: "iana",
        extensions: ["paw"]
      },
      "application/vnd.pcos": {
        source: "iana"
      },
      "application/vnd.pg.format": {
        source: "iana",
        extensions: ["str"]
      },
      "application/vnd.pg.osasli": {
        source: "iana",
        extensions: ["ei6"]
      },
      "application/vnd.piaccess.application-licence": {
        source: "iana"
      },
      "application/vnd.picsel": {
        source: "iana",
        extensions: ["efif"]
      },
      "application/vnd.pmi.widget": {
        source: "iana",
        extensions: ["wg"]
      },
      "application/vnd.poc.group-advertisement+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.pocketlearn": {
        source: "iana",
        extensions: ["plf"]
      },
      "application/vnd.powerbuilder6": {
        source: "iana",
        extensions: ["pbd"]
      },
      "application/vnd.powerbuilder6-s": {
        source: "iana"
      },
      "application/vnd.powerbuilder7": {
        source: "iana"
      },
      "application/vnd.powerbuilder7-s": {
        source: "iana"
      },
      "application/vnd.powerbuilder75": {
        source: "iana"
      },
      "application/vnd.powerbuilder75-s": {
        source: "iana"
      },
      "application/vnd.preminet": {
        source: "iana"
      },
      "application/vnd.previewsystems.box": {
        source: "iana",
        extensions: ["box"]
      },
      "application/vnd.proteus.magazine": {
        source: "iana",
        extensions: ["mgz"]
      },
      "application/vnd.psfs": {
        source: "iana"
      },
      "application/vnd.publishare-delta-tree": {
        source: "iana",
        extensions: ["qps"]
      },
      "application/vnd.pvi.ptid1": {
        source: "iana",
        extensions: ["ptid"]
      },
      "application/vnd.pwg-multiplexed": {
        source: "iana"
      },
      "application/vnd.pwg-xhtml-print+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.qualcomm.brew-app-res": {
        source: "iana"
      },
      "application/vnd.quarantainenet": {
        source: "iana"
      },
      "application/vnd.quark.quarkxpress": {
        source: "iana",
        extensions: ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"]
      },
      "application/vnd.quobject-quoxdocument": {
        source: "iana"
      },
      "application/vnd.radisys.moml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-audit+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-audit-conf+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-audit-conn+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-audit-dialog+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-audit-stream+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-conf+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-base+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-fax-detect+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-fax-sendrecv+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-group+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-speech+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.radisys.msml-dialog-transform+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.rainstor.data": {
        source: "iana"
      },
      "application/vnd.rapid": {
        source: "iana"
      },
      "application/vnd.rar": {
        source: "iana",
        extensions: ["rar"]
      },
      "application/vnd.realvnc.bed": {
        source: "iana",
        extensions: ["bed"]
      },
      "application/vnd.recordare.musicxml": {
        source: "iana",
        extensions: ["mxl"]
      },
      "application/vnd.recordare.musicxml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["musicxml"]
      },
      "application/vnd.renlearn.rlprint": {
        source: "iana"
      },
      "application/vnd.resilient.logic": {
        source: "iana"
      },
      "application/vnd.restful+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.rig.cryptonote": {
        source: "iana",
        extensions: ["cryptonote"]
      },
      "application/vnd.rim.cod": {
        source: "apache",
        extensions: ["cod"]
      },
      "application/vnd.rn-realmedia": {
        source: "apache",
        extensions: ["rm"]
      },
      "application/vnd.rn-realmedia-vbr": {
        source: "apache",
        extensions: ["rmvb"]
      },
      "application/vnd.route66.link66+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["link66"]
      },
      "application/vnd.rs-274x": {
        source: "iana"
      },
      "application/vnd.ruckus.download": {
        source: "iana"
      },
      "application/vnd.s3sms": {
        source: "iana"
      },
      "application/vnd.sailingtracker.track": {
        source: "iana",
        extensions: ["st"]
      },
      "application/vnd.sar": {
        source: "iana"
      },
      "application/vnd.sbm.cid": {
        source: "iana"
      },
      "application/vnd.sbm.mid2": {
        source: "iana"
      },
      "application/vnd.scribus": {
        source: "iana"
      },
      "application/vnd.sealed.3df": {
        source: "iana"
      },
      "application/vnd.sealed.csf": {
        source: "iana"
      },
      "application/vnd.sealed.doc": {
        source: "iana"
      },
      "application/vnd.sealed.eml": {
        source: "iana"
      },
      "application/vnd.sealed.mht": {
        source: "iana"
      },
      "application/vnd.sealed.net": {
        source: "iana"
      },
      "application/vnd.sealed.ppt": {
        source: "iana"
      },
      "application/vnd.sealed.tiff": {
        source: "iana"
      },
      "application/vnd.sealed.xls": {
        source: "iana"
      },
      "application/vnd.sealedmedia.softseal.html": {
        source: "iana"
      },
      "application/vnd.sealedmedia.softseal.pdf": {
        source: "iana"
      },
      "application/vnd.seemail": {
        source: "iana",
        extensions: ["see"]
      },
      "application/vnd.seis+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.sema": {
        source: "iana",
        extensions: ["sema"]
      },
      "application/vnd.semd": {
        source: "iana",
        extensions: ["semd"]
      },
      "application/vnd.semf": {
        source: "iana",
        extensions: ["semf"]
      },
      "application/vnd.shade-save-file": {
        source: "iana"
      },
      "application/vnd.shana.informed.formdata": {
        source: "iana",
        extensions: ["ifm"]
      },
      "application/vnd.shana.informed.formtemplate": {
        source: "iana",
        extensions: ["itp"]
      },
      "application/vnd.shana.informed.interchange": {
        source: "iana",
        extensions: ["iif"]
      },
      "application/vnd.shana.informed.package": {
        source: "iana",
        extensions: ["ipk"]
      },
      "application/vnd.shootproof+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.shopkick+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.shp": {
        source: "iana"
      },
      "application/vnd.shx": {
        source: "iana"
      },
      "application/vnd.sigrok.session": {
        source: "iana"
      },
      "application/vnd.simtech-mindmapper": {
        source: "iana",
        extensions: ["twd", "twds"]
      },
      "application/vnd.siren+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.smaf": {
        source: "iana",
        extensions: ["mmf"]
      },
      "application/vnd.smart.notebook": {
        source: "iana"
      },
      "application/vnd.smart.teacher": {
        source: "iana",
        extensions: ["teacher"]
      },
      "application/vnd.snesdev-page-table": {
        source: "iana"
      },
      "application/vnd.software602.filler.form+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["fo"]
      },
      "application/vnd.software602.filler.form-xml-zip": {
        source: "iana"
      },
      "application/vnd.solent.sdkm+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["sdkm", "sdkd"]
      },
      "application/vnd.spotfire.dxp": {
        source: "iana",
        extensions: ["dxp"]
      },
      "application/vnd.spotfire.sfs": {
        source: "iana",
        extensions: ["sfs"]
      },
      "application/vnd.sqlite3": {
        source: "iana"
      },
      "application/vnd.sss-cod": {
        source: "iana"
      },
      "application/vnd.sss-dtf": {
        source: "iana"
      },
      "application/vnd.sss-ntf": {
        source: "iana"
      },
      "application/vnd.stardivision.calc": {
        source: "apache",
        extensions: ["sdc"]
      },
      "application/vnd.stardivision.draw": {
        source: "apache",
        extensions: ["sda"]
      },
      "application/vnd.stardivision.impress": {
        source: "apache",
        extensions: ["sdd"]
      },
      "application/vnd.stardivision.math": {
        source: "apache",
        extensions: ["smf"]
      },
      "application/vnd.stardivision.writer": {
        source: "apache",
        extensions: ["sdw", "vor"]
      },
      "application/vnd.stardivision.writer-global": {
        source: "apache",
        extensions: ["sgl"]
      },
      "application/vnd.stepmania.package": {
        source: "iana",
        extensions: ["smzip"]
      },
      "application/vnd.stepmania.stepchart": {
        source: "iana",
        extensions: ["sm"]
      },
      "application/vnd.street-stream": {
        source: "iana"
      },
      "application/vnd.sun.wadl+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["wadl"]
      },
      "application/vnd.sun.xml.calc": {
        source: "apache",
        extensions: ["sxc"]
      },
      "application/vnd.sun.xml.calc.template": {
        source: "apache",
        extensions: ["stc"]
      },
      "application/vnd.sun.xml.draw": {
        source: "apache",
        extensions: ["sxd"]
      },
      "application/vnd.sun.xml.draw.template": {
        source: "apache",
        extensions: ["std"]
      },
      "application/vnd.sun.xml.impress": {
        source: "apache",
        extensions: ["sxi"]
      },
      "application/vnd.sun.xml.impress.template": {
        source: "apache",
        extensions: ["sti"]
      },
      "application/vnd.sun.xml.math": {
        source: "apache",
        extensions: ["sxm"]
      },
      "application/vnd.sun.xml.writer": {
        source: "apache",
        extensions: ["sxw"]
      },
      "application/vnd.sun.xml.writer.global": {
        source: "apache",
        extensions: ["sxg"]
      },
      "application/vnd.sun.xml.writer.template": {
        source: "apache",
        extensions: ["stw"]
      },
      "application/vnd.sus-calendar": {
        source: "iana",
        extensions: ["sus", "susp"]
      },
      "application/vnd.svd": {
        source: "iana",
        extensions: ["svd"]
      },
      "application/vnd.swiftview-ics": {
        source: "iana"
      },
      "application/vnd.sycle+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.syft+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.symbian.install": {
        source: "apache",
        extensions: ["sis", "sisx"]
      },
      "application/vnd.syncml+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["xsm"]
      },
      "application/vnd.syncml.dm+wbxml": {
        source: "iana",
        charset: "UTF-8",
        extensions: ["bdm"]
      },
      "application/vnd.syncml.dm+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["xdm"]
      },
      "application/vnd.syncml.dm.notification": {
        source: "iana"
      },
      "application/vnd.syncml.dmddf+wbxml": {
        source: "iana"
      },
      "application/vnd.syncml.dmddf+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["ddf"]
      },
      "application/vnd.syncml.dmtnds+wbxml": {
        source: "iana"
      },
      "application/vnd.syncml.dmtnds+xml": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0
      },
      "application/vnd.syncml.ds.notification": {
        source: "iana"
      },
      "application/vnd.tableschema+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.tao.intent-module-archive": {
        source: "iana",
        extensions: ["tao"]
      },
      "application/vnd.tcpdump.pcap": {
        source: "iana",
        extensions: ["pcap", "cap", "dmp"]
      },
      "application/vnd.think-cell.ppttc+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.tmd.mediaflex.api+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.tml": {
        source: "iana"
      },
      "application/vnd.tmobile-livetv": {
        source: "iana",
        extensions: ["tmo"]
      },
      "application/vnd.tri.onesource": {
        source: "iana"
      },
      "application/vnd.trid.tpt": {
        source: "iana",
        extensions: ["tpt"]
      },
      "application/vnd.triscape.mxs": {
        source: "iana",
        extensions: ["mxs"]
      },
      "application/vnd.trueapp": {
        source: "iana",
        extensions: ["tra"]
      },
      "application/vnd.truedoc": {
        source: "iana"
      },
      "application/vnd.ubisoft.webplayer": {
        source: "iana"
      },
      "application/vnd.ufdl": {
        source: "iana",
        extensions: ["ufd", "ufdl"]
      },
      "application/vnd.uiq.theme": {
        source: "iana",
        extensions: ["utz"]
      },
      "application/vnd.umajin": {
        source: "iana",
        extensions: ["umj"]
      },
      "application/vnd.unity": {
        source: "iana",
        extensions: ["unityweb"]
      },
      "application/vnd.uoml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["uoml"]
      },
      "application/vnd.uplanet.alert": {
        source: "iana"
      },
      "application/vnd.uplanet.alert-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.bearer-choice": {
        source: "iana"
      },
      "application/vnd.uplanet.bearer-choice-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.cacheop": {
        source: "iana"
      },
      "application/vnd.uplanet.cacheop-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.channel": {
        source: "iana"
      },
      "application/vnd.uplanet.channel-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.list": {
        source: "iana"
      },
      "application/vnd.uplanet.list-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.listcmd": {
        source: "iana"
      },
      "application/vnd.uplanet.listcmd-wbxml": {
        source: "iana"
      },
      "application/vnd.uplanet.signal": {
        source: "iana"
      },
      "application/vnd.uri-map": {
        source: "iana"
      },
      "application/vnd.valve.source.material": {
        source: "iana"
      },
      "application/vnd.vcx": {
        source: "iana",
        extensions: ["vcx"]
      },
      "application/vnd.vd-study": {
        source: "iana"
      },
      "application/vnd.vectorworks": {
        source: "iana"
      },
      "application/vnd.vel+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.verimatrix.vcas": {
        source: "iana"
      },
      "application/vnd.veritone.aion+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.veryant.thin": {
        source: "iana"
      },
      "application/vnd.ves.encrypted": {
        source: "iana"
      },
      "application/vnd.vidsoft.vidconference": {
        source: "iana"
      },
      "application/vnd.visio": {
        source: "iana",
        extensions: ["vsd", "vst", "vss", "vsw"]
      },
      "application/vnd.visionary": {
        source: "iana",
        extensions: ["vis"]
      },
      "application/vnd.vividence.scriptfile": {
        source: "iana"
      },
      "application/vnd.vsf": {
        source: "iana",
        extensions: ["vsf"]
      },
      "application/vnd.wap.sic": {
        source: "iana"
      },
      "application/vnd.wap.slc": {
        source: "iana"
      },
      "application/vnd.wap.wbxml": {
        source: "iana",
        charset: "UTF-8",
        extensions: ["wbxml"]
      },
      "application/vnd.wap.wmlc": {
        source: "iana",
        extensions: ["wmlc"]
      },
      "application/vnd.wap.wmlscriptc": {
        source: "iana",
        extensions: ["wmlsc"]
      },
      "application/vnd.webturbo": {
        source: "iana",
        extensions: ["wtb"]
      },
      "application/vnd.wfa.dpp": {
        source: "iana"
      },
      "application/vnd.wfa.p2p": {
        source: "iana"
      },
      "application/vnd.wfa.wsc": {
        source: "iana"
      },
      "application/vnd.windows.devicepairing": {
        source: "iana"
      },
      "application/vnd.wmc": {
        source: "iana"
      },
      "application/vnd.wmf.bootstrap": {
        source: "iana"
      },
      "application/vnd.wolfram.mathematica": {
        source: "iana"
      },
      "application/vnd.wolfram.mathematica.package": {
        source: "iana"
      },
      "application/vnd.wolfram.player": {
        source: "iana",
        extensions: ["nbp"]
      },
      "application/vnd.wordperfect": {
        source: "iana",
        extensions: ["wpd"]
      },
      "application/vnd.wqd": {
        source: "iana",
        extensions: ["wqd"]
      },
      "application/vnd.wrq-hp3000-labelled": {
        source: "iana"
      },
      "application/vnd.wt.stf": {
        source: "iana",
        extensions: ["stf"]
      },
      "application/vnd.wv.csp+wbxml": {
        source: "iana"
      },
      "application/vnd.wv.csp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.wv.ssp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.xacml+json": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.xara": {
        source: "iana",
        extensions: ["xar"]
      },
      "application/vnd.xfdl": {
        source: "iana",
        extensions: ["xfdl"]
      },
      "application/vnd.xfdl.webform": {
        source: "iana"
      },
      "application/vnd.xmi+xml": {
        source: "iana",
        compressible: !0
      },
      "application/vnd.xmpie.cpkg": {
        source: "iana"
      },
      "application/vnd.xmpie.dpkg": {
        source: "iana"
      },
      "application/vnd.xmpie.plan": {
        source: "iana"
      },
      "application/vnd.xmpie.ppkg": {
        source: "iana"
      },
      "application/vnd.xmpie.xlim": {
        source: "iana"
      },
      "application/vnd.yamaha.hv-dic": {
        source: "iana",
        extensions: ["hvd"]
      },
      "application/vnd.yamaha.hv-script": {
        source: "iana",
        extensions: ["hvs"]
      },
      "application/vnd.yamaha.hv-voice": {
        source: "iana",
        extensions: ["hvp"]
      },
      "application/vnd.yamaha.openscoreformat": {
        source: "iana",
        extensions: ["osf"]
      },
      "application/vnd.yamaha.openscoreformat.osfpvg+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["osfpvg"]
      },
      "application/vnd.yamaha.remote-setup": {
        source: "iana"
      },
      "application/vnd.yamaha.smaf-audio": {
        source: "iana",
        extensions: ["saf"]
      },
      "application/vnd.yamaha.smaf-phrase": {
        source: "iana",
        extensions: ["spf"]
      },
      "application/vnd.yamaha.through-ngn": {
        source: "iana"
      },
      "application/vnd.yamaha.tunnel-udpencap": {
        source: "iana"
      },
      "application/vnd.yaoweme": {
        source: "iana"
      },
      "application/vnd.yellowriver-custom-menu": {
        source: "iana",
        extensions: ["cmp"]
      },
      "application/vnd.youtube.yt": {
        source: "iana"
      },
      "application/vnd.zul": {
        source: "iana",
        extensions: ["zir", "zirz"]
      },
      "application/vnd.zzazz.deck+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["zaz"]
      },
      "application/voicexml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["vxml"]
      },
      "application/voucher-cms+json": {
        source: "iana",
        compressible: !0
      },
      "application/vq-rtcpxr": {
        source: "iana"
      },
      "application/wasm": {
        source: "iana",
        compressible: !0,
        extensions: ["wasm"]
      },
      "application/watcherinfo+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["wif"]
      },
      "application/webpush-options+json": {
        source: "iana",
        compressible: !0
      },
      "application/whoispp-query": {
        source: "iana"
      },
      "application/whoispp-response": {
        source: "iana"
      },
      "application/widget": {
        source: "iana",
        extensions: ["wgt"]
      },
      "application/winhlp": {
        source: "apache",
        extensions: ["hlp"]
      },
      "application/wita": {
        source: "iana"
      },
      "application/wordperfect5.1": {
        source: "iana"
      },
      "application/wsdl+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["wsdl"]
      },
      "application/wspolicy+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["wspolicy"]
      },
      "application/x-7z-compressed": {
        source: "apache",
        compressible: !1,
        extensions: ["7z"]
      },
      "application/x-abiword": {
        source: "apache",
        extensions: ["abw"]
      },
      "application/x-ace-compressed": {
        source: "apache",
        extensions: ["ace"]
      },
      "application/x-amf": {
        source: "apache"
      },
      "application/x-apple-diskimage": {
        source: "apache",
        extensions: ["dmg"]
      },
      "application/x-arj": {
        compressible: !1,
        extensions: ["arj"]
      },
      "application/x-authorware-bin": {
        source: "apache",
        extensions: ["aab", "x32", "u32", "vox"]
      },
      "application/x-authorware-map": {
        source: "apache",
        extensions: ["aam"]
      },
      "application/x-authorware-seg": {
        source: "apache",
        extensions: ["aas"]
      },
      "application/x-bcpio": {
        source: "apache",
        extensions: ["bcpio"]
      },
      "application/x-bdoc": {
        compressible: !1,
        extensions: ["bdoc"]
      },
      "application/x-bittorrent": {
        source: "apache",
        extensions: ["torrent"]
      },
      "application/x-blorb": {
        source: "apache",
        extensions: ["blb", "blorb"]
      },
      "application/x-bzip": {
        source: "apache",
        compressible: !1,
        extensions: ["bz"]
      },
      "application/x-bzip2": {
        source: "apache",
        compressible: !1,
        extensions: ["bz2", "boz"]
      },
      "application/x-cbr": {
        source: "apache",
        extensions: ["cbr", "cba", "cbt", "cbz", "cb7"]
      },
      "application/x-cdlink": {
        source: "apache",
        extensions: ["vcd"]
      },
      "application/x-cfs-compressed": {
        source: "apache",
        extensions: ["cfs"]
      },
      "application/x-chat": {
        source: "apache",
        extensions: ["chat"]
      },
      "application/x-chess-pgn": {
        source: "apache",
        extensions: ["pgn"]
      },
      "application/x-chrome-extension": {
        extensions: ["crx"]
      },
      "application/x-cocoa": {
        source: "nginx",
        extensions: ["cco"]
      },
      "application/x-compress": {
        source: "apache"
      },
      "application/x-conference": {
        source: "apache",
        extensions: ["nsc"]
      },
      "application/x-cpio": {
        source: "apache",
        extensions: ["cpio"]
      },
      "application/x-csh": {
        source: "apache",
        extensions: ["csh"]
      },
      "application/x-deb": {
        compressible: !1
      },
      "application/x-debian-package": {
        source: "apache",
        extensions: ["deb", "udeb"]
      },
      "application/x-dgc-compressed": {
        source: "apache",
        extensions: ["dgc"]
      },
      "application/x-director": {
        source: "apache",
        extensions: ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"]
      },
      "application/x-doom": {
        source: "apache",
        extensions: ["wad"]
      },
      "application/x-dtbncx+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["ncx"]
      },
      "application/x-dtbook+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["dtb"]
      },
      "application/x-dtbresource+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["res"]
      },
      "application/x-dvi": {
        source: "apache",
        compressible: !1,
        extensions: ["dvi"]
      },
      "application/x-envoy": {
        source: "apache",
        extensions: ["evy"]
      },
      "application/x-eva": {
        source: "apache",
        extensions: ["eva"]
      },
      "application/x-font-bdf": {
        source: "apache",
        extensions: ["bdf"]
      },
      "application/x-font-dos": {
        source: "apache"
      },
      "application/x-font-framemaker": {
        source: "apache"
      },
      "application/x-font-ghostscript": {
        source: "apache",
        extensions: ["gsf"]
      },
      "application/x-font-libgrx": {
        source: "apache"
      },
      "application/x-font-linux-psf": {
        source: "apache",
        extensions: ["psf"]
      },
      "application/x-font-pcf": {
        source: "apache",
        extensions: ["pcf"]
      },
      "application/x-font-snf": {
        source: "apache",
        extensions: ["snf"]
      },
      "application/x-font-speedo": {
        source: "apache"
      },
      "application/x-font-sunos-news": {
        source: "apache"
      },
      "application/x-font-type1": {
        source: "apache",
        extensions: ["pfa", "pfb", "pfm", "afm"]
      },
      "application/x-font-vfont": {
        source: "apache"
      },
      "application/x-freearc": {
        source: "apache",
        extensions: ["arc"]
      },
      "application/x-futuresplash": {
        source: "apache",
        extensions: ["spl"]
      },
      "application/x-gca-compressed": {
        source: "apache",
        extensions: ["gca"]
      },
      "application/x-glulx": {
        source: "apache",
        extensions: ["ulx"]
      },
      "application/x-gnumeric": {
        source: "apache",
        extensions: ["gnumeric"]
      },
      "application/x-gramps-xml": {
        source: "apache",
        extensions: ["gramps"]
      },
      "application/x-gtar": {
        source: "apache",
        extensions: ["gtar"]
      },
      "application/x-gzip": {
        source: "apache"
      },
      "application/x-hdf": {
        source: "apache",
        extensions: ["hdf"]
      },
      "application/x-httpd-php": {
        compressible: !0,
        extensions: ["php"]
      },
      "application/x-install-instructions": {
        source: "apache",
        extensions: ["install"]
      },
      "application/x-iso9660-image": {
        source: "apache",
        extensions: ["iso"]
      },
      "application/x-iwork-keynote-sffkey": {
        extensions: ["key"]
      },
      "application/x-iwork-numbers-sffnumbers": {
        extensions: ["numbers"]
      },
      "application/x-iwork-pages-sffpages": {
        extensions: ["pages"]
      },
      "application/x-java-archive-diff": {
        source: "nginx",
        extensions: ["jardiff"]
      },
      "application/x-java-jnlp-file": {
        source: "apache",
        compressible: !1,
        extensions: ["jnlp"]
      },
      "application/x-javascript": {
        compressible: !0
      },
      "application/x-keepass2": {
        extensions: ["kdbx"]
      },
      "application/x-latex": {
        source: "apache",
        compressible: !1,
        extensions: ["latex"]
      },
      "application/x-lua-bytecode": {
        extensions: ["luac"]
      },
      "application/x-lzh-compressed": {
        source: "apache",
        extensions: ["lzh", "lha"]
      },
      "application/x-makeself": {
        source: "nginx",
        extensions: ["run"]
      },
      "application/x-mie": {
        source: "apache",
        extensions: ["mie"]
      },
      "application/x-mobipocket-ebook": {
        source: "apache",
        extensions: ["prc", "mobi"]
      },
      "application/x-mpegurl": {
        compressible: !1
      },
      "application/x-ms-application": {
        source: "apache",
        extensions: ["application"]
      },
      "application/x-ms-shortcut": {
        source: "apache",
        extensions: ["lnk"]
      },
      "application/x-ms-wmd": {
        source: "apache",
        extensions: ["wmd"]
      },
      "application/x-ms-wmz": {
        source: "apache",
        extensions: ["wmz"]
      },
      "application/x-ms-xbap": {
        source: "apache",
        extensions: ["xbap"]
      },
      "application/x-msaccess": {
        source: "apache",
        extensions: ["mdb"]
      },
      "application/x-msbinder": {
        source: "apache",
        extensions: ["obd"]
      },
      "application/x-mscardfile": {
        source: "apache",
        extensions: ["crd"]
      },
      "application/x-msclip": {
        source: "apache",
        extensions: ["clp"]
      },
      "application/x-msdos-program": {
        extensions: ["exe"]
      },
      "application/x-msdownload": {
        source: "apache",
        extensions: ["exe", "dll", "com", "bat", "msi"]
      },
      "application/x-msmediaview": {
        source: "apache",
        extensions: ["mvb", "m13", "m14"]
      },
      "application/x-msmetafile": {
        source: "apache",
        extensions: ["wmf", "wmz", "emf", "emz"]
      },
      "application/x-msmoney": {
        source: "apache",
        extensions: ["mny"]
      },
      "application/x-mspublisher": {
        source: "apache",
        extensions: ["pub"]
      },
      "application/x-msschedule": {
        source: "apache",
        extensions: ["scd"]
      },
      "application/x-msterminal": {
        source: "apache",
        extensions: ["trm"]
      },
      "application/x-mswrite": {
        source: "apache",
        extensions: ["wri"]
      },
      "application/x-netcdf": {
        source: "apache",
        extensions: ["nc", "cdf"]
      },
      "application/x-ns-proxy-autoconfig": {
        compressible: !0,
        extensions: ["pac"]
      },
      "application/x-nzb": {
        source: "apache",
        extensions: ["nzb"]
      },
      "application/x-perl": {
        source: "nginx",
        extensions: ["pl", "pm"]
      },
      "application/x-pilot": {
        source: "nginx",
        extensions: ["prc", "pdb"]
      },
      "application/x-pkcs12": {
        source: "apache",
        compressible: !1,
        extensions: ["p12", "pfx"]
      },
      "application/x-pkcs7-certificates": {
        source: "apache",
        extensions: ["p7b", "spc"]
      },
      "application/x-pkcs7-certreqresp": {
        source: "apache",
        extensions: ["p7r"]
      },
      "application/x-pki-message": {
        source: "iana"
      },
      "application/x-rar-compressed": {
        source: "apache",
        compressible: !1,
        extensions: ["rar"]
      },
      "application/x-redhat-package-manager": {
        source: "nginx",
        extensions: ["rpm"]
      },
      "application/x-research-info-systems": {
        source: "apache",
        extensions: ["ris"]
      },
      "application/x-sea": {
        source: "nginx",
        extensions: ["sea"]
      },
      "application/x-sh": {
        source: "apache",
        compressible: !0,
        extensions: ["sh"]
      },
      "application/x-shar": {
        source: "apache",
        extensions: ["shar"]
      },
      "application/x-shockwave-flash": {
        source: "apache",
        compressible: !1,
        extensions: ["swf"]
      },
      "application/x-silverlight-app": {
        source: "apache",
        extensions: ["xap"]
      },
      "application/x-sql": {
        source: "apache",
        extensions: ["sql"]
      },
      "application/x-stuffit": {
        source: "apache",
        compressible: !1,
        extensions: ["sit"]
      },
      "application/x-stuffitx": {
        source: "apache",
        extensions: ["sitx"]
      },
      "application/x-subrip": {
        source: "apache",
        extensions: ["srt"]
      },
      "application/x-sv4cpio": {
        source: "apache",
        extensions: ["sv4cpio"]
      },
      "application/x-sv4crc": {
        source: "apache",
        extensions: ["sv4crc"]
      },
      "application/x-t3vm-image": {
        source: "apache",
        extensions: ["t3"]
      },
      "application/x-tads": {
        source: "apache",
        extensions: ["gam"]
      },
      "application/x-tar": {
        source: "apache",
        compressible: !0,
        extensions: ["tar"]
      },
      "application/x-tcl": {
        source: "apache",
        extensions: ["tcl", "tk"]
      },
      "application/x-tex": {
        source: "apache",
        extensions: ["tex"]
      },
      "application/x-tex-tfm": {
        source: "apache",
        extensions: ["tfm"]
      },
      "application/x-texinfo": {
        source: "apache",
        extensions: ["texinfo", "texi"]
      },
      "application/x-tgif": {
        source: "apache",
        extensions: ["obj"]
      },
      "application/x-ustar": {
        source: "apache",
        extensions: ["ustar"]
      },
      "application/x-virtualbox-hdd": {
        compressible: !0,
        extensions: ["hdd"]
      },
      "application/x-virtualbox-ova": {
        compressible: !0,
        extensions: ["ova"]
      },
      "application/x-virtualbox-ovf": {
        compressible: !0,
        extensions: ["ovf"]
      },
      "application/x-virtualbox-vbox": {
        compressible: !0,
        extensions: ["vbox"]
      },
      "application/x-virtualbox-vbox-extpack": {
        compressible: !1,
        extensions: ["vbox-extpack"]
      },
      "application/x-virtualbox-vdi": {
        compressible: !0,
        extensions: ["vdi"]
      },
      "application/x-virtualbox-vhd": {
        compressible: !0,
        extensions: ["vhd"]
      },
      "application/x-virtualbox-vmdk": {
        compressible: !0,
        extensions: ["vmdk"]
      },
      "application/x-wais-source": {
        source: "apache",
        extensions: ["src"]
      },
      "application/x-web-app-manifest+json": {
        compressible: !0,
        extensions: ["webapp"]
      },
      "application/x-www-form-urlencoded": {
        source: "iana",
        compressible: !0
      },
      "application/x-x509-ca-cert": {
        source: "iana",
        extensions: ["der", "crt", "pem"]
      },
      "application/x-x509-ca-ra-cert": {
        source: "iana"
      },
      "application/x-x509-next-ca-cert": {
        source: "iana"
      },
      "application/x-xfig": {
        source: "apache",
        extensions: ["fig"]
      },
      "application/x-xliff+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["xlf"]
      },
      "application/x-xpinstall": {
        source: "apache",
        compressible: !1,
        extensions: ["xpi"]
      },
      "application/x-xz": {
        source: "apache",
        extensions: ["xz"]
      },
      "application/x-zmachine": {
        source: "apache",
        extensions: ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"]
      },
      "application/x400-bp": {
        source: "iana"
      },
      "application/xacml+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xaml+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["xaml"]
      },
      "application/xcap-att+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xav"]
      },
      "application/xcap-caps+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xca"]
      },
      "application/xcap-diff+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xdf"]
      },
      "application/xcap-el+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xel"]
      },
      "application/xcap-error+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xcap-ns+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xns"]
      },
      "application/xcon-conference-info+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xcon-conference-info-diff+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xenc+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xenc"]
      },
      "application/xhtml+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xhtml", "xht"]
      },
      "application/xhtml-voice+xml": {
        source: "apache",
        compressible: !0
      },
      "application/xliff+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xlf"]
      },
      "application/xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xml", "xsl", "xsd", "rng"]
      },
      "application/xml-dtd": {
        source: "iana",
        compressible: !0,
        extensions: ["dtd"]
      },
      "application/xml-external-parsed-entity": {
        source: "iana"
      },
      "application/xml-patch+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xmpp+xml": {
        source: "iana",
        compressible: !0
      },
      "application/xop+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xop"]
      },
      "application/xproc+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["xpl"]
      },
      "application/xslt+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xsl", "xslt"]
      },
      "application/xspf+xml": {
        source: "apache",
        compressible: !0,
        extensions: ["xspf"]
      },
      "application/xv+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["mxml", "xhvml", "xvml", "xvm"]
      },
      "application/yang": {
        source: "iana",
        extensions: ["yang"]
      },
      "application/yang-data+json": {
        source: "iana",
        compressible: !0
      },
      "application/yang-data+xml": {
        source: "iana",
        compressible: !0
      },
      "application/yang-patch+json": {
        source: "iana",
        compressible: !0
      },
      "application/yang-patch+xml": {
        source: "iana",
        compressible: !0
      },
      "application/yin+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["yin"]
      },
      "application/zip": {
        source: "iana",
        compressible: !1,
        extensions: ["zip"]
      },
      "application/zlib": {
        source: "iana"
      },
      "application/zstd": {
        source: "iana"
      },
      "audio/1d-interleaved-parityfec": {
        source: "iana"
      },
      "audio/32kadpcm": {
        source: "iana"
      },
      "audio/3gpp": {
        source: "iana",
        compressible: !1,
        extensions: ["3gpp"]
      },
      "audio/3gpp2": {
        source: "iana"
      },
      "audio/aac": {
        source: "iana"
      },
      "audio/ac3": {
        source: "iana"
      },
      "audio/adpcm": {
        source: "apache",
        extensions: ["adp"]
      },
      "audio/amr": {
        source: "iana",
        extensions: ["amr"]
      },
      "audio/amr-wb": {
        source: "iana"
      },
      "audio/amr-wb+": {
        source: "iana"
      },
      "audio/aptx": {
        source: "iana"
      },
      "audio/asc": {
        source: "iana"
      },
      "audio/atrac-advanced-lossless": {
        source: "iana"
      },
      "audio/atrac-x": {
        source: "iana"
      },
      "audio/atrac3": {
        source: "iana"
      },
      "audio/basic": {
        source: "iana",
        compressible: !1,
        extensions: ["au", "snd"]
      },
      "audio/bv16": {
        source: "iana"
      },
      "audio/bv32": {
        source: "iana"
      },
      "audio/clearmode": {
        source: "iana"
      },
      "audio/cn": {
        source: "iana"
      },
      "audio/dat12": {
        source: "iana"
      },
      "audio/dls": {
        source: "iana"
      },
      "audio/dsr-es201108": {
        source: "iana"
      },
      "audio/dsr-es202050": {
        source: "iana"
      },
      "audio/dsr-es202211": {
        source: "iana"
      },
      "audio/dsr-es202212": {
        source: "iana"
      },
      "audio/dv": {
        source: "iana"
      },
      "audio/dvi4": {
        source: "iana"
      },
      "audio/eac3": {
        source: "iana"
      },
      "audio/encaprtp": {
        source: "iana"
      },
      "audio/evrc": {
        source: "iana"
      },
      "audio/evrc-qcp": {
        source: "iana"
      },
      "audio/evrc0": {
        source: "iana"
      },
      "audio/evrc1": {
        source: "iana"
      },
      "audio/evrcb": {
        source: "iana"
      },
      "audio/evrcb0": {
        source: "iana"
      },
      "audio/evrcb1": {
        source: "iana"
      },
      "audio/evrcnw": {
        source: "iana"
      },
      "audio/evrcnw0": {
        source: "iana"
      },
      "audio/evrcnw1": {
        source: "iana"
      },
      "audio/evrcwb": {
        source: "iana"
      },
      "audio/evrcwb0": {
        source: "iana"
      },
      "audio/evrcwb1": {
        source: "iana"
      },
      "audio/evs": {
        source: "iana"
      },
      "audio/flexfec": {
        source: "iana"
      },
      "audio/fwdred": {
        source: "iana"
      },
      "audio/g711-0": {
        source: "iana"
      },
      "audio/g719": {
        source: "iana"
      },
      "audio/g722": {
        source: "iana"
      },
      "audio/g7221": {
        source: "iana"
      },
      "audio/g723": {
        source: "iana"
      },
      "audio/g726-16": {
        source: "iana"
      },
      "audio/g726-24": {
        source: "iana"
      },
      "audio/g726-32": {
        source: "iana"
      },
      "audio/g726-40": {
        source: "iana"
      },
      "audio/g728": {
        source: "iana"
      },
      "audio/g729": {
        source: "iana"
      },
      "audio/g7291": {
        source: "iana"
      },
      "audio/g729d": {
        source: "iana"
      },
      "audio/g729e": {
        source: "iana"
      },
      "audio/gsm": {
        source: "iana"
      },
      "audio/gsm-efr": {
        source: "iana"
      },
      "audio/gsm-hr-08": {
        source: "iana"
      },
      "audio/ilbc": {
        source: "iana"
      },
      "audio/ip-mr_v2.5": {
        source: "iana"
      },
      "audio/isac": {
        source: "apache"
      },
      "audio/l16": {
        source: "iana"
      },
      "audio/l20": {
        source: "iana"
      },
      "audio/l24": {
        source: "iana",
        compressible: !1
      },
      "audio/l8": {
        source: "iana"
      },
      "audio/lpc": {
        source: "iana"
      },
      "audio/melp": {
        source: "iana"
      },
      "audio/melp1200": {
        source: "iana"
      },
      "audio/melp2400": {
        source: "iana"
      },
      "audio/melp600": {
        source: "iana"
      },
      "audio/mhas": {
        source: "iana"
      },
      "audio/midi": {
        source: "apache",
        extensions: ["mid", "midi", "kar", "rmi"]
      },
      "audio/mobile-xmf": {
        source: "iana",
        extensions: ["mxmf"]
      },
      "audio/mp3": {
        compressible: !1,
        extensions: ["mp3"]
      },
      "audio/mp4": {
        source: "iana",
        compressible: !1,
        extensions: ["m4a", "mp4a"]
      },
      "audio/mp4a-latm": {
        source: "iana"
      },
      "audio/mpa": {
        source: "iana"
      },
      "audio/mpa-robust": {
        source: "iana"
      },
      "audio/mpeg": {
        source: "iana",
        compressible: !1,
        extensions: ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"]
      },
      "audio/mpeg4-generic": {
        source: "iana"
      },
      "audio/musepack": {
        source: "apache"
      },
      "audio/ogg": {
        source: "iana",
        compressible: !1,
        extensions: ["oga", "ogg", "spx", "opus"]
      },
      "audio/opus": {
        source: "iana"
      },
      "audio/parityfec": {
        source: "iana"
      },
      "audio/pcma": {
        source: "iana"
      },
      "audio/pcma-wb": {
        source: "iana"
      },
      "audio/pcmu": {
        source: "iana"
      },
      "audio/pcmu-wb": {
        source: "iana"
      },
      "audio/prs.sid": {
        source: "iana"
      },
      "audio/qcelp": {
        source: "iana"
      },
      "audio/raptorfec": {
        source: "iana"
      },
      "audio/red": {
        source: "iana"
      },
      "audio/rtp-enc-aescm128": {
        source: "iana"
      },
      "audio/rtp-midi": {
        source: "iana"
      },
      "audio/rtploopback": {
        source: "iana"
      },
      "audio/rtx": {
        source: "iana"
      },
      "audio/s3m": {
        source: "apache",
        extensions: ["s3m"]
      },
      "audio/scip": {
        source: "iana"
      },
      "audio/silk": {
        source: "apache",
        extensions: ["sil"]
      },
      "audio/smv": {
        source: "iana"
      },
      "audio/smv-qcp": {
        source: "iana"
      },
      "audio/smv0": {
        source: "iana"
      },
      "audio/sofa": {
        source: "iana"
      },
      "audio/sp-midi": {
        source: "iana"
      },
      "audio/speex": {
        source: "iana"
      },
      "audio/t140c": {
        source: "iana"
      },
      "audio/t38": {
        source: "iana"
      },
      "audio/telephone-event": {
        source: "iana"
      },
      "audio/tetra_acelp": {
        source: "iana"
      },
      "audio/tetra_acelp_bb": {
        source: "iana"
      },
      "audio/tone": {
        source: "iana"
      },
      "audio/tsvcis": {
        source: "iana"
      },
      "audio/uemclip": {
        source: "iana"
      },
      "audio/ulpfec": {
        source: "iana"
      },
      "audio/usac": {
        source: "iana"
      },
      "audio/vdvi": {
        source: "iana"
      },
      "audio/vmr-wb": {
        source: "iana"
      },
      "audio/vnd.3gpp.iufp": {
        source: "iana"
      },
      "audio/vnd.4sb": {
        source: "iana"
      },
      "audio/vnd.audiokoz": {
        source: "iana"
      },
      "audio/vnd.celp": {
        source: "iana"
      },
      "audio/vnd.cisco.nse": {
        source: "iana"
      },
      "audio/vnd.cmles.radio-events": {
        source: "iana"
      },
      "audio/vnd.cns.anp1": {
        source: "iana"
      },
      "audio/vnd.cns.inf1": {
        source: "iana"
      },
      "audio/vnd.dece.audio": {
        source: "iana",
        extensions: ["uva", "uvva"]
      },
      "audio/vnd.digital-winds": {
        source: "iana",
        extensions: ["eol"]
      },
      "audio/vnd.dlna.adts": {
        source: "iana"
      },
      "audio/vnd.dolby.heaac.1": {
        source: "iana"
      },
      "audio/vnd.dolby.heaac.2": {
        source: "iana"
      },
      "audio/vnd.dolby.mlp": {
        source: "iana"
      },
      "audio/vnd.dolby.mps": {
        source: "iana"
      },
      "audio/vnd.dolby.pl2": {
        source: "iana"
      },
      "audio/vnd.dolby.pl2x": {
        source: "iana"
      },
      "audio/vnd.dolby.pl2z": {
        source: "iana"
      },
      "audio/vnd.dolby.pulse.1": {
        source: "iana"
      },
      "audio/vnd.dra": {
        source: "iana",
        extensions: ["dra"]
      },
      "audio/vnd.dts": {
        source: "iana",
        extensions: ["dts"]
      },
      "audio/vnd.dts.hd": {
        source: "iana",
        extensions: ["dtshd"]
      },
      "audio/vnd.dts.uhd": {
        source: "iana"
      },
      "audio/vnd.dvb.file": {
        source: "iana"
      },
      "audio/vnd.everad.plj": {
        source: "iana"
      },
      "audio/vnd.hns.audio": {
        source: "iana"
      },
      "audio/vnd.lucent.voice": {
        source: "iana",
        extensions: ["lvp"]
      },
      "audio/vnd.ms-playready.media.pya": {
        source: "iana",
        extensions: ["pya"]
      },
      "audio/vnd.nokia.mobile-xmf": {
        source: "iana"
      },
      "audio/vnd.nortel.vbk": {
        source: "iana"
      },
      "audio/vnd.nuera.ecelp4800": {
        source: "iana",
        extensions: ["ecelp4800"]
      },
      "audio/vnd.nuera.ecelp7470": {
        source: "iana",
        extensions: ["ecelp7470"]
      },
      "audio/vnd.nuera.ecelp9600": {
        source: "iana",
        extensions: ["ecelp9600"]
      },
      "audio/vnd.octel.sbc": {
        source: "iana"
      },
      "audio/vnd.presonus.multitrack": {
        source: "iana"
      },
      "audio/vnd.qcelp": {
        source: "iana"
      },
      "audio/vnd.rhetorex.32kadpcm": {
        source: "iana"
      },
      "audio/vnd.rip": {
        source: "iana",
        extensions: ["rip"]
      },
      "audio/vnd.rn-realaudio": {
        compressible: !1
      },
      "audio/vnd.sealedmedia.softseal.mpeg": {
        source: "iana"
      },
      "audio/vnd.vmx.cvsd": {
        source: "iana"
      },
      "audio/vnd.wave": {
        compressible: !1
      },
      "audio/vorbis": {
        source: "iana",
        compressible: !1
      },
      "audio/vorbis-config": {
        source: "iana"
      },
      "audio/wav": {
        compressible: !1,
        extensions: ["wav"]
      },
      "audio/wave": {
        compressible: !1,
        extensions: ["wav"]
      },
      "audio/webm": {
        source: "apache",
        compressible: !1,
        extensions: ["weba"]
      },
      "audio/x-aac": {
        source: "apache",
        compressible: !1,
        extensions: ["aac"]
      },
      "audio/x-aiff": {
        source: "apache",
        extensions: ["aif", "aiff", "aifc"]
      },
      "audio/x-caf": {
        source: "apache",
        compressible: !1,
        extensions: ["caf"]
      },
      "audio/x-flac": {
        source: "apache",
        extensions: ["flac"]
      },
      "audio/x-m4a": {
        source: "nginx",
        extensions: ["m4a"]
      },
      "audio/x-matroska": {
        source: "apache",
        extensions: ["mka"]
      },
      "audio/x-mpegurl": {
        source: "apache",
        extensions: ["m3u"]
      },
      "audio/x-ms-wax": {
        source: "apache",
        extensions: ["wax"]
      },
      "audio/x-ms-wma": {
        source: "apache",
        extensions: ["wma"]
      },
      "audio/x-pn-realaudio": {
        source: "apache",
        extensions: ["ram", "ra"]
      },
      "audio/x-pn-realaudio-plugin": {
        source: "apache",
        extensions: ["rmp"]
      },
      "audio/x-realaudio": {
        source: "nginx",
        extensions: ["ra"]
      },
      "audio/x-tta": {
        source: "apache"
      },
      "audio/x-wav": {
        source: "apache",
        extensions: ["wav"]
      },
      "audio/xm": {
        source: "apache",
        extensions: ["xm"]
      },
      "chemical/x-cdx": {
        source: "apache",
        extensions: ["cdx"]
      },
      "chemical/x-cif": {
        source: "apache",
        extensions: ["cif"]
      },
      "chemical/x-cmdf": {
        source: "apache",
        extensions: ["cmdf"]
      },
      "chemical/x-cml": {
        source: "apache",
        extensions: ["cml"]
      },
      "chemical/x-csml": {
        source: "apache",
        extensions: ["csml"]
      },
      "chemical/x-pdb": {
        source: "apache"
      },
      "chemical/x-xyz": {
        source: "apache",
        extensions: ["xyz"]
      },
      "font/collection": {
        source: "iana",
        extensions: ["ttc"]
      },
      "font/otf": {
        source: "iana",
        compressible: !0,
        extensions: ["otf"]
      },
      "font/sfnt": {
        source: "iana"
      },
      "font/ttf": {
        source: "iana",
        compressible: !0,
        extensions: ["ttf"]
      },
      "font/woff": {
        source: "iana",
        extensions: ["woff"]
      },
      "font/woff2": {
        source: "iana",
        extensions: ["woff2"]
      },
      "image/aces": {
        source: "iana",
        extensions: ["exr"]
      },
      "image/apng": {
        compressible: !1,
        extensions: ["apng"]
      },
      "image/avci": {
        source: "iana",
        extensions: ["avci"]
      },
      "image/avcs": {
        source: "iana",
        extensions: ["avcs"]
      },
      "image/avif": {
        source: "iana",
        compressible: !1,
        extensions: ["avif"]
      },
      "image/bmp": {
        source: "iana",
        compressible: !0,
        extensions: ["bmp"]
      },
      "image/cgm": {
        source: "iana",
        extensions: ["cgm"]
      },
      "image/dicom-rle": {
        source: "iana",
        extensions: ["drle"]
      },
      "image/emf": {
        source: "iana",
        extensions: ["emf"]
      },
      "image/fits": {
        source: "iana",
        extensions: ["fits"]
      },
      "image/g3fax": {
        source: "iana",
        extensions: ["g3"]
      },
      "image/gif": {
        source: "iana",
        compressible: !1,
        extensions: ["gif"]
      },
      "image/heic": {
        source: "iana",
        extensions: ["heic"]
      },
      "image/heic-sequence": {
        source: "iana",
        extensions: ["heics"]
      },
      "image/heif": {
        source: "iana",
        extensions: ["heif"]
      },
      "image/heif-sequence": {
        source: "iana",
        extensions: ["heifs"]
      },
      "image/hej2k": {
        source: "iana",
        extensions: ["hej2"]
      },
      "image/hsj2": {
        source: "iana",
        extensions: ["hsj2"]
      },
      "image/ief": {
        source: "iana",
        extensions: ["ief"]
      },
      "image/jls": {
        source: "iana",
        extensions: ["jls"]
      },
      "image/jp2": {
        source: "iana",
        compressible: !1,
        extensions: ["jp2", "jpg2"]
      },
      "image/jpeg": {
        source: "iana",
        compressible: !1,
        extensions: ["jpeg", "jpg", "jpe"]
      },
      "image/jph": {
        source: "iana",
        extensions: ["jph"]
      },
      "image/jphc": {
        source: "iana",
        extensions: ["jhc"]
      },
      "image/jpm": {
        source: "iana",
        compressible: !1,
        extensions: ["jpm"]
      },
      "image/jpx": {
        source: "iana",
        compressible: !1,
        extensions: ["jpx", "jpf"]
      },
      "image/jxr": {
        source: "iana",
        extensions: ["jxr"]
      },
      "image/jxra": {
        source: "iana",
        extensions: ["jxra"]
      },
      "image/jxrs": {
        source: "iana",
        extensions: ["jxrs"]
      },
      "image/jxs": {
        source: "iana",
        extensions: ["jxs"]
      },
      "image/jxsc": {
        source: "iana",
        extensions: ["jxsc"]
      },
      "image/jxsi": {
        source: "iana",
        extensions: ["jxsi"]
      },
      "image/jxss": {
        source: "iana",
        extensions: ["jxss"]
      },
      "image/ktx": {
        source: "iana",
        extensions: ["ktx"]
      },
      "image/ktx2": {
        source: "iana",
        extensions: ["ktx2"]
      },
      "image/naplps": {
        source: "iana"
      },
      "image/pjpeg": {
        compressible: !1
      },
      "image/png": {
        source: "iana",
        compressible: !1,
        extensions: ["png"]
      },
      "image/prs.btif": {
        source: "iana",
        extensions: ["btif"]
      },
      "image/prs.pti": {
        source: "iana",
        extensions: ["pti"]
      },
      "image/pwg-raster": {
        source: "iana"
      },
      "image/sgi": {
        source: "apache",
        extensions: ["sgi"]
      },
      "image/svg+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["svg", "svgz"]
      },
      "image/t38": {
        source: "iana",
        extensions: ["t38"]
      },
      "image/tiff": {
        source: "iana",
        compressible: !1,
        extensions: ["tif", "tiff"]
      },
      "image/tiff-fx": {
        source: "iana",
        extensions: ["tfx"]
      },
      "image/vnd.adobe.photoshop": {
        source: "iana",
        compressible: !0,
        extensions: ["psd"]
      },
      "image/vnd.airzip.accelerator.azv": {
        source: "iana",
        extensions: ["azv"]
      },
      "image/vnd.cns.inf2": {
        source: "iana"
      },
      "image/vnd.dece.graphic": {
        source: "iana",
        extensions: ["uvi", "uvvi", "uvg", "uvvg"]
      },
      "image/vnd.djvu": {
        source: "iana",
        extensions: ["djvu", "djv"]
      },
      "image/vnd.dvb.subtitle": {
        source: "iana",
        extensions: ["sub"]
      },
      "image/vnd.dwg": {
        source: "iana",
        extensions: ["dwg"]
      },
      "image/vnd.dxf": {
        source: "iana",
        extensions: ["dxf"]
      },
      "image/vnd.fastbidsheet": {
        source: "iana",
        extensions: ["fbs"]
      },
      "image/vnd.fpx": {
        source: "iana",
        extensions: ["fpx"]
      },
      "image/vnd.fst": {
        source: "iana",
        extensions: ["fst"]
      },
      "image/vnd.fujixerox.edmics-mmr": {
        source: "iana",
        extensions: ["mmr"]
      },
      "image/vnd.fujixerox.edmics-rlc": {
        source: "iana",
        extensions: ["rlc"]
      },
      "image/vnd.globalgraphics.pgb": {
        source: "iana"
      },
      "image/vnd.microsoft.icon": {
        source: "iana",
        compressible: !0,
        extensions: ["ico"]
      },
      "image/vnd.mix": {
        source: "iana"
      },
      "image/vnd.mozilla.apng": {
        source: "iana"
      },
      "image/vnd.ms-dds": {
        compressible: !0,
        extensions: ["dds"]
      },
      "image/vnd.ms-modi": {
        source: "iana",
        extensions: ["mdi"]
      },
      "image/vnd.ms-photo": {
        source: "apache",
        extensions: ["wdp"]
      },
      "image/vnd.net-fpx": {
        source: "iana",
        extensions: ["npx"]
      },
      "image/vnd.pco.b16": {
        source: "iana",
        extensions: ["b16"]
      },
      "image/vnd.radiance": {
        source: "iana"
      },
      "image/vnd.sealed.png": {
        source: "iana"
      },
      "image/vnd.sealedmedia.softseal.gif": {
        source: "iana"
      },
      "image/vnd.sealedmedia.softseal.jpg": {
        source: "iana"
      },
      "image/vnd.svf": {
        source: "iana"
      },
      "image/vnd.tencent.tap": {
        source: "iana",
        extensions: ["tap"]
      },
      "image/vnd.valve.source.texture": {
        source: "iana",
        extensions: ["vtf"]
      },
      "image/vnd.wap.wbmp": {
        source: "iana",
        extensions: ["wbmp"]
      },
      "image/vnd.xiff": {
        source: "iana",
        extensions: ["xif"]
      },
      "image/vnd.zbrush.pcx": {
        source: "iana",
        extensions: ["pcx"]
      },
      "image/webp": {
        source: "apache",
        extensions: ["webp"]
      },
      "image/wmf": {
        source: "iana",
        extensions: ["wmf"]
      },
      "image/x-3ds": {
        source: "apache",
        extensions: ["3ds"]
      },
      "image/x-cmu-raster": {
        source: "apache",
        extensions: ["ras"]
      },
      "image/x-cmx": {
        source: "apache",
        extensions: ["cmx"]
      },
      "image/x-freehand": {
        source: "apache",
        extensions: ["fh", "fhc", "fh4", "fh5", "fh7"]
      },
      "image/x-icon": {
        source: "apache",
        compressible: !0,
        extensions: ["ico"]
      },
      "image/x-jng": {
        source: "nginx",
        extensions: ["jng"]
      },
      "image/x-mrsid-image": {
        source: "apache",
        extensions: ["sid"]
      },
      "image/x-ms-bmp": {
        source: "nginx",
        compressible: !0,
        extensions: ["bmp"]
      },
      "image/x-pcx": {
        source: "apache",
        extensions: ["pcx"]
      },
      "image/x-pict": {
        source: "apache",
        extensions: ["pic", "pct"]
      },
      "image/x-portable-anymap": {
        source: "apache",
        extensions: ["pnm"]
      },
      "image/x-portable-bitmap": {
        source: "apache",
        extensions: ["pbm"]
      },
      "image/x-portable-graymap": {
        source: "apache",
        extensions: ["pgm"]
      },
      "image/x-portable-pixmap": {
        source: "apache",
        extensions: ["ppm"]
      },
      "image/x-rgb": {
        source: "apache",
        extensions: ["rgb"]
      },
      "image/x-tga": {
        source: "apache",
        extensions: ["tga"]
      },
      "image/x-xbitmap": {
        source: "apache",
        extensions: ["xbm"]
      },
      "image/x-xcf": {
        compressible: !1
      },
      "image/x-xpixmap": {
        source: "apache",
        extensions: ["xpm"]
      },
      "image/x-xwindowdump": {
        source: "apache",
        extensions: ["xwd"]
      },
      "message/cpim": {
        source: "iana"
      },
      "message/delivery-status": {
        source: "iana"
      },
      "message/disposition-notification": {
        source: "iana",
        extensions: [
          "disposition-notification"
        ]
      },
      "message/external-body": {
        source: "iana"
      },
      "message/feedback-report": {
        source: "iana"
      },
      "message/global": {
        source: "iana",
        extensions: ["u8msg"]
      },
      "message/global-delivery-status": {
        source: "iana",
        extensions: ["u8dsn"]
      },
      "message/global-disposition-notification": {
        source: "iana",
        extensions: ["u8mdn"]
      },
      "message/global-headers": {
        source: "iana",
        extensions: ["u8hdr"]
      },
      "message/http": {
        source: "iana",
        compressible: !1
      },
      "message/imdn+xml": {
        source: "iana",
        compressible: !0
      },
      "message/news": {
        source: "iana"
      },
      "message/partial": {
        source: "iana",
        compressible: !1
      },
      "message/rfc822": {
        source: "iana",
        compressible: !0,
        extensions: ["eml", "mime"]
      },
      "message/s-http": {
        source: "iana"
      },
      "message/sip": {
        source: "iana"
      },
      "message/sipfrag": {
        source: "iana"
      },
      "message/tracking-status": {
        source: "iana"
      },
      "message/vnd.si.simp": {
        source: "iana"
      },
      "message/vnd.wfa.wsc": {
        source: "iana",
        extensions: ["wsc"]
      },
      "model/3mf": {
        source: "iana",
        extensions: ["3mf"]
      },
      "model/e57": {
        source: "iana"
      },
      "model/gltf+json": {
        source: "iana",
        compressible: !0,
        extensions: ["gltf"]
      },
      "model/gltf-binary": {
        source: "iana",
        compressible: !0,
        extensions: ["glb"]
      },
      "model/iges": {
        source: "iana",
        compressible: !1,
        extensions: ["igs", "iges"]
      },
      "model/mesh": {
        source: "iana",
        compressible: !1,
        extensions: ["msh", "mesh", "silo"]
      },
      "model/mtl": {
        source: "iana",
        extensions: ["mtl"]
      },
      "model/obj": {
        source: "iana",
        extensions: ["obj"]
      },
      "model/step": {
        source: "iana"
      },
      "model/step+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["stpx"]
      },
      "model/step+zip": {
        source: "iana",
        compressible: !1,
        extensions: ["stpz"]
      },
      "model/step-xml+zip": {
        source: "iana",
        compressible: !1,
        extensions: ["stpxz"]
      },
      "model/stl": {
        source: "iana",
        extensions: ["stl"]
      },
      "model/vnd.collada+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["dae"]
      },
      "model/vnd.dwf": {
        source: "iana",
        extensions: ["dwf"]
      },
      "model/vnd.flatland.3dml": {
        source: "iana"
      },
      "model/vnd.gdl": {
        source: "iana",
        extensions: ["gdl"]
      },
      "model/vnd.gs-gdl": {
        source: "apache"
      },
      "model/vnd.gs.gdl": {
        source: "iana"
      },
      "model/vnd.gtw": {
        source: "iana",
        extensions: ["gtw"]
      },
      "model/vnd.moml+xml": {
        source: "iana",
        compressible: !0
      },
      "model/vnd.mts": {
        source: "iana",
        extensions: ["mts"]
      },
      "model/vnd.opengex": {
        source: "iana",
        extensions: ["ogex"]
      },
      "model/vnd.parasolid.transmit.binary": {
        source: "iana",
        extensions: ["x_b"]
      },
      "model/vnd.parasolid.transmit.text": {
        source: "iana",
        extensions: ["x_t"]
      },
      "model/vnd.pytha.pyox": {
        source: "iana"
      },
      "model/vnd.rosette.annotated-data-model": {
        source: "iana"
      },
      "model/vnd.sap.vds": {
        source: "iana",
        extensions: ["vds"]
      },
      "model/vnd.usdz+zip": {
        source: "iana",
        compressible: !1,
        extensions: ["usdz"]
      },
      "model/vnd.valve.source.compiled-map": {
        source: "iana",
        extensions: ["bsp"]
      },
      "model/vnd.vtu": {
        source: "iana",
        extensions: ["vtu"]
      },
      "model/vrml": {
        source: "iana",
        compressible: !1,
        extensions: ["wrl", "vrml"]
      },
      "model/x3d+binary": {
        source: "apache",
        compressible: !1,
        extensions: ["x3db", "x3dbz"]
      },
      "model/x3d+fastinfoset": {
        source: "iana",
        extensions: ["x3db"]
      },
      "model/x3d+vrml": {
        source: "apache",
        compressible: !1,
        extensions: ["x3dv", "x3dvz"]
      },
      "model/x3d+xml": {
        source: "iana",
        compressible: !0,
        extensions: ["x3d", "x3dz"]
      },
      "model/x3d-vrml": {
        source: "iana",
        extensions: ["x3dv"]
      },
      "multipart/alternative": {
        source: "iana",
        compressible: !1
      },
      "multipart/appledouble": {
        source: "iana"
      },
      "multipart/byteranges": {
        source: "iana"
      },
      "multipart/digest": {
        source: "iana"
      },
      "multipart/encrypted": {
        source: "iana",
        compressible: !1
      },
      "multipart/form-data": {
        source: "iana",
        compressible: !1
      },
      "multipart/header-set": {
        source: "iana"
      },
      "multipart/mixed": {
        source: "iana"
      },
      "multipart/multilingual": {
        source: "iana"
      },
      "multipart/parallel": {
        source: "iana"
      },
      "multipart/related": {
        source: "iana",
        compressible: !1
      },
      "multipart/report": {
        source: "iana"
      },
      "multipart/signed": {
        source: "iana",
        compressible: !1
      },
      "multipart/vnd.bint.med-plus": {
        source: "iana"
      },
      "multipart/voice-message": {
        source: "iana"
      },
      "multipart/x-mixed-replace": {
        source: "iana"
      },
      "text/1d-interleaved-parityfec": {
        source: "iana"
      },
      "text/cache-manifest": {
        source: "iana",
        compressible: !0,
        extensions: ["appcache", "manifest"]
      },
      "text/calendar": {
        source: "iana",
        extensions: ["ics", "ifb"]
      },
      "text/calender": {
        compressible: !0
      },
      "text/cmd": {
        compressible: !0
      },
      "text/coffeescript": {
        extensions: ["coffee", "litcoffee"]
      },
      "text/cql": {
        source: "iana"
      },
      "text/cql-expression": {
        source: "iana"
      },
      "text/cql-identifier": {
        source: "iana"
      },
      "text/css": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["css"]
      },
      "text/csv": {
        source: "iana",
        compressible: !0,
        extensions: ["csv"]
      },
      "text/csv-schema": {
        source: "iana"
      },
      "text/directory": {
        source: "iana"
      },
      "text/dns": {
        source: "iana"
      },
      "text/ecmascript": {
        source: "iana"
      },
      "text/encaprtp": {
        source: "iana"
      },
      "text/enriched": {
        source: "iana"
      },
      "text/fhirpath": {
        source: "iana"
      },
      "text/flexfec": {
        source: "iana"
      },
      "text/fwdred": {
        source: "iana"
      },
      "text/gff3": {
        source: "iana"
      },
      "text/grammar-ref-list": {
        source: "iana"
      },
      "text/html": {
        source: "iana",
        compressible: !0,
        extensions: ["html", "htm", "shtml"]
      },
      "text/jade": {
        extensions: ["jade"]
      },
      "text/javascript": {
        source: "iana",
        compressible: !0
      },
      "text/jcr-cnd": {
        source: "iana"
      },
      "text/jsx": {
        compressible: !0,
        extensions: ["jsx"]
      },
      "text/less": {
        compressible: !0,
        extensions: ["less"]
      },
      "text/markdown": {
        source: "iana",
        compressible: !0,
        extensions: ["markdown", "md"]
      },
      "text/mathml": {
        source: "nginx",
        extensions: ["mml"]
      },
      "text/mdx": {
        compressible: !0,
        extensions: ["mdx"]
      },
      "text/mizar": {
        source: "iana"
      },
      "text/n3": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["n3"]
      },
      "text/parameters": {
        source: "iana",
        charset: "UTF-8"
      },
      "text/parityfec": {
        source: "iana"
      },
      "text/plain": {
        source: "iana",
        compressible: !0,
        extensions: ["txt", "text", "conf", "def", "list", "log", "in", "ini"]
      },
      "text/provenance-notation": {
        source: "iana",
        charset: "UTF-8"
      },
      "text/prs.fallenstein.rst": {
        source: "iana"
      },
      "text/prs.lines.tag": {
        source: "iana",
        extensions: ["dsc"]
      },
      "text/prs.prop.logic": {
        source: "iana"
      },
      "text/raptorfec": {
        source: "iana"
      },
      "text/red": {
        source: "iana"
      },
      "text/rfc822-headers": {
        source: "iana"
      },
      "text/richtext": {
        source: "iana",
        compressible: !0,
        extensions: ["rtx"]
      },
      "text/rtf": {
        source: "iana",
        compressible: !0,
        extensions: ["rtf"]
      },
      "text/rtp-enc-aescm128": {
        source: "iana"
      },
      "text/rtploopback": {
        source: "iana"
      },
      "text/rtx": {
        source: "iana"
      },
      "text/sgml": {
        source: "iana",
        extensions: ["sgml", "sgm"]
      },
      "text/shaclc": {
        source: "iana"
      },
      "text/shex": {
        source: "iana",
        extensions: ["shex"]
      },
      "text/slim": {
        extensions: ["slim", "slm"]
      },
      "text/spdx": {
        source: "iana",
        extensions: ["spdx"]
      },
      "text/strings": {
        source: "iana"
      },
      "text/stylus": {
        extensions: ["stylus", "styl"]
      },
      "text/t140": {
        source: "iana"
      },
      "text/tab-separated-values": {
        source: "iana",
        compressible: !0,
        extensions: ["tsv"]
      },
      "text/troff": {
        source: "iana",
        extensions: ["t", "tr", "roff", "man", "me", "ms"]
      },
      "text/turtle": {
        source: "iana",
        charset: "UTF-8",
        extensions: ["ttl"]
      },
      "text/ulpfec": {
        source: "iana"
      },
      "text/uri-list": {
        source: "iana",
        compressible: !0,
        extensions: ["uri", "uris", "urls"]
      },
      "text/vcard": {
        source: "iana",
        compressible: !0,
        extensions: ["vcard"]
      },
      "text/vnd.a": {
        source: "iana"
      },
      "text/vnd.abc": {
        source: "iana"
      },
      "text/vnd.ascii-art": {
        source: "iana"
      },
      "text/vnd.curl": {
        source: "iana",
        extensions: ["curl"]
      },
      "text/vnd.curl.dcurl": {
        source: "apache",
        extensions: ["dcurl"]
      },
      "text/vnd.curl.mcurl": {
        source: "apache",
        extensions: ["mcurl"]
      },
      "text/vnd.curl.scurl": {
        source: "apache",
        extensions: ["scurl"]
      },
      "text/vnd.debian.copyright": {
        source: "iana",
        charset: "UTF-8"
      },
      "text/vnd.dmclientscript": {
        source: "iana"
      },
      "text/vnd.dvb.subtitle": {
        source: "iana",
        extensions: ["sub"]
      },
      "text/vnd.esmertec.theme-descriptor": {
        source: "iana",
        charset: "UTF-8"
      },
      "text/vnd.familysearch.gedcom": {
        source: "iana",
        extensions: ["ged"]
      },
      "text/vnd.ficlab.flt": {
        source: "iana"
      },
      "text/vnd.fly": {
        source: "iana",
        extensions: ["fly"]
      },
      "text/vnd.fmi.flexstor": {
        source: "iana",
        extensions: ["flx"]
      },
      "text/vnd.gml": {
        source: "iana"
      },
      "text/vnd.graphviz": {
        source: "iana",
        extensions: ["gv"]
      },
      "text/vnd.hans": {
        source: "iana"
      },
      "text/vnd.hgl": {
        source: "iana"
      },
      "text/vnd.in3d.3dml": {
        source: "iana",
        extensions: ["3dml"]
      },
      "text/vnd.in3d.spot": {
        source: "iana",
        extensions: ["spot"]
      },
      "text/vnd.iptc.newsml": {
        source: "iana"
      },
      "text/vnd.iptc.nitf": {
        source: "iana"
      },
      "text/vnd.latex-z": {
        source: "iana"
      },
      "text/vnd.motorola.reflex": {
        source: "iana"
      },
      "text/vnd.ms-mediapackage": {
        source: "iana"
      },
      "text/vnd.net2phone.commcenter.command": {
        source: "iana"
      },
      "text/vnd.radisys.msml-basic-layout": {
        source: "iana"
      },
      "text/vnd.senx.warpscript": {
        source: "iana"
      },
      "text/vnd.si.uricatalogue": {
        source: "iana"
      },
      "text/vnd.sosi": {
        source: "iana"
      },
      "text/vnd.sun.j2me.app-descriptor": {
        source: "iana",
        charset: "UTF-8",
        extensions: ["jad"]
      },
      "text/vnd.trolltech.linguist": {
        source: "iana",
        charset: "UTF-8"
      },
      "text/vnd.wap.si": {
        source: "iana"
      },
      "text/vnd.wap.sl": {
        source: "iana"
      },
      "text/vnd.wap.wml": {
        source: "iana",
        extensions: ["wml"]
      },
      "text/vnd.wap.wmlscript": {
        source: "iana",
        extensions: ["wmls"]
      },
      "text/vtt": {
        source: "iana",
        charset: "UTF-8",
        compressible: !0,
        extensions: ["vtt"]
      },
      "text/x-asm": {
        source: "apache",
        extensions: ["s", "asm"]
      },
      "text/x-c": {
        source: "apache",
        extensions: ["c", "cc", "cxx", "cpp", "h", "hh", "dic"]
      },
      "text/x-component": {
        source: "nginx",
        extensions: ["htc"]
      },
      "text/x-fortran": {
        source: "apache",
        extensions: ["f", "for", "f77", "f90"]
      },
      "text/x-gwt-rpc": {
        compressible: !0
      },
      "text/x-handlebars-template": {
        extensions: ["hbs"]
      },
      "text/x-java-source": {
        source: "apache",
        extensions: ["java"]
      },
      "text/x-jquery-tmpl": {
        compressible: !0
      },
      "text/x-lua": {
        extensions: ["lua"]
      },
      "text/x-markdown": {
        compressible: !0,
        extensions: ["mkd"]
      },
      "text/x-nfo": {
        source: "apache",
        extensions: ["nfo"]
      },
      "text/x-opml": {
        source: "apache",
        extensions: ["opml"]
      },
      "text/x-org": {
        compressible: !0,
        extensions: ["org"]
      },
      "text/x-pascal": {
        source: "apache",
        extensions: ["p", "pas"]
      },
      "text/x-processing": {
        compressible: !0,
        extensions: ["pde"]
      },
      "text/x-sass": {
        extensions: ["sass"]
      },
      "text/x-scss": {
        extensions: ["scss"]
      },
      "text/x-setext": {
        source: "apache",
        extensions: ["etx"]
      },
      "text/x-sfv": {
        source: "apache",
        extensions: ["sfv"]
      },
      "text/x-suse-ymp": {
        compressible: !0,
        extensions: ["ymp"]
      },
      "text/x-uuencode": {
        source: "apache",
        extensions: ["uu"]
      },
      "text/x-vcalendar": {
        source: "apache",
        extensions: ["vcs"]
      },
      "text/x-vcard": {
        source: "apache",
        extensions: ["vcf"]
      },
      "text/xml": {
        source: "iana",
        compressible: !0,
        extensions: ["xml"]
      },
      "text/xml-external-parsed-entity": {
        source: "iana"
      },
      "text/yaml": {
        compressible: !0,
        extensions: ["yaml", "yml"]
      },
      "video/1d-interleaved-parityfec": {
        source: "iana"
      },
      "video/3gpp": {
        source: "iana",
        extensions: ["3gp", "3gpp"]
      },
      "video/3gpp-tt": {
        source: "iana"
      },
      "video/3gpp2": {
        source: "iana",
        extensions: ["3g2"]
      },
      "video/av1": {
        source: "iana"
      },
      "video/bmpeg": {
        source: "iana"
      },
      "video/bt656": {
        source: "iana"
      },
      "video/celb": {
        source: "iana"
      },
      "video/dv": {
        source: "iana"
      },
      "video/encaprtp": {
        source: "iana"
      },
      "video/ffv1": {
        source: "iana"
      },
      "video/flexfec": {
        source: "iana"
      },
      "video/h261": {
        source: "iana",
        extensions: ["h261"]
      },
      "video/h263": {
        source: "iana",
        extensions: ["h263"]
      },
      "video/h263-1998": {
        source: "iana"
      },
      "video/h263-2000": {
        source: "iana"
      },
      "video/h264": {
        source: "iana",
        extensions: ["h264"]
      },
      "video/h264-rcdo": {
        source: "iana"
      },
      "video/h264-svc": {
        source: "iana"
      },
      "video/h265": {
        source: "iana"
      },
      "video/iso.segment": {
        source: "iana",
        extensions: ["m4s"]
      },
      "video/jpeg": {
        source: "iana",
        extensions: ["jpgv"]
      },
      "video/jpeg2000": {
        source: "iana"
      },
      "video/jpm": {
        source: "apache",
        extensions: ["jpm", "jpgm"]
      },
      "video/jxsv": {
        source: "iana"
      },
      "video/mj2": {
        source: "iana",
        extensions: ["mj2", "mjp2"]
      },
      "video/mp1s": {
        source: "iana"
      },
      "video/mp2p": {
        source: "iana"
      },
      "video/mp2t": {
        source: "iana",
        extensions: ["ts"]
      },
      "video/mp4": {
        source: "iana",
        compressible: !1,
        extensions: ["mp4", "mp4v", "mpg4"]
      },
      "video/mp4v-es": {
        source: "iana"
      },
      "video/mpeg": {
        source: "iana",
        compressible: !1,
        extensions: ["mpeg", "mpg", "mpe", "m1v", "m2v"]
      },
      "video/mpeg4-generic": {
        source: "iana"
      },
      "video/mpv": {
        source: "iana"
      },
      "video/nv": {
        source: "iana"
      },
      "video/ogg": {
        source: "iana",
        compressible: !1,
        extensions: ["ogv"]
      },
      "video/parityfec": {
        source: "iana"
      },
      "video/pointer": {
        source: "iana"
      },
      "video/quicktime": {
        source: "iana",
        compressible: !1,
        extensions: ["qt", "mov"]
      },
      "video/raptorfec": {
        source: "iana"
      },
      "video/raw": {
        source: "iana"
      },
      "video/rtp-enc-aescm128": {
        source: "iana"
      },
      "video/rtploopback": {
        source: "iana"
      },
      "video/rtx": {
        source: "iana"
      },
      "video/scip": {
        source: "iana"
      },
      "video/smpte291": {
        source: "iana"
      },
      "video/smpte292m": {
        source: "iana"
      },
      "video/ulpfec": {
        source: "iana"
      },
      "video/vc1": {
        source: "iana"
      },
      "video/vc2": {
        source: "iana"
      },
      "video/vnd.cctv": {
        source: "iana"
      },
      "video/vnd.dece.hd": {
        source: "iana",
        extensions: ["uvh", "uvvh"]
      },
      "video/vnd.dece.mobile": {
        source: "iana",
        extensions: ["uvm", "uvvm"]
      },
      "video/vnd.dece.mp4": {
        source: "iana"
      },
      "video/vnd.dece.pd": {
        source: "iana",
        extensions: ["uvp", "uvvp"]
      },
      "video/vnd.dece.sd": {
        source: "iana",
        extensions: ["uvs", "uvvs"]
      },
      "video/vnd.dece.video": {
        source: "iana",
        extensions: ["uvv", "uvvv"]
      },
      "video/vnd.directv.mpeg": {
        source: "iana"
      },
      "video/vnd.directv.mpeg-tts": {
        source: "iana"
      },
      "video/vnd.dlna.mpeg-tts": {
        source: "iana"
      },
      "video/vnd.dvb.file": {
        source: "iana",
        extensions: ["dvb"]
      },
      "video/vnd.fvt": {
        source: "iana",
        extensions: ["fvt"]
      },
      "video/vnd.hns.video": {
        source: "iana"
      },
      "video/vnd.iptvforum.1dparityfec-1010": {
        source: "iana"
      },
      "video/vnd.iptvforum.1dparityfec-2005": {
        source: "iana"
      },
      "video/vnd.iptvforum.2dparityfec-1010": {
        source: "iana"
      },
      "video/vnd.iptvforum.2dparityfec-2005": {
        source: "iana"
      },
      "video/vnd.iptvforum.ttsavc": {
        source: "iana"
      },
      "video/vnd.iptvforum.ttsmpeg2": {
        source: "iana"
      },
      "video/vnd.motorola.video": {
        source: "iana"
      },
      "video/vnd.motorola.videop": {
        source: "iana"
      },
      "video/vnd.mpegurl": {
        source: "iana",
        extensions: ["mxu", "m4u"]
      },
      "video/vnd.ms-playready.media.pyv": {
        source: "iana",
        extensions: ["pyv"]
      },
      "video/vnd.nokia.interleaved-multimedia": {
        source: "iana"
      },
      "video/vnd.nokia.mp4vr": {
        source: "iana"
      },
      "video/vnd.nokia.videovoip": {
        source: "iana"
      },
      "video/vnd.objectvideo": {
        source: "iana"
      },
      "video/vnd.radgamettools.bink": {
        source: "iana"
      },
      "video/vnd.radgamettools.smacker": {
        source: "iana"
      },
      "video/vnd.sealed.mpeg1": {
        source: "iana"
      },
      "video/vnd.sealed.mpeg4": {
        source: "iana"
      },
      "video/vnd.sealed.swf": {
        source: "iana"
      },
      "video/vnd.sealedmedia.softseal.mov": {
        source: "iana"
      },
      "video/vnd.uvvu.mp4": {
        source: "iana",
        extensions: ["uvu", "uvvu"]
      },
      "video/vnd.vivo": {
        source: "iana",
        extensions: ["viv"]
      },
      "video/vnd.youtube.yt": {
        source: "iana"
      },
      "video/vp8": {
        source: "iana"
      },
      "video/vp9": {
        source: "iana"
      },
      "video/webm": {
        source: "apache",
        compressible: !1,
        extensions: ["webm"]
      },
      "video/x-f4v": {
        source: "apache",
        extensions: ["f4v"]
      },
      "video/x-fli": {
        source: "apache",
        extensions: ["fli"]
      },
      "video/x-flv": {
        source: "apache",
        compressible: !1,
        extensions: ["flv"]
      },
      "video/x-m4v": {
        source: "apache",
        extensions: ["m4v"]
      },
      "video/x-matroska": {
        source: "apache",
        compressible: !1,
        extensions: ["mkv", "mk3d", "mks"]
      },
      "video/x-mng": {
        source: "apache",
        extensions: ["mng"]
      },
      "video/x-ms-asf": {
        source: "apache",
        extensions: ["asf", "asx"]
      },
      "video/x-ms-vob": {
        source: "apache",
        extensions: ["vob"]
      },
      "video/x-ms-wm": {
        source: "apache",
        extensions: ["wm"]
      },
      "video/x-ms-wmv": {
        source: "apache",
        compressible: !1,
        extensions: ["wmv"]
      },
      "video/x-ms-wmx": {
        source: "apache",
        extensions: ["wmx"]
      },
      "video/x-ms-wvx": {
        source: "apache",
        extensions: ["wvx"]
      },
      "video/x-msvideo": {
        source: "apache",
        extensions: ["avi"]
      },
      "video/x-sgi-movie": {
        source: "apache",
        extensions: ["movie"]
      },
      "video/x-smv": {
        source: "apache",
        extensions: ["smv"]
      },
      "x-conference/x-cooltalk": {
        source: "apache",
        extensions: ["ice"]
      },
      "x-shader/x-fragment": {
        compressible: !0
      },
      "x-shader/x-vertex": {
        compressible: !0
      }
    };
  }
});

// node_modules/mime-db/index.js
var require_mime_db = __commonJS({
  "node_modules/mime-db/index.js"(exports2, module2) {
    module2.exports = require_db();
  }
});

// node_modules/mime-types/index.js
var require_mime_types = __commonJS({
  "node_modules/mime-types/index.js"(exports2) {
    "use strict";
    var db = require_mime_db(), extname = require("path").extname, EXTRACT_TYPE_REGEXP = /^\s*([^;\s]*)(?:;|\s|$)/, TEXT_TYPE_REGEXP = /^text\//i;
    exports2.charset = charset;
    exports2.charsets = { lookup: charset };
    exports2.contentType = contentType;
    exports2.extension = extension;
    exports2.extensions = /* @__PURE__ */ Object.create(null);
    exports2.lookup = lookup;
    exports2.types = /* @__PURE__ */ Object.create(null);
    populateMaps(exports2.extensions, exports2.types);
    function charset(type) {
      if (!type || typeof type != "string")
        return !1;
      var match = EXTRACT_TYPE_REGEXP.exec(type), mime = match && db[match[1].toLowerCase()];
      return mime && mime.charset ? mime.charset : match && TEXT_TYPE_REGEXP.test(match[1]) ? "UTF-8" : !1;
    }
    function contentType(str) {
      if (!str || typeof str != "string")
        return !1;
      var mime = str.indexOf("/") === -1 ? exports2.lookup(str) : str;
      if (!mime)
        return !1;
      if (mime.indexOf("charset") === -1) {
        var charset2 = exports2.charset(mime);
        charset2 && (mime += "; charset=" + charset2.toLowerCase());
      }
      return mime;
    }
    function extension(type) {
      if (!type || typeof type != "string")
        return !1;
      var match = EXTRACT_TYPE_REGEXP.exec(type), exts = match && exports2.extensions[match[1].toLowerCase()];
      return !exts || !exts.length ? !1 : exts[0];
    }
    function lookup(path) {
      if (!path || typeof path != "string")
        return !1;
      var extension2 = extname("x." + path).toLowerCase().substr(1);
      return extension2 && exports2.types[extension2] || !1;
    }
    function populateMaps(extensions, types) {
      var preference = ["nginx", "apache", void 0, "iana"];
      Object.keys(db).forEach(function(type) {
        var mime = db[type], exts = mime.extensions;
        if (!(!exts || !exts.length)) {
          extensions[type] = exts;
          for (var i = 0; i < exts.length; i++) {
            var extension2 = exts[i];
            if (types[extension2]) {
              var from = preference.indexOf(db[types[extension2]].source), to = preference.indexOf(mime.source);
              if (types[extension2] !== "application/octet-stream" && (from > to || from === to && types[extension2].substr(0, 12) === "application/"))
                continue;
            }
            types[extension2] = type;
          }
        }
      });
    }
  }
});

// node_modules/asynckit/lib/defer.js
var require_defer = __commonJS({
  "node_modules/asynckit/lib/defer.js"(exports2, module2) {
    module2.exports = defer;
    function defer(fn) {
      var nextTick = typeof setImmediate == "function" ? setImmediate : typeof process == "object" && typeof process.nextTick == "function" ? process.nextTick : null;
      nextTick ? nextTick(fn) : setTimeout(fn, 0);
    }
  }
});

// node_modules/asynckit/lib/async.js
var require_async = __commonJS({
  "node_modules/asynckit/lib/async.js"(exports2, module2) {
    var defer = require_defer();
    module2.exports = async;
    function async(callback) {
      var isAsync = !1;
      return defer(function() {
        isAsync = !0;
      }), function(err, result) {
        isAsync ? callback(err, result) : defer(function() {
          callback(err, result);
        });
      };
    }
  }
});

// node_modules/asynckit/lib/abort.js
var require_abort = __commonJS({
  "node_modules/asynckit/lib/abort.js"(exports2, module2) {
    module2.exports = abort;
    function abort(state) {
      Object.keys(state.jobs).forEach(clean.bind(state)), state.jobs = {};
    }
    function clean(key) {
      typeof this.jobs[key] == "function" && this.jobs[key]();
    }
  }
});

// node_modules/asynckit/lib/iterate.js
var require_iterate = __commonJS({
  "node_modules/asynckit/lib/iterate.js"(exports2, module2) {
    var async = require_async(), abort = require_abort();
    module2.exports = iterate;
    function iterate(list, iterator, state, callback) {
      var key = state.keyedList ? state.keyedList[state.index] : state.index;
      state.jobs[key] = runJob(iterator, key, list[key], function(error, output) {
        key in state.jobs && (delete state.jobs[key], error ? abort(state) : state.results[key] = output, callback(error, state.results));
      });
    }
    function runJob(iterator, key, item, callback) {
      var aborter;
      return iterator.length == 2 ? aborter = iterator(item, async(callback)) : aborter = iterator(item, key, async(callback)), aborter;
    }
  }
});

// node_modules/asynckit/lib/state.js
var require_state = __commonJS({
  "node_modules/asynckit/lib/state.js"(exports2, module2) {
    module2.exports = state;
    function state(list, sortMethod) {
      var isNamedList = !Array.isArray(list), initState = {
        index: 0,
        keyedList: isNamedList || sortMethod ? Object.keys(list) : null,
        jobs: {},
        results: isNamedList ? {} : [],
        size: isNamedList ? Object.keys(list).length : list.length
      };
      return sortMethod && initState.keyedList.sort(isNamedList ? sortMethod : function(a, b) {
        return sortMethod(list[a], list[b]);
      }), initState;
    }
  }
});

// node_modules/asynckit/lib/terminator.js
var require_terminator = __commonJS({
  "node_modules/asynckit/lib/terminator.js"(exports2, module2) {
    var abort = require_abort(), async = require_async();
    module2.exports = terminator;
    function terminator(callback) {
      Object.keys(this.jobs).length && (this.index = this.size, abort(this), async(callback)(null, this.results));
    }
  }
});

// node_modules/asynckit/parallel.js
var require_parallel = __commonJS({
  "node_modules/asynckit/parallel.js"(exports2, module2) {
    var iterate = require_iterate(), initState = require_state(), terminator = require_terminator();
    module2.exports = parallel;
    function parallel(list, iterator, callback) {
      for (var state = initState(list); state.index < (state.keyedList || list).length; )
        iterate(list, iterator, state, function(error, result) {
          if (error) {
            callback(error, result);
            return;
          }
          if (Object.keys(state.jobs).length === 0) {
            callback(null, state.results);
            return;
          }
        }), state.index++;
      return terminator.bind(state, callback);
    }
  }
});

// node_modules/asynckit/serialOrdered.js
var require_serialOrdered = __commonJS({
  "node_modules/asynckit/serialOrdered.js"(exports2, module2) {
    var iterate = require_iterate(), initState = require_state(), terminator = require_terminator();
    module2.exports = serialOrdered;
    module2.exports.ascending = ascending;
    module2.exports.descending = descending;
    function serialOrdered(list, iterator, sortMethod, callback) {
      var state = initState(list, sortMethod);
      return iterate(list, iterator, state, function iteratorHandler(error, result) {
        if (error) {
          callback(error, result);
          return;
        }
        if (state.index++, state.index < (state.keyedList || list).length) {
          iterate(list, iterator, state, iteratorHandler);
          return;
        }
        callback(null, state.results);
      }), terminator.bind(state, callback);
    }
    function ascending(a, b) {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    function descending(a, b) {
      return -1 * ascending(a, b);
    }
  }
});

// node_modules/asynckit/serial.js
var require_serial = __commonJS({
  "node_modules/asynckit/serial.js"(exports2, module2) {
    var serialOrdered = require_serialOrdered();
    module2.exports = serial;
    function serial(list, iterator, callback) {
      return serialOrdered(list, iterator, null, callback);
    }
  }
});

// node_modules/asynckit/index.js
var require_asynckit = __commonJS({
  "node_modules/asynckit/index.js"(exports2, module2) {
    module2.exports = {
      parallel: require_parallel(),
      serial: require_serial(),
      serialOrdered: require_serialOrdered()
    };
  }
});

// node_modules/es-object-atoms/index.js
var require_es_object_atoms = __commonJS({
  "node_modules/es-object-atoms/index.js"(exports2, module2) {
    "use strict";
    module2.exports = Object;
  }
});

// node_modules/es-errors/index.js
var require_es_errors = __commonJS({
  "node_modules/es-errors/index.js"(exports2, module2) {
    "use strict";
    module2.exports = Error;
  }
});

// node_modules/es-errors/eval.js
var require_eval = __commonJS({
  "node_modules/es-errors/eval.js"(exports2, module2) {
    "use strict";
    module2.exports = EvalError;
  }
});

// node_modules/es-errors/range.js
var require_range = __commonJS({
  "node_modules/es-errors/range.js"(exports2, module2) {
    "use strict";
    module2.exports = RangeError;
  }
});

// node_modules/es-errors/ref.js
var require_ref = __commonJS({
  "node_modules/es-errors/ref.js"(exports2, module2) {
    "use strict";
    module2.exports = ReferenceError;
  }
});

// node_modules/es-errors/syntax.js
var require_syntax = __commonJS({
  "node_modules/es-errors/syntax.js"(exports2, module2) {
    "use strict";
    module2.exports = SyntaxError;
  }
});

// node_modules/es-errors/type.js
var require_type = __commonJS({
  "node_modules/es-errors/type.js"(exports2, module2) {
    "use strict";
    module2.exports = TypeError;
  }
});

// node_modules/es-errors/uri.js
var require_uri = __commonJS({
  "node_modules/es-errors/uri.js"(exports2, module2) {
    "use strict";
    module2.exports = URIError;
  }
});

// node_modules/math-intrinsics/abs.js
var require_abs = __commonJS({
  "node_modules/math-intrinsics/abs.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.abs;
  }
});

// node_modules/math-intrinsics/floor.js
var require_floor = __commonJS({
  "node_modules/math-intrinsics/floor.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.floor;
  }
});

// node_modules/math-intrinsics/max.js
var require_max = __commonJS({
  "node_modules/math-intrinsics/max.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.max;
  }
});

// node_modules/math-intrinsics/min.js
var require_min = __commonJS({
  "node_modules/math-intrinsics/min.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.min;
  }
});

// node_modules/math-intrinsics/pow.js
var require_pow = __commonJS({
  "node_modules/math-intrinsics/pow.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.pow;
  }
});

// node_modules/math-intrinsics/round.js
var require_round = __commonJS({
  "node_modules/math-intrinsics/round.js"(exports2, module2) {
    "use strict";
    module2.exports = Math.round;
  }
});

// node_modules/math-intrinsics/isNaN.js
var require_isNaN = __commonJS({
  "node_modules/math-intrinsics/isNaN.js"(exports2, module2) {
    "use strict";
    module2.exports = Number.isNaN || function(a) {
      return a !== a;
    };
  }
});

// node_modules/math-intrinsics/sign.js
var require_sign = __commonJS({
  "node_modules/math-intrinsics/sign.js"(exports2, module2) {
    "use strict";
    var $isNaN = require_isNaN();
    module2.exports = function(number) {
      return $isNaN(number) || number === 0 ? number : number < 0 ? -1 : 1;
    };
  }
});

// node_modules/gopd/gOPD.js
var require_gOPD = __commonJS({
  "node_modules/gopd/gOPD.js"(exports2, module2) {
    "use strict";
    module2.exports = Object.getOwnPropertyDescriptor;
  }
});

// node_modules/gopd/index.js
var require_gopd = __commonJS({
  "node_modules/gopd/index.js"(exports2, module2) {
    "use strict";
    var $gOPD = require_gOPD();
    if ($gOPD)
      try {
        $gOPD([], "length");
      } catch {
        $gOPD = null;
      }
    module2.exports = $gOPD;
  }
});

// node_modules/es-define-property/index.js
var require_es_define_property = __commonJS({
  "node_modules/es-define-property/index.js"(exports2, module2) {
    "use strict";
    var $defineProperty = Object.defineProperty || !1;
    if ($defineProperty)
      try {
        $defineProperty({}, "a", { value: 1 });
      } catch {
        $defineProperty = !1;
      }
    module2.exports = $defineProperty;
  }
});

// node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  "node_modules/has-symbols/shams.js"(exports2, module2) {
    "use strict";
    module2.exports = function() {
      if (typeof Symbol != "function" || typeof Object.getOwnPropertySymbols != "function")
        return !1;
      if (typeof Symbol.iterator == "symbol")
        return !0;
      var obj = {}, sym = /* @__PURE__ */ Symbol("test"), symObj = Object(sym);
      if (typeof sym == "string" || Object.prototype.toString.call(sym) !== "[object Symbol]" || Object.prototype.toString.call(symObj) !== "[object Symbol]")
        return !1;
      var symVal = 42;
      obj[sym] = symVal;
      for (var _ in obj)
        return !1;
      if (typeof Object.keys == "function" && Object.keys(obj).length !== 0 || typeof Object.getOwnPropertyNames == "function" && Object.getOwnPropertyNames(obj).length !== 0)
        return !1;
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym || !Object.prototype.propertyIsEnumerable.call(obj, sym))
        return !1;
      if (typeof Object.getOwnPropertyDescriptor == "function") {
        var descriptor = (
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(obj, sym)
        );
        if (descriptor.value !== symVal || descriptor.enumerable !== !0)
          return !1;
      }
      return !0;
    };
  }
});

// node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  "node_modules/has-symbols/index.js"(exports2, module2) {
    "use strict";
    var origSymbol = typeof Symbol < "u" && Symbol, hasSymbolSham = require_shams();
    module2.exports = function() {
      return typeof origSymbol != "function" || typeof Symbol != "function" || typeof origSymbol("foo") != "symbol" || typeof /* @__PURE__ */ Symbol("bar") != "symbol" ? !1 : hasSymbolSham();
    };
  }
});

// node_modules/get-proto/Reflect.getPrototypeOf.js
var require_Reflect_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Reflect.getPrototypeOf.js"(exports2, module2) {
    "use strict";
    module2.exports = typeof Reflect < "u" && Reflect.getPrototypeOf || null;
  }
});

// node_modules/get-proto/Object.getPrototypeOf.js
var require_Object_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Object.getPrototypeOf.js"(exports2, module2) {
    "use strict";
    var $Object = require_es_object_atoms();
    module2.exports = $Object.getPrototypeOf || null;
  }
});

// node_modules/function-bind/implementation.js
var require_implementation = __commonJS({
  "node_modules/function-bind/implementation.js"(exports2, module2) {
    "use strict";
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ", toStr = Object.prototype.toString, max = Math.max, funcType = "[object Function]", concatty = function(a, b) {
      for (var arr = [], i = 0; i < a.length; i += 1)
        arr[i] = a[i];
      for (var j = 0; j < b.length; j += 1)
        arr[j + a.length] = b[j];
      return arr;
    }, slicy = function(arrLike, offset) {
      for (var arr = [], i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1)
        arr[j] = arrLike[i];
      return arr;
    }, joiny = function(arr, joiner) {
      for (var str = "", i = 0; i < arr.length; i += 1)
        str += arr[i], i + 1 < arr.length && (str += joiner);
      return str;
    };
    module2.exports = function(that) {
      var target = this;
      if (typeof target != "function" || toStr.apply(target) !== funcType)
        throw new TypeError(ERROR_MESSAGE + target);
      for (var args = slicy(arguments, 1), bound, binder = function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            concatty(args, arguments)
          );
          return Object(result) === result ? result : this;
        }
        return target.apply(
          that,
          concatty(args, arguments)
        );
      }, boundLength = max(0, target.length - args.length), boundArgs = [], i = 0; i < boundLength; i++)
        boundArgs[i] = "$" + i;
      if (bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder), target.prototype) {
        var Empty = function() {
        };
        Empty.prototype = target.prototype, bound.prototype = new Empty(), Empty.prototype = null;
      }
      return bound;
    };
  }
});

// node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  "node_modules/function-bind/index.js"(exports2, module2) {
    "use strict";
    var implementation = require_implementation();
    module2.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/call-bind-apply-helpers/functionCall.js
var require_functionCall = __commonJS({
  "node_modules/call-bind-apply-helpers/functionCall.js"(exports2, module2) {
    "use strict";
    module2.exports = Function.prototype.call;
  }
});

// node_modules/call-bind-apply-helpers/functionApply.js
var require_functionApply = __commonJS({
  "node_modules/call-bind-apply-helpers/functionApply.js"(exports2, module2) {
    "use strict";
    module2.exports = Function.prototype.apply;
  }
});

// node_modules/call-bind-apply-helpers/reflectApply.js
var require_reflectApply = __commonJS({
  "node_modules/call-bind-apply-helpers/reflectApply.js"(exports2, module2) {
    "use strict";
    module2.exports = typeof Reflect < "u" && Reflect && Reflect.apply;
  }
});

// node_modules/call-bind-apply-helpers/actualApply.js
var require_actualApply = __commonJS({
  "node_modules/call-bind-apply-helpers/actualApply.js"(exports2, module2) {
    "use strict";
    var bind = require_function_bind(), $apply = require_functionApply(), $call = require_functionCall(), $reflectApply = require_reflectApply();
    module2.exports = $reflectApply || bind.call($call, $apply);
  }
});

// node_modules/call-bind-apply-helpers/index.js
var require_call_bind_apply_helpers = __commonJS({
  "node_modules/call-bind-apply-helpers/index.js"(exports2, module2) {
    "use strict";
    var bind = require_function_bind(), $TypeError = require_type(), $call = require_functionCall(), $actualApply = require_actualApply();
    module2.exports = function(args) {
      if (args.length < 1 || typeof args[0] != "function")
        throw new $TypeError("a function is required");
      return $actualApply(bind, $call, args);
    };
  }
});

// node_modules/dunder-proto/get.js
var require_get = __commonJS({
  "node_modules/dunder-proto/get.js"(exports2, module2) {
    "use strict";
    var callBind = require_call_bind_apply_helpers(), gOPD = require_gopd(), hasProtoAccessor;
    try {
      hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
      [].__proto__ === Array.prototype;
    } catch (e) {
      if (!e || typeof e != "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS")
        throw e;
    }
    var desc = !!hasProtoAccessor && gOPD && gOPD(
      Object.prototype,
      /** @type {keyof typeof Object.prototype} */
      "__proto__"
    ), $Object = Object, $getPrototypeOf = $Object.getPrototypeOf;
    module2.exports = desc && typeof desc.get == "function" ? callBind([desc.get]) : typeof $getPrototypeOf == "function" ? (
      /** @type {import('./get')} */
      function(value) {
        return $getPrototypeOf(value == null ? value : $Object(value));
      }
    ) : !1;
  }
});

// node_modules/get-proto/index.js
var require_get_proto = __commonJS({
  "node_modules/get-proto/index.js"(exports2, module2) {
    "use strict";
    var reflectGetProto = require_Reflect_getPrototypeOf(), originalGetProto = require_Object_getPrototypeOf(), getDunderProto = require_get();
    module2.exports = reflectGetProto ? function(O) {
      return reflectGetProto(O);
    } : originalGetProto ? function(O) {
      if (!O || typeof O != "object" && typeof O != "function")
        throw new TypeError("getProto: not an object");
      return originalGetProto(O);
    } : getDunderProto ? function(O) {
      return getDunderProto(O);
    } : null;
  }
});

// node_modules/hasown/index.js
var require_hasown = __commonJS({
  "node_modules/hasown/index.js"(exports2, module2) {
    "use strict";
    var call = Function.prototype.call, $hasOwn = Object.prototype.hasOwnProperty, bind = require_function_bind();
    module2.exports = bind.call(call, $hasOwn);
  }
});

// node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  "node_modules/get-intrinsic/index.js"(exports2, module2) {
    "use strict";
    var undefined2, $Object = require_es_object_atoms(), $Error = require_es_errors(), $EvalError = require_eval(), $RangeError = require_range(), $ReferenceError = require_ref(), $SyntaxError = require_syntax(), $TypeError = require_type(), $URIError = require_uri(), abs = require_abs(), floor = require_floor(), max = require_max(), min = require_min(), pow = require_pow(), round = require_round(), sign = require_sign(), $Function = Function, getEvalledConstructor = function(expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
      } catch {
      }
    }, $gOPD = require_gopd(), $defineProperty = require_es_define_property(), throwTypeError = function() {
      throw new $TypeError();
    }, ThrowTypeError = $gOPD ? (function() {
      try {
        return arguments.callee, throwTypeError;
      } catch {
        try {
          return $gOPD(arguments, "callee").get;
        } catch {
          return throwTypeError;
        }
      }
    })() : throwTypeError, hasSymbols = require_has_symbols()(), getProto = require_get_proto(), $ObjectGPO = require_Object_getPrototypeOf(), $ReflectGPO = require_Reflect_getPrototypeOf(), $apply = require_functionApply(), $call = require_functionCall(), needsEval = {}, TypedArray = typeof Uint8Array > "u" || !getProto ? undefined2 : getProto(Uint8Array), INTRINSICS = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError > "u" ? undefined2 : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer > "u" ? undefined2 : ArrayBuffer,
      "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
      "%AsyncFromSyncIteratorPrototype%": undefined2,
      "%AsyncFunction%": needsEval,
      "%AsyncGenerator%": needsEval,
      "%AsyncGeneratorFunction%": needsEval,
      "%AsyncIteratorPrototype%": needsEval,
      "%Atomics%": typeof Atomics > "u" ? undefined2 : Atomics,
      "%BigInt%": typeof BigInt > "u" ? undefined2 : BigInt,
      "%BigInt64Array%": typeof BigInt64Array > "u" ? undefined2 : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array > "u" ? undefined2 : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView > "u" ? undefined2 : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": $Error,
      "%eval%": eval,
      // eslint-disable-line no-eval
      "%EvalError%": $EvalError,
      "%Float16Array%": typeof Float16Array > "u" ? undefined2 : Float16Array,
      "%Float32Array%": typeof Float32Array > "u" ? undefined2 : Float32Array,
      "%Float64Array%": typeof Float64Array > "u" ? undefined2 : Float64Array,
      "%FinalizationRegistry%": typeof FinalizationRegistry > "u" ? undefined2 : FinalizationRegistry,
      "%Function%": $Function,
      "%GeneratorFunction%": needsEval,
      "%Int8Array%": typeof Int8Array > "u" ? undefined2 : Int8Array,
      "%Int16Array%": typeof Int16Array > "u" ? undefined2 : Int16Array,
      "%Int32Array%": typeof Int32Array > "u" ? undefined2 : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      "%JSON%": typeof JSON == "object" ? JSON : undefined2,
      "%Map%": typeof Map > "u" ? undefined2 : Map,
      "%MapIteratorPrototype%": typeof Map > "u" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": $Object,
      "%Object.getOwnPropertyDescriptor%": $gOPD,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise > "u" ? undefined2 : Promise,
      "%Proxy%": typeof Proxy > "u" ? undefined2 : Proxy,
      "%RangeError%": $RangeError,
      "%ReferenceError%": $ReferenceError,
      "%Reflect%": typeof Reflect > "u" ? undefined2 : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set > "u" ? undefined2 : Set,
      "%SetIteratorPrototype%": typeof Set > "u" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
      "%SharedArrayBuffer%": typeof SharedArrayBuffer > "u" ? undefined2 : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
      "%Symbol%": hasSymbols ? Symbol : undefined2,
      "%SyntaxError%": $SyntaxError,
      "%ThrowTypeError%": ThrowTypeError,
      "%TypedArray%": TypedArray,
      "%TypeError%": $TypeError,
      "%Uint8Array%": typeof Uint8Array > "u" ? undefined2 : Uint8Array,
      "%Uint8ClampedArray%": typeof Uint8ClampedArray > "u" ? undefined2 : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array > "u" ? undefined2 : Uint16Array,
      "%Uint32Array%": typeof Uint32Array > "u" ? undefined2 : Uint32Array,
      "%URIError%": $URIError,
      "%WeakMap%": typeof WeakMap > "u" ? undefined2 : WeakMap,
      "%WeakRef%": typeof WeakRef > "u" ? undefined2 : WeakRef,
      "%WeakSet%": typeof WeakSet > "u" ? undefined2 : WeakSet,
      "%Function.prototype.call%": $call,
      "%Function.prototype.apply%": $apply,
      "%Object.defineProperty%": $defineProperty,
      "%Object.getPrototypeOf%": $ObjectGPO,
      "%Math.abs%": abs,
      "%Math.floor%": floor,
      "%Math.max%": max,
      "%Math.min%": min,
      "%Math.pow%": pow,
      "%Math.round%": round,
      "%Math.sign%": sign,
      "%Reflect.getPrototypeOf%": $ReflectGPO
    };
    if (getProto)
      try {
        null.error;
      } catch (e) {
        errorProto = getProto(getProto(e)), INTRINSICS["%Error.prototype%"] = errorProto;
      }
    var errorProto, doEval = function doEval2(name) {
      var value;
      if (name === "%AsyncFunction%")
        value = getEvalledConstructor("async function () {}");
      else if (name === "%GeneratorFunction%")
        value = getEvalledConstructor("function* () {}");
      else if (name === "%AsyncGeneratorFunction%")
        value = getEvalledConstructor("async function* () {}");
      else if (name === "%AsyncGenerator%") {
        var fn = doEval2("%AsyncGeneratorFunction%");
        fn && (value = fn.prototype);
      } else if (name === "%AsyncIteratorPrototype%") {
        var gen = doEval2("%AsyncGenerator%");
        gen && getProto && (value = getProto(gen.prototype));
      }
      return INTRINSICS[name] = value, value;
    }, LEGACY_ALIASES = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"]
    }, bind = require_function_bind(), hasOwn = require_hasown(), $concat = bind.call($call, Array.prototype.concat), $spliceApply = bind.call($apply, Array.prototype.splice), $replace = bind.call($call, String.prototype.replace), $strSlice = bind.call($call, String.prototype.slice), $exec = bind.call($call, RegExp.prototype.exec), rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g, reEscapeChar = /\\(\\)?/g, stringToPath = function(string) {
      var first = $strSlice(string, 0, 1), last = $strSlice(string, -1);
      if (first === "%" && last !== "%")
        throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
      if (last === "%" && first !== "%")
        throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
      var result = [];
      return $replace(string, rePropName, function(match, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
      }), result;
    }, getBaseIntrinsic = function(name, allowMissing) {
      var intrinsicName = name, alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName) && (alias = LEGACY_ALIASES[intrinsicName], intrinsicName = "%" + alias[0] + "%"), hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval && (value = doEval(intrinsicName)), typeof value > "u" && !allowMissing)
          throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!");
        return {
          alias,
          name: intrinsicName,
          value
        };
      }
      throw new $SyntaxError("intrinsic " + name + " does not exist!");
    };
    module2.exports = function(name, allowMissing) {
      if (typeof name != "string" || name.length === 0)
        throw new $TypeError("intrinsic name must be a non-empty string");
      if (arguments.length > 1 && typeof allowMissing != "boolean")
        throw new $TypeError('"allowMissing" argument must be a boolean');
      if ($exec(/^%?[^%]*%?$/, name) === null)
        throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
      var parts = stringToPath(name), intrinsicBaseName = parts.length > 0 ? parts[0] : "", intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing), intrinsicRealName = intrinsic.name, value = intrinsic.value, skipFurtherCaching = !1, alias = intrinsic.alias;
      alias && (intrinsicBaseName = alias[0], $spliceApply(parts, $concat([0, 1], alias)));
      for (var i = 1, isOwn = !0; i < parts.length; i += 1) {
        var part = parts[i], first = $strSlice(part, 0, 1), last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === "`" || last === '"' || last === "'" || last === "`") && first !== last)
          throw new $SyntaxError("property names with quotes must have matching quotes");
        if ((part === "constructor" || !isOwn) && (skipFurtherCaching = !0), intrinsicBaseName += "." + part, intrinsicRealName = "%" + intrinsicBaseName + "%", hasOwn(INTRINSICS, intrinsicRealName))
          value = INTRINSICS[intrinsicRealName];
        else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing)
              throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.");
            return;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc, isOwn && "get" in desc && !("originalValue" in desc.get) ? value = desc.get : value = value[part];
          } else
            isOwn = hasOwn(value, part), value = value[part];
          isOwn && !skipFurtherCaching && (INTRINSICS[intrinsicRealName] = value);
        }
      }
      return value;
    };
  }
});

// node_modules/has-tostringtag/shams.js
var require_shams2 = __commonJS({
  "node_modules/has-tostringtag/shams.js"(exports2, module2) {
    "use strict";
    var hasSymbols = require_shams();
    module2.exports = function() {
      return hasSymbols() && !!Symbol.toStringTag;
    };
  }
});

// node_modules/es-set-tostringtag/index.js
var require_es_set_tostringtag = __commonJS({
  "node_modules/es-set-tostringtag/index.js"(exports2, module2) {
    "use strict";
    var GetIntrinsic = require_get_intrinsic(), $defineProperty = GetIntrinsic("%Object.defineProperty%", !0), hasToStringTag = require_shams2()(), hasOwn = require_hasown(), $TypeError = require_type(), toStringTag = hasToStringTag ? Symbol.toStringTag : null;
    module2.exports = function(object, value) {
      var overrideIfSet = arguments.length > 2 && !!arguments[2] && arguments[2].force, nonConfigurable = arguments.length > 2 && !!arguments[2] && arguments[2].nonConfigurable;
      if (typeof overrideIfSet < "u" && typeof overrideIfSet != "boolean" || typeof nonConfigurable < "u" && typeof nonConfigurable != "boolean")
        throw new $TypeError("if provided, the `overrideIfSet` and `nonConfigurable` options must be booleans");
      toStringTag && (overrideIfSet || !hasOwn(object, toStringTag)) && ($defineProperty ? $defineProperty(object, toStringTag, {
        configurable: !nonConfigurable,
        enumerable: !1,
        value,
        writable: !1
      }) : object[toStringTag] = value);
    };
  }
});

// node_modules/form-data/lib/populate.js
var require_populate = __commonJS({
  "node_modules/form-data/lib/populate.js"(exports2, module2) {
    "use strict";
    module2.exports = function(dst, src) {
      return Object.keys(src).forEach(function(prop) {
        dst[prop] = dst[prop] || src[prop];
      }), dst;
    };
  }
});

// node_modules/form-data/lib/form_data.js
var require_form_data = __commonJS({
  "node_modules/form-data/lib/form_data.js"(exports2, module2) {
    "use strict";
    var CombinedStream = require_combined_stream(), util = require("util"), path = require("path"), http = require("http"), https = require("https"), parseUrl = require("url").parse, fs2 = require("fs"), Stream = require("stream").Stream, crypto2 = require("crypto"), mime = require_mime_types(), asynckit = require_asynckit(), setToStringTag = require_es_set_tostringtag(), hasOwn = require_hasown(), populate = require_populate();
    function escapeHeaderParam(str) {
      return String(str).replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/"/g, "%22");
    }
    function FormData2(options) {
      if (!(this instanceof FormData2))
        return new FormData2(options);
      this._overheadLength = 0, this._valueLength = 0, this._valuesToMeasure = [], CombinedStream.call(this), options = options || {};
      for (var option in options)
        this[option] = options[option];
    }
    util.inherits(FormData2, CombinedStream);
    FormData2.LINE_BREAK = `\r
`;
    FormData2.DEFAULT_CONTENT_TYPE = "application/octet-stream";
    FormData2.prototype.append = function(field, value, options) {
      options = options || {}, typeof options == "string" && (options = { filename: options });
      var append = CombinedStream.prototype.append.bind(this);
      if ((typeof value == "number" || value == null) && (value = String(value)), Array.isArray(value)) {
        this._error(new Error("Arrays are not supported."));
        return;
      }
      var header = this._multiPartHeader(field, value, options), footer = this._multiPartFooter();
      append(header), append(value), append(footer), this._trackLength(header, value, options);
    };
    FormData2.prototype._trackLength = function(header, value, options) {
      var valueLength = 0;
      options.knownLength != null ? valueLength += Number(options.knownLength) : Buffer.isBuffer(value) ? valueLength = value.length : typeof value == "string" && (valueLength = Buffer.byteLength(value)), this._valueLength += valueLength, this._overheadLength += Buffer.byteLength(header) + FormData2.LINE_BREAK.length, !(!value || !value.path && !(value.readable && hasOwn(value, "httpVersion")) && !(value instanceof Stream)) && (options.knownLength || this._valuesToMeasure.push(value));
    };
    FormData2.prototype._lengthRetriever = function(value, callback) {
      hasOwn(value, "fd") ? value.end != null && value.end != 1 / 0 && value.start != null ? callback(null, value.end + 1 - (value.start ? value.start : 0)) : fs2.stat(value.path, function(err, stat) {
        if (err) {
          callback(err);
          return;
        }
        var fileSize = stat.size - (value.start ? value.start : 0);
        callback(null, fileSize);
      }) : hasOwn(value, "httpVersion") ? callback(null, Number(value.headers["content-length"])) : hasOwn(value, "httpModule") ? (value.on("response", function(response) {
        value.pause(), callback(null, Number(response.headers["content-length"]));
      }), value.resume()) : callback("Unknown stream");
    };
    FormData2.prototype._multiPartHeader = function(field, value, options) {
      if (typeof options.header == "string")
        return options.header;
      var contentDisposition = this._getContentDisposition(value, options), contentType = this._getContentType(value, options), contents = "", headers = {
        // add custom disposition as third element or keep it two elements if not
        "Content-Disposition": ["form-data", 'name="' + escapeHeaderParam(field) + '"'].concat(contentDisposition || []),
        // if no content type. allow it to be empty array
        "Content-Type": [].concat(contentType || [])
      };
      typeof options.header == "object" && populate(headers, options.header);
      var header;
      for (var prop in headers)
        if (hasOwn(headers, prop)) {
          if (header = headers[prop], header == null)
            continue;
          Array.isArray(header) || (header = [header]), header.length && (contents += prop + ": " + header.join("; ") + FormData2.LINE_BREAK);
        }
      return "--" + this.getBoundary() + FormData2.LINE_BREAK + contents + FormData2.LINE_BREAK;
    };
    FormData2.prototype._getContentDisposition = function(value, options) {
      var filename;
      if (typeof options.filepath == "string" ? filename = path.normalize(options.filepath).replace(/\\/g, "/") : options.filename || value && (value.name || value.path) ? filename = path.basename(options.filename || value && (value.name || value.path)) : value && value.readable && hasOwn(value, "httpVersion") && (filename = path.basename(value.client._httpMessage.path || "")), filename)
        return 'filename="' + escapeHeaderParam(filename) + '"';
    };
    FormData2.prototype._getContentType = function(value, options) {
      var contentType = options.contentType;
      return !contentType && value && value.name && (contentType = mime.lookup(value.name)), !contentType && value && value.path && (contentType = mime.lookup(value.path)), !contentType && value && value.readable && hasOwn(value, "httpVersion") && (contentType = value.headers["content-type"]), !contentType && (options.filepath || options.filename) && (contentType = mime.lookup(options.filepath || options.filename)), !contentType && value && typeof value == "object" && (contentType = FormData2.DEFAULT_CONTENT_TYPE), contentType;
    };
    FormData2.prototype._multiPartFooter = function() {
      return function(next) {
        var footer = FormData2.LINE_BREAK, lastPart = this._streams.length === 0;
        lastPart && (footer += this._lastBoundary()), next(footer);
      }.bind(this);
    };
    FormData2.prototype._lastBoundary = function() {
      return "--" + this.getBoundary() + "--" + FormData2.LINE_BREAK;
    };
    FormData2.prototype.getHeaders = function(userHeaders) {
      var header, formHeaders = {
        "content-type": "multipart/form-data; boundary=" + this.getBoundary()
      };
      for (header in userHeaders)
        hasOwn(userHeaders, header) && (formHeaders[header.toLowerCase()] = userHeaders[header]);
      return formHeaders;
    };
    FormData2.prototype.setBoundary = function(boundary) {
      if (typeof boundary != "string")
        throw new TypeError("FormData boundary must be a string");
      this._boundary = boundary;
    };
    FormData2.prototype.getBoundary = function() {
      return this._boundary || this._generateBoundary(), this._boundary;
    };
    FormData2.prototype.getBuffer = function() {
      for (var dataBuffer = new Buffer.alloc(0), boundary = this.getBoundary(), i = 0, len = this._streams.length; i < len; i++)
        typeof this._streams[i] != "function" && (Buffer.isBuffer(this._streams[i]) ? dataBuffer = Buffer.concat([dataBuffer, this._streams[i]]) : dataBuffer = Buffer.concat([dataBuffer, Buffer.from(this._streams[i])]), (typeof this._streams[i] != "string" || this._streams[i].substring(2, boundary.length + 2) !== boundary) && (dataBuffer = Buffer.concat([dataBuffer, Buffer.from(FormData2.LINE_BREAK)])));
      return Buffer.concat([dataBuffer, Buffer.from(this._lastBoundary())]);
    };
    FormData2.prototype._generateBoundary = function() {
      this._boundary = "--------------------------" + crypto2.randomBytes(12).toString("hex");
    };
    FormData2.prototype.getLengthSync = function() {
      var knownLength = this._overheadLength + this._valueLength;
      return this._streams.length && (knownLength += this._lastBoundary().length), this.hasKnownLength() || this._error(new Error("Cannot calculate proper length in synchronous way.")), knownLength;
    };
    FormData2.prototype.hasKnownLength = function() {
      var hasKnownLength = !0;
      return this._valuesToMeasure.length && (hasKnownLength = !1), hasKnownLength;
    };
    FormData2.prototype.getLength = function(cb) {
      var knownLength = this._overheadLength + this._valueLength;
      if (this._streams.length && (knownLength += this._lastBoundary().length), !this._valuesToMeasure.length) {
        process.nextTick(cb.bind(this, null, knownLength));
        return;
      }
      asynckit.parallel(this._valuesToMeasure, this._lengthRetriever, function(err, values) {
        if (err) {
          cb(err);
          return;
        }
        values.forEach(function(length) {
          knownLength += length;
        }), cb(null, knownLength);
      });
    };
    FormData2.prototype.submit = function(params, cb) {
      var request, options, defaults = { method: "post" };
      return typeof params == "string" ? (params = parseUrl(params), options = populate({
        port: params.port,
        path: params.pathname,
        host: params.hostname,
        protocol: params.protocol
      }, defaults)) : (options = populate(params, defaults), options.port || (options.port = options.protocol === "https:" ? 443 : 80)), options.headers = this.getHeaders(params.headers), options.protocol === "https:" ? request = https.request(options) : request = http.request(options), this.getLength(function(err, length) {
        if (err && err !== "Unknown stream") {
          this._error(err);
          return;
        }
        if (length && request.setHeader("Content-Length", length), this.pipe(request), cb) {
          var onResponse, callback = function(error, responce) {
            return request.removeListener("error", callback), request.removeListener("response", onResponse), cb.call(this, error, responce);
          };
          onResponse = callback.bind(this, null), request.on("error", callback), request.on("response", onResponse);
        }
      }.bind(this)), request;
    };
    FormData2.prototype._error = function(err) {
      this.error || (this.error = err, this.pause(), this.emit("error", err));
    };
    FormData2.prototype.toString = function() {
      return "[object FormData]";
    };
    setToStringTag(FormData2.prototype, "FormData");
    module2.exports = FormData2;
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports2, module2) {
    var s = 1e3, m = s * 60, h = m * 60, d = h * 24, w = d * 7, y = d * 365.25;
    module2.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0)
        return parse(val);
      if (type === "number" && isFinite(val))
        return options.long ? fmtLong(val) : fmtShort(val);
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse(str) {
      if (str = String(str), !(str.length > 100)) {
        var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
          str
        );
        if (match) {
          var n = parseFloat(match[1]), type = (match[2] || "ms").toLowerCase();
          switch (type) {
            case "years":
            case "year":
            case "yrs":
            case "yr":
            case "y":
              return n * y;
            case "weeks":
            case "week":
            case "w":
              return n * w;
            case "days":
            case "day":
            case "d":
              return n * d;
            case "hours":
            case "hour":
            case "hrs":
            case "hr":
            case "h":
              return n * h;
            case "minutes":
            case "minute":
            case "mins":
            case "min":
            case "m":
              return n * m;
            case "seconds":
            case "second":
            case "secs":
            case "sec":
            case "s":
              return n * s;
            case "milliseconds":
            case "millisecond":
            case "msecs":
            case "msec":
            case "ms":
              return n;
            default:
              return;
          }
        }
      }
    }
    function fmtShort(ms) {
      var msAbs = Math.abs(ms);
      return msAbs >= d ? Math.round(ms / d) + "d" : msAbs >= h ? Math.round(ms / h) + "h" : msAbs >= m ? Math.round(ms / m) + "m" : msAbs >= s ? Math.round(ms / s) + "s" : ms + "ms";
    }
    function fmtLong(ms) {
      var msAbs = Math.abs(ms);
      return msAbs >= d ? plural(ms, msAbs, d, "day") : msAbs >= h ? plural(ms, msAbs, h, "hour") : msAbs >= m ? plural(ms, msAbs, m, "minute") : msAbs >= s ? plural(ms, msAbs, s, "second") : ms + " ms";
    }
    function plural(ms, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
    }
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports2, module2) {
    function setup(env) {
      createDebug.debug = createDebug, createDebug.default = createDebug, createDebug.coerce = coerce, createDebug.disable = disable, createDebug.enable = enable, createDebug.enabled = enabled, createDebug.humanize = require_ms(), createDebug.destroy = destroy, Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      }), createDebug.names = [], createDebug.skips = [], createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++)
          hash = (hash << 5) - hash + namespace.charCodeAt(i), hash |= 0;
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime, enableOverride = null, namespacesCache, enabledCache;
        function debug(...args) {
          if (!debug.enabled)
            return;
          let self2 = debug, curr = Number(/* @__PURE__ */ new Date()), ms = curr - (prevTime || curr);
          self2.diff = ms, self2.prev = prevTime, self2.curr = curr, prevTime = curr, args[0] = createDebug.coerce(args[0]), typeof args[0] != "string" && args.unshift("%O");
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
            if (match === "%%")
              return "%";
            index++;
            let formatter = createDebug.formatters[format];
            if (typeof formatter == "function") {
              let val = args[index];
              match = formatter.call(self2, val), args.splice(index, 1), index--;
            }
            return match;
          }), createDebug.formatArgs.call(self2, args), (self2.log || createDebug.log).apply(self2, args);
        }
        return debug.namespace = namespace, debug.useColors = createDebug.useColors(), debug.color = createDebug.selectColor(namespace), debug.extend = extend, debug.destroy = createDebug.destroy, Object.defineProperty(debug, "enabled", {
          enumerable: !0,
          configurable: !1,
          get: () => enableOverride !== null ? enableOverride : (namespacesCache !== createDebug.namespaces && (namespacesCache = createDebug.namespaces, enabledCache = createDebug.enabled(namespace)), enabledCache),
          set: (v) => {
            enableOverride = v;
          }
        }), typeof createDebug.init == "function" && createDebug.init(debug), debug;
      }
      function extend(namespace, delimiter) {
        let newDebug = createDebug(this.namespace + (typeof delimiter > "u" ? ":" : delimiter) + namespace);
        return newDebug.log = this.log, newDebug;
      }
      function enable(namespaces) {
        createDebug.save(namespaces), createDebug.namespaces = namespaces, createDebug.names = [], createDebug.skips = [];
        let split = (typeof namespaces == "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (let ns of split)
          ns[0] === "-" ? createDebug.skips.push(ns.slice(1)) : createDebug.names.push(ns);
      }
      function matchesTemplate(search, template) {
        let searchIndex = 0, templateIndex = 0, starIndex = -1, matchIndex = 0;
        for (; searchIndex < search.length; )
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*"))
            template[templateIndex] === "*" ? (starIndex = templateIndex, matchIndex = searchIndex, templateIndex++) : (searchIndex++, templateIndex++);
          else if (starIndex !== -1)
            templateIndex = starIndex + 1, matchIndex++, searchIndex = matchIndex;
          else
            return !1;
        for (; templateIndex < template.length && template[templateIndex] === "*"; )
          templateIndex++;
        return templateIndex === template.length;
      }
      function disable() {
        let namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        return createDebug.enable(""), namespaces;
      }
      function enabled(name) {
        for (let skip of createDebug.skips)
          if (matchesTemplate(name, skip))
            return !1;
        for (let ns of createDebug.names)
          if (matchesTemplate(name, ns))
            return !0;
        return !1;
      }
      function coerce(val) {
        return val instanceof Error ? val.stack || val.message : val;
      }
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      return createDebug.enable(createDebug.load()), createDebug;
    }
    module2.exports = setup;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports2, module2) {
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.storage = localstorage();
    exports2.destroy = /* @__PURE__ */ (() => {
      let warned = !1;
      return () => {
        warned || (warned = !0, console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."));
      };
    })();
    exports2.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window < "u" && window.process && (window.process.type === "renderer" || window.process.__nwjs))
        return !0;
      if (typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/))
        return !1;
      let m;
      return typeof document < "u" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window < "u" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator < "u" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator < "u" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
    }
    function formatArgs(args) {
      if (args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module2.exports.humanize(this.diff), !this.useColors)
        return;
      let c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0, lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match) => {
        match !== "%%" && (index++, match === "%c" && (lastC = index));
      }), args.splice(lastC, 0, c);
    }
    exports2.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        namespaces ? exports2.storage.setItem("debug", namespaces) : exports2.storage.removeItem("debug");
      } catch {
      }
    }
    function load() {
      let r;
      try {
        r = exports2.storage.getItem("debug") || exports2.storage.getItem("DEBUG");
      } catch {
      }
      return !r && typeof process < "u" && "env" in process && (r = process.env.DEBUG), r;
    }
    function localstorage() {
      try {
        return localStorage;
      } catch {
      }
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/debug/src/node.js
var require_node = __commonJS({
  "node_modules/debug/src/node.js"(exports2, module2) {
    var tty = require("tty"), util = require("util");
    exports2.init = init;
    exports2.log = log;
    exports2.formatArgs = formatArgs;
    exports2.save = save;
    exports2.load = load;
    exports2.useColors = useColors;
    exports2.destroy = util.deprecate(
      () => {
      },
      "Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`."
    );
    exports2.colors = [6, 2, 3, 4, 5, 1];
    try {
      let supportsColor = require("supports-color");
      supportsColor && (supportsColor.stderr || supportsColor).level >= 2 && (exports2.colors = [
        20,
        21,
        26,
        27,
        32,
        33,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        56,
        57,
        62,
        63,
        68,
        69,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        92,
        93,
        98,
        99,
        112,
        113,
        128,
        129,
        134,
        135,
        148,
        149,
        160,
        161,
        162,
        163,
        164,
        165,
        166,
        167,
        168,
        169,
        170,
        171,
        172,
        173,
        178,
        179,
        184,
        185,
        196,
        197,
        198,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        214,
        215,
        220,
        221
      ]);
    } catch {
    }
    exports2.inspectOpts = Object.keys(process.env).filter((key) => /^debug_/i.test(key)).reduce((obj, key) => {
      let prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k) => k.toUpperCase()), val = process.env[key];
      return /^(yes|on|true|enabled)$/i.test(val) ? val = !0 : /^(no|off|false|disabled)$/i.test(val) ? val = !1 : val === "null" ? val = null : val = Number(val), obj[prop] = val, obj;
    }, {});
    function useColors() {
      return "colors" in exports2.inspectOpts ? !!exports2.inspectOpts.colors : tty.isatty(process.stderr.fd);
    }
    function formatArgs(args) {
      let { namespace: name, useColors: useColors2 } = this;
      if (useColors2) {
        let c = this.color, colorCode = "\x1B[3" + (c < 8 ? c : "8;5;" + c), prefix = `  ${colorCode};1m${name} \x1B[0m`;
        args[0] = prefix + args[0].split(`
`).join(`
` + prefix), args.push(colorCode + "m+" + module2.exports.humanize(this.diff) + "\x1B[0m");
      } else
        args[0] = getDate() + name + " " + args[0];
    }
    function getDate() {
      return exports2.inspectOpts.hideDate ? "" : (/* @__PURE__ */ new Date()).toISOString() + " ";
    }
    function log(...args) {
      return process.stderr.write(util.formatWithOptions(exports2.inspectOpts, ...args) + `
`);
    }
    function save(namespaces) {
      namespaces ? process.env.DEBUG = namespaces : delete process.env.DEBUG;
    }
    function load() {
      return process.env.DEBUG;
    }
    function init(debug) {
      debug.inspectOpts = {};
      let keys = Object.keys(exports2.inspectOpts);
      for (let i = 0; i < keys.length; i++)
        debug.inspectOpts[keys[i]] = exports2.inspectOpts[keys[i]];
    }
    module2.exports = require_common()(exports2);
    var { formatters } = module2.exports;
    formatters.o = function(v) {
      return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts).split(`
`).map((str) => str.trim()).join(" ");
    };
    formatters.O = function(v) {
      return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts);
    };
  }
});

// node_modules/debug/src/index.js
var require_src = __commonJS({
  "node_modules/debug/src/index.js"(exports2, module2) {
    typeof process > "u" || process.type === "renderer" || process.browser === !0 || process.__nwjs ? module2.exports = require_browser() : module2.exports = require_node();
  }
});

// node_modules/agent-base/dist/src/promisify.js
var require_promisify = __commonJS({
  "node_modules/agent-base/dist/src/promisify.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    function promisify(fn) {
      return function(req, opts) {
        return new Promise((resolve, reject) => {
          fn.call(this, req, opts, (err, rtn) => {
            err ? reject(err) : resolve(rtn);
          });
        });
      };
    }
    exports2.default = promisify;
  }
});

// node_modules/agent-base/dist/src/index.js
var require_src2 = __commonJS({
  "node_modules/agent-base/dist/src/index.js"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { default: mod };
    }, events_1 = require("events"), debug_1 = __importDefault(require_src()), promisify_1 = __importDefault(require_promisify()), debug = debug_1.default("agent-base");
    function isAgent(v) {
      return !!v && typeof v.addRequest == "function";
    }
    function isSecureEndpoint() {
      let { stack } = new Error();
      return typeof stack != "string" ? !1 : stack.split(`
`).some((l) => l.indexOf("(https.js:") !== -1 || l.indexOf("node:https:") !== -1);
    }
    function createAgent(callback, opts) {
      return new createAgent.Agent(callback, opts);
    }
    (function(createAgent2) {
      class Agent extends events_1.EventEmitter {
        constructor(callback, _opts) {
          super();
          let opts = _opts;
          typeof callback == "function" ? this.callback = callback : callback && (opts = callback), this.timeout = null, opts && typeof opts.timeout == "number" && (this.timeout = opts.timeout), this.maxFreeSockets = 1, this.maxSockets = 1, this.maxTotalSockets = 1 / 0, this.sockets = {}, this.freeSockets = {}, this.requests = {}, this.options = {};
        }
        get defaultPort() {
          return typeof this.explicitDefaultPort == "number" ? this.explicitDefaultPort : isSecureEndpoint() ? 443 : 80;
        }
        set defaultPort(v) {
          this.explicitDefaultPort = v;
        }
        get protocol() {
          return typeof this.explicitProtocol == "string" ? this.explicitProtocol : isSecureEndpoint() ? "https:" : "http:";
        }
        set protocol(v) {
          this.explicitProtocol = v;
        }
        callback(req, opts, fn) {
          throw new Error('"agent-base" has no default implementation, you must subclass and override `callback()`');
        }
        /**
         * Called by node-core's "_http_client.js" module when creating
         * a new HTTP request with this Agent instance.
         *
         * @api public
         */
        addRequest(req, _opts) {
          let opts = Object.assign({}, _opts);
          typeof opts.secureEndpoint != "boolean" && (opts.secureEndpoint = isSecureEndpoint()), opts.host == null && (opts.host = "localhost"), opts.port == null && (opts.port = opts.secureEndpoint ? 443 : 80), opts.protocol == null && (opts.protocol = opts.secureEndpoint ? "https:" : "http:"), opts.host && opts.path && delete opts.path, delete opts.agent, delete opts.hostname, delete opts._defaultAgent, delete opts.defaultPort, delete opts.createConnection, req._last = !0, req.shouldKeepAlive = !1;
          let timedOut = !1, timeoutId = null, timeoutMs = opts.timeout || this.timeout, onerror = (err) => {
            req._hadError || (req.emit("error", err), req._hadError = !0);
          }, ontimeout = () => {
            timeoutId = null, timedOut = !0;
            let err = new Error(`A "socket" was not created for HTTP request before ${timeoutMs}ms`);
            err.code = "ETIMEOUT", onerror(err);
          }, callbackError = (err) => {
            timedOut || (timeoutId !== null && (clearTimeout(timeoutId), timeoutId = null), onerror(err));
          }, onsocket = (socket) => {
            if (timedOut)
              return;
            if (timeoutId != null && (clearTimeout(timeoutId), timeoutId = null), isAgent(socket)) {
              debug("Callback returned another Agent instance %o", socket.constructor.name), socket.addRequest(req, opts);
              return;
            }
            if (socket) {
              socket.once("free", () => {
                this.freeSocket(socket, opts);
              }), req.onSocket(socket);
              return;
            }
            let err = new Error(`no Duplex stream was returned to agent-base for \`${req.method} ${req.path}\``);
            onerror(err);
          };
          if (typeof this.callback != "function") {
            onerror(new Error("`callback` is not defined"));
            return;
          }
          this.promisifiedCallback || (this.callback.length >= 3 ? (debug("Converting legacy callback function to promise"), this.promisifiedCallback = promisify_1.default(this.callback)) : this.promisifiedCallback = this.callback), typeof timeoutMs == "number" && timeoutMs > 0 && (timeoutId = setTimeout(ontimeout, timeoutMs)), "port" in opts && typeof opts.port != "number" && (opts.port = Number(opts.port));
          try {
            debug("Resolving socket for %o request: %o", opts.protocol, `${req.method} ${req.path}`), Promise.resolve(this.promisifiedCallback(req, opts)).then(onsocket, callbackError);
          } catch (err) {
            Promise.reject(err).catch(callbackError);
          }
        }
        freeSocket(socket, opts) {
          debug("Freeing socket %o %o", socket.constructor.name, opts), socket.destroy();
        }
        destroy() {
          debug("Destroying agent %o", this.constructor.name);
        }
      }
      createAgent2.Agent = Agent, createAgent2.prototype = createAgent2.Agent.prototype;
    })(createAgent || (createAgent = {}));
    module2.exports = createAgent;
  }
});

// node_modules/https-proxy-agent/dist/parse-proxy-response.js
var require_parse_proxy_response = __commonJS({
  "node_modules/https-proxy-agent/dist/parse-proxy-response.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { default: mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    var debug_1 = __importDefault(require_src()), debug = debug_1.default("https-proxy-agent:parse-proxy-response");
    function parseProxyResponse(socket) {
      return new Promise((resolve, reject) => {
        let buffersLength = 0, buffers = [];
        function read() {
          let b = socket.read();
          b ? ondata(b) : socket.once("readable", read);
        }
        function cleanup() {
          socket.removeListener("end", onend), socket.removeListener("error", onerror), socket.removeListener("close", onclose), socket.removeListener("readable", read);
        }
        function onclose(err) {
          debug("onclose had error %o", err);
        }
        function onend() {
          debug("onend");
        }
        function onerror(err) {
          cleanup(), debug("onerror %o", err), reject(err);
        }
        function ondata(b) {
          buffers.push(b), buffersLength += b.length;
          let buffered = Buffer.concat(buffers, buffersLength);
          if (buffered.indexOf(`\r
\r
`) === -1) {
            debug("have not received end of HTTP headers yet..."), read();
            return;
          }
          let firstLine = buffered.toString("ascii", 0, buffered.indexOf(`\r
`)), statusCode = +firstLine.split(" ")[1];
          debug("got proxy server response: %o", firstLine), resolve({
            statusCode,
            buffered
          });
        }
        socket.on("error", onerror), socket.on("close", onclose), socket.on("end", onend), read();
      });
    }
    exports2.default = parseProxyResponse;
  }
});

// node_modules/https-proxy-agent/dist/agent.js
var require_agent = __commonJS({
  "node_modules/https-proxy-agent/dist/agent.js"(exports2) {
    "use strict";
    var __awaiter = exports2 && exports2.__awaiter || function(thisArg, _arguments, P, generator) {
      function adopt(value) {
        return value instanceof P ? value : new P(function(resolve) {
          resolve(value);
        });
      }
      return new (P || (P = Promise))(function(resolve, reject) {
        function fulfilled(value) {
          try {
            step(generator.next(value));
          } catch (e) {
            reject(e);
          }
        }
        function rejected(value) {
          try {
            step(generator.throw(value));
          } catch (e) {
            reject(e);
          }
        }
        function step(result) {
          result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
        }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
    }, __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { default: mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    var net_1 = __importDefault(require("net")), tls_1 = __importDefault(require("tls")), url_1 = __importDefault(require("url")), assert_1 = __importDefault(require("assert")), debug_1 = __importDefault(require_src()), agent_base_1 = require_src2(), parse_proxy_response_1 = __importDefault(require_parse_proxy_response()), debug = debug_1.default("https-proxy-agent:agent"), HttpsProxyAgent = class extends agent_base_1.Agent {
      constructor(_opts) {
        let opts;
        if (typeof _opts == "string" ? opts = url_1.default.parse(_opts) : opts = _opts, !opts)
          throw new Error("an HTTP(S) proxy server `host` and `port` must be specified!");
        debug("creating new HttpsProxyAgent instance: %o", opts), super(opts);
        let proxy = Object.assign({}, opts);
        this.secureProxy = opts.secureProxy || isHTTPS(proxy.protocol), proxy.host = proxy.hostname || proxy.host, typeof proxy.port == "string" && (proxy.port = parseInt(proxy.port, 10)), !proxy.port && proxy.host && (proxy.port = this.secureProxy ? 443 : 80), this.secureProxy && !("ALPNProtocols" in proxy) && (proxy.ALPNProtocols = ["http 1.1"]), proxy.host && proxy.path && (delete proxy.path, delete proxy.pathname), this.proxy = proxy;
      }
      /**
       * Called when the node-core HTTP client library is creating a
       * new HTTP request.
       *
       * @api protected
       */
      callback(req, opts) {
        return __awaiter(this, void 0, void 0, function* () {
          let { proxy, secureProxy } = this, socket;
          secureProxy ? (debug("Creating `tls.Socket`: %o", proxy), socket = tls_1.default.connect(proxy)) : (debug("Creating `net.Socket`: %o", proxy), socket = net_1.default.connect(proxy));
          let headers = Object.assign({}, proxy.headers), payload = `CONNECT ${`${opts.host}:${opts.port}`} HTTP/1.1\r
`;
          proxy.auth && (headers["Proxy-Authorization"] = `Basic ${Buffer.from(proxy.auth).toString("base64")}`);
          let { host, port, secureEndpoint } = opts;
          isDefaultPort(port, secureEndpoint) || (host += `:${port}`), headers.Host = host, headers.Connection = "close";
          for (let name of Object.keys(headers))
            payload += `${name}: ${headers[name]}\r
`;
          let proxyResponsePromise = parse_proxy_response_1.default(socket);
          socket.write(`${payload}\r
`);
          let { statusCode, buffered } = yield proxyResponsePromise;
          if (statusCode === 200) {
            if (req.once("socket", resume), opts.secureEndpoint) {
              debug("Upgrading socket connection to TLS");
              let servername = opts.servername || opts.host;
              return tls_1.default.connect(Object.assign(Object.assign({}, omit(opts, "host", "hostname", "path", "port")), {
                socket,
                servername
              }));
            }
            return socket;
          }
          socket.destroy();
          let fakeSocket = new net_1.default.Socket({ writable: !1 });
          return fakeSocket.readable = !0, req.once("socket", (s) => {
            debug("replaying proxy buffer for failed request"), assert_1.default(s.listenerCount("data") > 0), s.push(buffered), s.push(null);
          }), fakeSocket;
        });
      }
    };
    exports2.default = HttpsProxyAgent;
    function resume(socket) {
      socket.resume();
    }
    function isDefaultPort(port, secure) {
      return !!(!secure && port === 80 || secure && port === 443);
    }
    function isHTTPS(protocol) {
      return typeof protocol == "string" ? /^https:?$/i.test(protocol) : !1;
    }
    function omit(obj, ...keys) {
      let ret = {}, key;
      for (key in obj)
        keys.includes(key) || (ret[key] = obj[key]);
      return ret;
    }
  }
});

// node_modules/https-proxy-agent/dist/index.js
var require_dist = __commonJS({
  "node_modules/https-proxy-agent/dist/index.js"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { default: mod };
    }, agent_1 = __importDefault(require_agent());
    function createHttpsProxyAgent(opts) {
      return new agent_1.default(opts);
    }
    (function(createHttpsProxyAgent2) {
      createHttpsProxyAgent2.HttpsProxyAgent = agent_1.default, createHttpsProxyAgent2.prototype = agent_1.default.prototype;
    })(createHttpsProxyAgent || (createHttpsProxyAgent = {}));
    module2.exports = createHttpsProxyAgent;
  }
});

// node_modules/follow-redirects/debug.js
var require_debug = __commonJS({
  "node_modules/follow-redirects/debug.js"(exports2, module2) {
    var debug;
    module2.exports = function() {
      if (!debug) {
        try {
          debug = require_src()("follow-redirects");
        } catch {
        }
        typeof debug != "function" && (debug = function() {
        });
      }
      debug.apply(null, arguments);
    };
  }
});

// node_modules/follow-redirects/index.js
var require_follow_redirects = __commonJS({
  "node_modules/follow-redirects/index.js"(exports2, module2) {
    var url = require("url"), URL2 = url.URL, http = require("http"), https = require("https"), Writable = require("stream").Writable, assert = require("assert"), debug = require_debug();
    (function() {
      var looksLikeNode = typeof process < "u", looksLikeBrowser = typeof window < "u" && typeof document < "u", looksLikeV8 = isFunction(Error.captureStackTrace);
      !looksLikeNode && (looksLikeBrowser || !looksLikeV8) && console.warn("The follow-redirects package should be excluded from browser builds.");
    })();
    var useNativeURL = !1;
    try {
      assert(new URL2(""));
    } catch (error) {
      useNativeURL = error.code === "ERR_INVALID_URL";
    }
    var sensitiveHeaders = [
      "Authorization",
      "Proxy-Authorization",
      "Cookie"
    ], preservedUrlFields = [
      "auth",
      "host",
      "hostname",
      "href",
      "path",
      "pathname",
      "port",
      "protocol",
      "query",
      "search",
      "hash"
    ], events = ["abort", "aborted", "connect", "error", "socket", "timeout"], eventHandlers = /* @__PURE__ */ Object.create(null);
    events.forEach(function(event) {
      eventHandlers[event] = function(arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
      };
    });
    var InvalidUrlError = createErrorType(
      "ERR_INVALID_URL",
      "Invalid URL",
      TypeError
    ), RedirectionError = createErrorType(
      "ERR_FR_REDIRECTION_FAILURE",
      "Redirected request failed"
    ), TooManyRedirectsError = createErrorType(
      "ERR_FR_TOO_MANY_REDIRECTS",
      "Maximum number of redirects exceeded",
      RedirectionError
    ), MaxBodyLengthExceededError = createErrorType(
      "ERR_FR_MAX_BODY_LENGTH_EXCEEDED",
      "Request body larger than maxBodyLength limit"
    ), WriteAfterEndError = createErrorType(
      "ERR_STREAM_WRITE_AFTER_END",
      "write after end"
    ), destroy = Writable.prototype.destroy || noop;
    function RedirectableRequest(options, responseCallback) {
      Writable.call(this), this._sanitizeOptions(options), this._options = options, this._ended = !1, this._ending = !1, this._redirectCount = 0, this._redirects = [], this._requestBodyLength = 0, this._requestBodyBuffers = [], responseCallback && this.on("response", responseCallback);
      var self2 = this;
      this._onNativeResponse = function(response) {
        try {
          self2._processResponse(response);
        } catch (cause) {
          self2.emit("error", cause instanceof RedirectionError ? cause : new RedirectionError({ cause }));
        }
      }, this._headerFilter = new RegExp("^(?:" + sensitiveHeaders.concat(options.sensitiveHeaders).map(escapeRegex).join("|") + ")$", "i"), this._performRequest();
    }
    RedirectableRequest.prototype = Object.create(Writable.prototype);
    RedirectableRequest.prototype.abort = function() {
      destroyRequest(this._currentRequest), this._currentRequest.abort(), this.emit("abort");
    };
    RedirectableRequest.prototype.destroy = function(error) {
      return destroyRequest(this._currentRequest, error), destroy.call(this, error), this;
    };
    RedirectableRequest.prototype.write = function(data, encoding, callback) {
      if (this._ending)
        throw new WriteAfterEndError();
      if (!isString(data) && !isBuffer(data))
        throw new TypeError("data should be a string, Buffer or Uint8Array");
      if (isFunction(encoding) && (callback = encoding, encoding = null), data.length === 0) {
        callback && callback();
        return;
      }
      this._requestBodyLength + data.length <= this._options.maxBodyLength ? (this._requestBodyLength += data.length, this._requestBodyBuffers.push({ data, encoding }), this._currentRequest.write(data, encoding, callback)) : (this.emit("error", new MaxBodyLengthExceededError()), this.abort());
    };
    RedirectableRequest.prototype.end = function(data, encoding, callback) {
      if (isFunction(data) ? (callback = data, data = encoding = null) : isFunction(encoding) && (callback = encoding, encoding = null), !data)
        this._ended = this._ending = !0, this._currentRequest.end(null, null, callback);
      else {
        var self2 = this, currentRequest = this._currentRequest;
        this.write(data, encoding, function() {
          self2._ended = !0, currentRequest.end(null, null, callback);
        }), this._ending = !0;
      }
    };
    RedirectableRequest.prototype.setHeader = function(name, value) {
      this._options.headers[name] = value, this._currentRequest.setHeader(name, value);
    };
    RedirectableRequest.prototype.removeHeader = function(name) {
      delete this._options.headers[name], this._currentRequest.removeHeader(name);
    };
    RedirectableRequest.prototype.setTimeout = function(msecs, callback) {
      var self2 = this;
      function destroyOnTimeout(socket) {
        socket.setTimeout(msecs), socket.removeListener("timeout", socket.destroy), socket.addListener("timeout", socket.destroy);
      }
      function startTimer(socket) {
        self2._timeout && clearTimeout(self2._timeout), self2._timeout = setTimeout(function() {
          self2.emit("timeout"), clearTimer();
        }, msecs), destroyOnTimeout(socket);
      }
      function clearTimer() {
        self2._timeout && (clearTimeout(self2._timeout), self2._timeout = null), self2.removeListener("abort", clearTimer), self2.removeListener("error", clearTimer), self2.removeListener("response", clearTimer), self2.removeListener("close", clearTimer), callback && self2.removeListener("timeout", callback), self2.socket || self2._currentRequest.removeListener("socket", startTimer);
      }
      return callback && this.on("timeout", callback), this.socket ? startTimer(this.socket) : this._currentRequest.once("socket", startTimer), this.on("socket", destroyOnTimeout), this.on("abort", clearTimer), this.on("error", clearTimer), this.on("response", clearTimer), this.on("close", clearTimer), this;
    };
    [
      "flushHeaders",
      "getHeader",
      "setNoDelay",
      "setSocketKeepAlive"
    ].forEach(function(method) {
      RedirectableRequest.prototype[method] = function(a, b) {
        return this._currentRequest[method](a, b);
      };
    });
    ["aborted", "connection", "socket"].forEach(function(property) {
      Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function() {
          return this._currentRequest[property];
        }
      });
    });
    RedirectableRequest.prototype._sanitizeOptions = function(options) {
      if (options.headers || (options.headers = {}), isArray(options.sensitiveHeaders) || (options.sensitiveHeaders = []), options.host && (options.hostname || (options.hostname = options.host), delete options.host), !options.pathname && options.path) {
        var searchPos = options.path.indexOf("?");
        searchPos < 0 ? options.pathname = options.path : (options.pathname = options.path.substring(0, searchPos), options.search = options.path.substring(searchPos));
      }
    };
    RedirectableRequest.prototype._performRequest = function() {
      var protocol = this._options.protocol, nativeProtocol = this._options.nativeProtocols[protocol];
      if (!nativeProtocol)
        throw new TypeError("Unsupported protocol " + protocol);
      if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
      }
      var request = this._currentRequest = nativeProtocol.request(this._options, this._onNativeResponse);
      request._redirectable = this;
      for (var event of events)
        request.on(event, eventHandlers[event]);
      if (this._currentUrl = /^\//.test(this._options.path) ? url.format(this._options) : (
        // When making a request to a proxy, […]
        // a client MUST send the target URI in absolute-form […].
        this._options.path
      ), this._isRedirect) {
        var i = 0, self2 = this, buffers = this._requestBodyBuffers;
        (function writeNext(error) {
          if (request === self2._currentRequest)
            if (error)
              self2.emit("error", error);
            else if (i < buffers.length) {
              var buffer = buffers[i++];
              request.finished || request.write(buffer.data, buffer.encoding, writeNext);
            } else self2._ended && request.end();
        })();
      }
    };
    RedirectableRequest.prototype._processResponse = function(response) {
      var statusCode = response.statusCode;
      this._options.trackRedirects && this._redirects.push({
        url: this._currentUrl,
        headers: response.headers,
        statusCode
      });
      var location = response.headers.location;
      if (!location || this._options.followRedirects === !1 || statusCode < 300 || statusCode >= 400) {
        response.responseUrl = this._currentUrl, response.redirects = this._redirects, this.emit("response", response), this._requestBodyBuffers = [];
        return;
      }
      if (destroyRequest(this._currentRequest), response.destroy(), ++this._redirectCount > this._options.maxRedirects)
        throw new TooManyRedirectsError();
      var requestHeaders, beforeRedirect = this._options.beforeRedirect;
      beforeRedirect && (requestHeaders = Object.assign({
        // The Host header was set by nativeProtocol.request
        Host: response.req.getHeader("host")
      }, this._options.headers));
      var method = this._options.method;
      ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" || // RFC7231§6.4.4: The 303 (See Other) status code indicates that
      // the server is redirecting the user agent to a different resource […]
      // A user agent can perform a retrieval request targeting that URI
      // (a GET or HEAD request if using HTTP) […]
      statusCode === 303 && !/^(?:GET|HEAD)$/.test(this._options.method)) && (this._options.method = "GET", this._requestBodyBuffers = [], removeMatchingHeaders(/^content-/i, this._options.headers));
      var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers), currentUrlParts = parseUrl(this._currentUrl), currentHost = currentHostHeader || currentUrlParts.host, currentUrl = /^\w+:/.test(location) ? this._currentUrl : url.format(Object.assign(currentUrlParts, { host: currentHost })), redirectUrl = resolveUrl(location, currentUrl);
      if (debug("redirecting to", redirectUrl.href), this._isRedirect = !0, spreadUrlObject(redirectUrl, this._options), (redirectUrl.protocol !== currentUrlParts.protocol && redirectUrl.protocol !== "https:" || redirectUrl.host !== currentHost && !isSubdomain(redirectUrl.host, currentHost)) && removeMatchingHeaders(this._headerFilter, this._options.headers), isFunction(beforeRedirect)) {
        var responseDetails = {
          headers: response.headers,
          statusCode
        }, requestDetails = {
          url: currentUrl,
          method,
          headers: requestHeaders
        };
        beforeRedirect(this._options, responseDetails, requestDetails), this._sanitizeOptions(this._options);
      }
      this._performRequest();
    };
    function wrap(protocols) {
      var exports3 = {
        maxRedirects: 21,
        maxBodyLength: 10485760
      }, nativeProtocols = {};
      return Object.keys(protocols).forEach(function(scheme) {
        var protocol = scheme + ":", nativeProtocol = nativeProtocols[protocol] = protocols[scheme], wrappedProtocol = exports3[scheme] = Object.create(nativeProtocol);
        function request(input, options, callback) {
          return isURL(input) ? input = spreadUrlObject(input) : isString(input) ? input = spreadUrlObject(parseUrl(input)) : (callback = options, options = validateUrl(input), input = { protocol }), isFunction(options) && (callback = options, options = null), options = Object.assign({
            maxRedirects: exports3.maxRedirects,
            maxBodyLength: exports3.maxBodyLength
          }, input, options), options.nativeProtocols = nativeProtocols, !isString(options.host) && !isString(options.hostname) && (options.hostname = "::1"), assert.equal(options.protocol, protocol, "protocol mismatch"), debug("options", options), new RedirectableRequest(options, callback);
        }
        function get(input, options, callback) {
          var wrappedRequest = wrappedProtocol.request(input, options, callback);
          return wrappedRequest.end(), wrappedRequest;
        }
        Object.defineProperties(wrappedProtocol, {
          request: { value: request, configurable: !0, enumerable: !0, writable: !0 },
          get: { value: get, configurable: !0, enumerable: !0, writable: !0 }
        });
      }), exports3;
    }
    function noop() {
    }
    function parseUrl(input) {
      var parsed;
      if (useNativeURL)
        parsed = new URL2(input);
      else if (parsed = validateUrl(url.parse(input)), !isString(parsed.protocol))
        throw new InvalidUrlError({ input });
      return parsed;
    }
    function resolveUrl(relative, base) {
      return useNativeURL ? new URL2(relative, base) : parseUrl(url.resolve(base, relative));
    }
    function validateUrl(input) {
      if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname))
        throw new InvalidUrlError({ input: input.href || input });
      if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host))
        throw new InvalidUrlError({ input: input.href || input });
      return input;
    }
    function spreadUrlObject(urlObject, target) {
      var spread = target || {};
      for (var key of preservedUrlFields)
        spread[key] = urlObject[key];
      return spread.hostname.startsWith("[") && (spread.hostname = spread.hostname.slice(1, -1)), spread.port !== "" && (spread.port = Number(spread.port)), spread.path = spread.search ? spread.pathname + spread.search : spread.pathname, spread;
    }
    function removeMatchingHeaders(regex, headers) {
      var lastValue;
      for (var header in headers)
        regex.test(header) && (lastValue = headers[header], delete headers[header]);
      return lastValue === null || typeof lastValue > "u" ? void 0 : String(lastValue).trim();
    }
    function createErrorType(code, message, baseClass) {
      function CustomError(properties) {
        isFunction(Error.captureStackTrace) && Error.captureStackTrace(this, this.constructor), Object.assign(this, properties || {}), this.code = code, this.message = this.cause ? message + ": " + this.cause.message : message;
      }
      return CustomError.prototype = new (baseClass || Error)(), Object.defineProperties(CustomError.prototype, {
        constructor: {
          value: CustomError,
          enumerable: !1
        },
        name: {
          value: "Error [" + code + "]",
          enumerable: !1
        }
      }), CustomError;
    }
    function destroyRequest(request, error) {
      for (var event of events)
        request.removeListener(event, eventHandlers[event]);
      request.on("error", noop), request.destroy(error);
    }
    function isSubdomain(subdomain, domain) {
      assert(isString(subdomain) && isString(domain));
      var dot = subdomain.length - domain.length - 1;
      return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
    }
    function isArray(value) {
      return value instanceof Array;
    }
    function isString(value) {
      return typeof value == "string" || value instanceof String;
    }
    function isFunction(value) {
      return typeof value == "function";
    }
    function isBuffer(value) {
      return typeof value == "object" && "length" in value;
    }
    function isURL(value) {
      return URL2 && value instanceof URL2;
    }
    function escapeRegex(regex) {
      return regex.replace(/[\]\\/()*+?.$]/g, "\\$&");
    }
    module2.exports = wrap({ http, https });
    module2.exports.wrap = wrap;
  }
});

// node_modules/axios/dist/node/axios.cjs
var require_axios = __commonJS({
  "node_modules/axios/dist/node/axios.cjs"(exports2, module2) {
    "use strict";
    var FormData$1 = require_form_data(), crypto2 = require("crypto"), url = require("url"), HttpsProxyAgent = require_dist(), http = require("http"), https = require("https"), http2 = require("http2"), util = require("util"), path = require("path"), followRedirects = require_follow_redirects(), zlib = require("zlib"), stream = require("stream"), events = require("events");
    function bind(fn, thisArg) {
      return function() {
        return fn.apply(thisArg, arguments);
      };
    }
    var {
      toString
    } = Object.prototype, {
      getPrototypeOf
    } = Object, {
      iterator,
      toStringTag
    } = Symbol, hasOwnProperty = (({
      hasOwnProperty: hasOwnProperty2
    }) => (obj, prop) => hasOwnProperty2.call(obj, prop))(Object.prototype), hasOwnInPrototypeChain = (thing, prop) => {
      let obj = thing, seen = [];
      for (; obj != null && obj !== Object.prototype; ) {
        if (seen.indexOf(obj) !== -1)
          return !1;
        if (seen.push(obj), hasOwnProperty(obj, prop))
          return !0;
        obj = getPrototypeOf(obj);
      }
      return !1;
    }, getSafeProp = (obj, prop) => obj != null && hasOwnInPrototypeChain(obj, prop) ? obj[prop] : void 0, kindOf = /* @__PURE__ */ ((cache) => (thing) => {
      let str = toString.call(thing);
      return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
    })(/* @__PURE__ */ Object.create(null)), kindOfTest = (type) => (type = type.toLowerCase(), (thing) => kindOf(thing) === type), typeOfTest = (type) => (thing) => typeof thing === type, {
      isArray
    } = Array, isUndefined = typeOfTest("undefined");
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor) && isFunction$1(val.constructor.isBuffer) && val.constructor.isBuffer(val);
    }
    var isArrayBuffer = kindOfTest("ArrayBuffer");
    function isArrayBufferView(val) {
      let result;
      return typeof ArrayBuffer < "u" && ArrayBuffer.isView ? result = ArrayBuffer.isView(val) : result = val && val.buffer && isArrayBuffer(val.buffer), result;
    }
    var isString = typeOfTest("string"), isFunction$1 = typeOfTest("function"), isNumber = typeOfTest("number"), isObject = (thing) => thing !== null && typeof thing == "object", isBoolean = (thing) => thing === !0 || thing === !1, isPlainObject = (val) => {
      if (!isObject(val))
        return !1;
      let prototype2 = getPrototypeOf(val);
      return (prototype2 === null || prototype2 === Object.prototype || getPrototypeOf(prototype2) === null) && // Treat any genuine (non-Object.prototype-polluted) Symbol.toStringTag or
      // Symbol.iterator as evidence the value is a tagged/iterable type rather
      // than a plain object, while ignoring keys injected onto Object.prototype.
      !hasOwnInPrototypeChain(val, toStringTag) && !hasOwnInPrototypeChain(val, iterator);
    }, isEmptyObject = (val) => {
      if (!isObject(val) || isBuffer(val))
        return !1;
      try {
        return Object.keys(val).length === 0 && Object.getPrototypeOf(val) === Object.prototype;
      } catch {
        return !1;
      }
    }, isDate = kindOfTest("Date"), isFile = kindOfTest("File"), isReactNativeBlob = (value) => !!(value && typeof value.uri < "u"), isReactNative = (formData) => formData && typeof formData.getParts < "u", isBlob = kindOfTest("Blob"), isFileList = kindOfTest("FileList"), isStream = (val) => isObject(val) && isFunction$1(val.pipe);
    function getGlobal() {
      return typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : typeof global < "u" ? global : {};
    }
    var G = getGlobal(), FormDataCtor = typeof G.FormData < "u" ? G.FormData : void 0, isFormData = (thing) => {
      if (!thing) return !1;
      if (FormDataCtor && thing instanceof FormDataCtor) return !0;
      let proto = getPrototypeOf(thing);
      if (!proto || proto === Object.prototype || !isFunction$1(thing.append)) return !1;
      let kind = kindOf(thing);
      return kind === "formdata" || // detect form-data instance
      kind === "object" && isFunction$1(thing.toString) && thing.toString() === "[object FormData]";
    }, isURLSearchParams = kindOfTest("URLSearchParams"), [isReadableStream, isRequest, isResponse, isHeaders] = ["ReadableStream", "Request", "Response", "Headers"].map(kindOfTest), trim = (str) => str.trim ? str.trim() : str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, "");
    function forEach(obj, fn, {
      allOwnKeys = !1
    } = {}) {
      if (obj === null || typeof obj > "u")
        return;
      let i, l;
      if (typeof obj != "object" && (obj = [obj]), isArray(obj))
        for (i = 0, l = obj.length; i < l; i++)
          fn.call(null, obj[i], i, obj);
      else {
        if (isBuffer(obj))
          return;
        let keys = allOwnKeys ? Object.getOwnPropertyNames(obj) : Object.keys(obj), len = keys.length, key;
        for (i = 0; i < len; i++)
          key = keys[i], fn.call(null, obj[key], key, obj);
      }
    }
    function findKey(obj, key) {
      if (isBuffer(obj))
        return null;
      key = key.toLowerCase();
      let keys = Object.keys(obj), i = keys.length, _key;
      for (; i-- > 0; )
        if (_key = keys[i], key === _key.toLowerCase())
          return _key;
      return null;
    }
    var _global = typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : typeof window < "u" ? window : global, isContextDefined = (context) => !isUndefined(context) && context !== _global;
    function merge(...objs) {
      let {
        caseless,
        skipUndefined
      } = isContextDefined(this) && this || {}, result = {}, assignValue = (val, key) => {
        if (key === "__proto__" || key === "constructor" || key === "prototype")
          return;
        let targetKey = caseless && typeof key == "string" && findKey(result, key) || key, existing = hasOwnProperty(result, targetKey) ? result[targetKey] : void 0;
        isPlainObject(existing) && isPlainObject(val) ? result[targetKey] = merge(existing, val) : isPlainObject(val) ? result[targetKey] = merge({}, val) : isArray(val) ? result[targetKey] = val.slice() : (!skipUndefined || !isUndefined(val)) && (result[targetKey] = val);
      };
      for (let i = 0, l = objs.length; i < l; i++) {
        let source = objs[i];
        if (!source || isBuffer(source) || (forEach(source, assignValue), typeof source != "object" || isArray(source)))
          continue;
        let symbols = Object.getOwnPropertySymbols(source);
        for (let j = 0; j < symbols.length; j++) {
          let symbol = symbols[j];
          propertyIsEnumerable.call(source, symbol) && assignValue(source[symbol], symbol);
        }
      }
      return result;
    }
    var extend = (a, b, thisArg, {
      allOwnKeys
    } = {}) => (forEach(b, (val, key) => {
      thisArg && isFunction$1(val) ? Object.defineProperty(a, key, {
        // Null-proto descriptor so a polluted Object.prototype.get cannot
        // hijack defineProperty's accessor-vs-data resolution.
        __proto__: null,
        value: bind(val, thisArg),
        writable: !0,
        enumerable: !0,
        configurable: !0
      }) : Object.defineProperty(a, key, {
        __proto__: null,
        value: val,
        writable: !0,
        enumerable: !0,
        configurable: !0
      });
    }, {
      allOwnKeys
    }), a), stripBOM = (content) => (content.charCodeAt(0) === 65279 && (content = content.slice(1)), content), inherits = (constructor, superConstructor, props, descriptors) => {
      constructor.prototype = Object.create(superConstructor.prototype, descriptors), Object.defineProperty(constructor.prototype, "constructor", {
        __proto__: null,
        value: constructor,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }), Object.defineProperty(constructor, "super", {
        __proto__: null,
        value: superConstructor.prototype
      }), props && Object.assign(constructor.prototype, props);
    }, toFlatObject = (sourceObj, destObj, filter, propFilter) => {
      let props, i, prop, merged = {};
      if (destObj = destObj || {}, sourceObj == null) return destObj;
      do {
        for (props = Object.getOwnPropertyNames(sourceObj), i = props.length; i-- > 0; )
          prop = props[i], (!propFilter || propFilter(prop, sourceObj, destObj)) && !merged[prop] && (destObj[prop] = sourceObj[prop], merged[prop] = !0);
        sourceObj = filter !== !1 && getPrototypeOf(sourceObj);
      } while (sourceObj && (!filter || filter(sourceObj, destObj)) && sourceObj !== Object.prototype);
      return destObj;
    }, endsWith = (str, searchString, position) => {
      str = String(str), (position === void 0 || position > str.length) && (position = str.length), position -= searchString.length;
      let lastIndex = str.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }, toArray = (thing) => {
      if (!thing) return null;
      if (isArray(thing)) return thing;
      let i = thing.length;
      if (!isNumber(i)) return null;
      let arr = new Array(i);
      for (; i-- > 0; )
        arr[i] = thing[i];
      return arr;
    }, isTypedArray = /* @__PURE__ */ ((TypedArray) => (thing) => TypedArray && thing instanceof TypedArray)(typeof Uint8Array < "u" && getPrototypeOf(Uint8Array)), forEachEntry = (obj, fn) => {
      let _iterator = (obj && obj[iterator]).call(obj), result;
      for (; (result = _iterator.next()) && !result.done; ) {
        let pair = result.value;
        fn.call(obj, pair[0], pair[1]);
      }
    }, matchAll = (regExp, str) => {
      let matches, arr = [];
      for (; (matches = regExp.exec(str)) !== null; )
        arr.push(matches);
      return arr;
    }, isHTMLForm = kindOfTest("HTMLFormElement"), toCamelCase = (str) => str.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function(m, p1, p2) {
      return p1.toUpperCase() + p2;
    }), {
      propertyIsEnumerable
    } = Object.prototype, isRegExp = kindOfTest("RegExp"), reduceDescriptors = (obj, reducer) => {
      let descriptors = Object.getOwnPropertyDescriptors(obj), reducedDescriptors = {};
      forEach(descriptors, (descriptor, name) => {
        let ret;
        (ret = reducer(descriptor, name, obj)) !== !1 && (reducedDescriptors[name] = ret || descriptor);
      }), Object.defineProperties(obj, reducedDescriptors);
    }, freezeMethods = (obj) => {
      reduceDescriptors(obj, (descriptor, name) => {
        if (isFunction$1(obj) && ["arguments", "caller", "callee"].includes(name))
          return !1;
        let value = obj[name];
        if (isFunction$1(value)) {
          if (descriptor.enumerable = !1, "writable" in descriptor) {
            descriptor.writable = !1;
            return;
          }
          descriptor.set || (descriptor.set = () => {
            throw Error("Can not rewrite read-only method '" + name + "'");
          });
        }
      });
    }, toObjectSet = (arrayOrString, delimiter) => {
      let obj = {}, define = (arr) => {
        arr.forEach((value) => {
          obj[value] = !0;
        });
      };
      return isArray(arrayOrString) ? define(arrayOrString) : define(String(arrayOrString).split(delimiter)), obj;
    }, noop = () => {
    }, toFiniteNumber = (value, defaultValue) => value != null && Number.isFinite(value = +value) ? value : defaultValue;
    function isSpecCompliantForm(thing) {
      return !!(thing && isFunction$1(thing.append) && thing[toStringTag] === "FormData" && thing[iterator]);
    }
    var toJSONObject = (obj) => {
      let visited = /* @__PURE__ */ new WeakSet(), visit = (source) => {
        if (isObject(source)) {
          if (visited.has(source))
            return;
          if (isBuffer(source))
            return source;
          if (!("toJSON" in source)) {
            visited.add(source);
            let target = isArray(source) ? [] : {};
            return forEach(source, (value, key) => {
              let reducedValue = visit(value);
              !isUndefined(reducedValue) && (target[key] = reducedValue);
            }), visited.delete(source), target;
          }
        }
        return source;
      };
      return visit(obj);
    }, isAsyncFn = kindOfTest("AsyncFunction"), isThenable = (thing) => thing && (isObject(thing) || isFunction$1(thing)) && isFunction$1(thing.then) && isFunction$1(thing.catch), _setImmediate = ((setImmediateSupported, postMessageSupported) => setImmediateSupported ? setImmediate : postMessageSupported ? ((token, callbacks) => (_global.addEventListener("message", ({
      source,
      data
    }) => {
      source === _global && data === token && callbacks.length && callbacks.shift()();
    }, !1), (cb) => {
      callbacks.push(cb), _global.postMessage(token, "*");
    }))(`axios@${Math.random()}`, []) : (cb) => setTimeout(cb))(typeof setImmediate == "function", isFunction$1(_global.postMessage)), asap = typeof queueMicrotask < "u" ? queueMicrotask.bind(_global) : typeof process < "u" && process.nextTick || _setImmediate, isIterable = (thing) => thing != null && isFunction$1(thing[iterator]), isSafeIterable = (thing) => thing != null && hasOwnInPrototypeChain(thing, iterator) && isIterable(thing), utils$1 = {
      isArray,
      isArrayBuffer,
      isBuffer,
      isFormData,
      isArrayBufferView,
      isString,
      isNumber,
      isBoolean,
      isObject,
      isPlainObject,
      isEmptyObject,
      isReadableStream,
      isRequest,
      isResponse,
      isHeaders,
      isUndefined,
      isDate,
      isFile,
      isReactNativeBlob,
      isReactNative,
      isBlob,
      isRegExp,
      isFunction: isFunction$1,
      isStream,
      isURLSearchParams,
      isTypedArray,
      isFileList,
      forEach,
      merge,
      extend,
      trim,
      stripBOM,
      inherits,
      toFlatObject,
      kindOf,
      kindOfTest,
      endsWith,
      toArray,
      forEachEntry,
      matchAll,
      isHTMLForm,
      hasOwnProperty,
      hasOwnProp: hasOwnProperty,
      // an alias to avoid ESLint no-prototype-builtins detection
      hasOwnInPrototypeChain,
      getSafeProp,
      reduceDescriptors,
      freezeMethods,
      toObjectSet,
      toCamelCase,
      noop,
      toFiniteNumber,
      findKey,
      global: _global,
      isContextDefined,
      isSpecCompliantForm,
      toJSONObject,
      isAsyncFn,
      isThenable,
      setImmediate: _setImmediate,
      asap,
      isIterable,
      isSafeIterable
    }, ignoreDuplicateOf = utils$1.toObjectSet(["age", "authorization", "content-length", "content-type", "etag", "expires", "from", "host", "if-modified-since", "if-unmodified-since", "last-modified", "location", "max-forwards", "proxy-authorization", "referer", "retry-after", "user-agent"]), parseHeaders = (rawHeaders) => {
      let parsed = {}, key, val, i;
      return rawHeaders && rawHeaders.split(`
`).forEach(function(line) {
        i = line.indexOf(":"), key = line.substring(0, i).trim().toLowerCase(), val = line.substring(i + 1).trim(), !(!key || parsed[key] && ignoreDuplicateOf[key]) && (key === "set-cookie" ? parsed[key] ? parsed[key].push(val) : parsed[key] = [val] : parsed[key] = parsed[key] ? parsed[key] + ", " + val : val);
      }), parsed;
    };
    function trimSPorHTAB(str) {
      let start = 0, end = str.length;
      for (; start < end; ) {
        let code = str.charCodeAt(start);
        if (code !== 9 && code !== 32)
          break;
        start += 1;
      }
      for (; end > start; ) {
        let code = str.charCodeAt(end - 1);
        if (code !== 9 && code !== 32)
          break;
        end -= 1;
      }
      return start === 0 && end === str.length ? str : str.slice(start, end);
    }
    var INVALID_UNICODE_HEADER_VALUE_CHARS = new RegExp("[\\u0000-\\u0008\\u000a-\\u001f\\u007f]+", "g"), INVALID_BYTE_STRING_HEADER_VALUE_CHARS = new RegExp("[^\\u0009\\u0020-\\u007e\\u0080-\\u00ff]+", "g");
    function sanitizeValue(value, invalidChars) {
      return utils$1.isArray(value) ? value.map((item) => sanitizeValue(item, invalidChars)) : trimSPorHTAB(String(value).replace(invalidChars, ""));
    }
    var sanitizeHeaderValue = (value) => sanitizeValue(value, INVALID_UNICODE_HEADER_VALUE_CHARS), sanitizeByteStringHeaderValue = (value) => sanitizeValue(value, INVALID_BYTE_STRING_HEADER_VALUE_CHARS);
    function toByteStringHeaderObject(headers) {
      let byteStringHeaders = /* @__PURE__ */ Object.create(null);
      return utils$1.forEach(headers.toJSON(), (value, header) => {
        byteStringHeaders[header] = sanitizeByteStringHeaderValue(value);
      }), byteStringHeaders;
    }
    var $internals = /* @__PURE__ */ Symbol("internals");
    function normalizeHeader(header) {
      return header && String(header).trim().toLowerCase();
    }
    function normalizeValue(value) {
      return value === !1 || value == null ? value : utils$1.isArray(value) ? value.map(normalizeValue) : sanitizeHeaderValue(String(value));
    }
    function parseTokens(str) {
      let tokens = /* @__PURE__ */ Object.create(null), tokensRE = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g, match;
      for (; match = tokensRE.exec(str); )
        tokens[match[1]] = match[2];
      return tokens;
    }
    var isValidHeaderName = (str) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(str.trim());
    function matchHeaderValue(context, value, header, filter, isHeaderNameFilter) {
      if (utils$1.isFunction(filter))
        return filter.call(this, value, header);
      if (isHeaderNameFilter && (value = header), !!utils$1.isString(value)) {
        if (utils$1.isString(filter))
          return value.indexOf(filter) !== -1;
        if (utils$1.isRegExp(filter))
          return filter.test(value);
      }
    }
    function formatHeader(header) {
      return header.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (w, char, str) => char.toUpperCase() + str);
    }
    function buildAccessors(obj, header) {
      let accessorName = utils$1.toCamelCase(" " + header);
      ["get", "set", "has"].forEach((methodName) => {
        Object.defineProperty(obj, methodName + accessorName, {
          // Null-proto descriptor so a polluted Object.prototype.get cannot turn
          // this data descriptor into an accessor descriptor on the way in.
          __proto__: null,
          value: function(arg1, arg2, arg3) {
            return this[methodName].call(this, header, arg1, arg2, arg3);
          },
          configurable: !0
        });
      });
    }
    var AxiosHeaders = class {
      constructor(headers) {
        headers && this.set(headers);
      }
      set(header, valueOrRewrite, rewrite) {
        let self2 = this;
        function setHeader(_value, _header, _rewrite) {
          let lHeader = normalizeHeader(_header);
          if (!lHeader)
            return;
          let key = utils$1.findKey(self2, lHeader);
          (!key || self2[key] === void 0 || _rewrite === !0 || _rewrite === void 0 && self2[key] !== !1) && (self2[key || _header] = normalizeValue(_value));
        }
        let setHeaders = (headers, _rewrite) => utils$1.forEach(headers, (_value, _header) => setHeader(_value, _header, _rewrite));
        if (utils$1.isPlainObject(header) || header instanceof this.constructor)
          setHeaders(header, valueOrRewrite);
        else if (utils$1.isString(header) && (header = header.trim()) && !isValidHeaderName(header))
          setHeaders(parseHeaders(header), valueOrRewrite);
        else if (utils$1.isObject(header) && utils$1.isSafeIterable(header)) {
          let obj = /* @__PURE__ */ Object.create(null), dest, key;
          for (let entry of header) {
            if (!utils$1.isArray(entry))
              throw new TypeError("Object iterator must return a key-value pair");
            key = entry[0], utils$1.hasOwnProp(obj, key) ? (dest = obj[key], obj[key] = utils$1.isArray(dest) ? [...dest, entry[1]] : [dest, entry[1]]) : obj[key] = entry[1];
          }
          setHeaders(obj, valueOrRewrite);
        } else
          header != null && setHeader(valueOrRewrite, header, rewrite);
        return this;
      }
      get(header, parser) {
        if (header = normalizeHeader(header), header) {
          let key = utils$1.findKey(this, header);
          if (key) {
            let value = this[key];
            if (!parser)
              return value;
            if (parser === !0)
              return parseTokens(value);
            if (utils$1.isFunction(parser))
              return parser.call(this, value, key);
            if (utils$1.isRegExp(parser))
              return parser.exec(value);
            throw new TypeError("parser must be boolean|regexp|function");
          }
        }
      }
      has(header, matcher) {
        if (header = normalizeHeader(header), header) {
          let key = utils$1.findKey(this, header);
          return !!(key && this[key] !== void 0 && (!matcher || matchHeaderValue(this, this[key], key, matcher)));
        }
        return !1;
      }
      delete(header, matcher) {
        let self2 = this, deleted = !1;
        function deleteHeader(_header) {
          if (_header = normalizeHeader(_header), _header) {
            let key = utils$1.findKey(self2, _header);
            key && (!matcher || matchHeaderValue(self2, self2[key], key, matcher)) && (delete self2[key], deleted = !0);
          }
        }
        return utils$1.isArray(header) ? header.forEach(deleteHeader) : deleteHeader(header), deleted;
      }
      clear(matcher) {
        let keys = Object.keys(this), i = keys.length, deleted = !1;
        for (; i--; ) {
          let key = keys[i];
          (!matcher || matchHeaderValue(this, this[key], key, matcher, !0)) && (delete this[key], deleted = !0);
        }
        return deleted;
      }
      normalize(format) {
        let self2 = this, headers = {};
        return utils$1.forEach(this, (value, header) => {
          let key = utils$1.findKey(headers, header);
          if (key) {
            self2[key] = normalizeValue(value), delete self2[header];
            return;
          }
          let normalized = format ? formatHeader(header) : String(header).trim();
          normalized !== header && delete self2[header], self2[normalized] = normalizeValue(value), headers[normalized] = !0;
        }), this;
      }
      concat(...targets) {
        return this.constructor.concat(this, ...targets);
      }
      toJSON(asStrings) {
        let obj = /* @__PURE__ */ Object.create(null);
        return utils$1.forEach(this, (value, header) => {
          value != null && value !== !1 && (obj[header] = asStrings && utils$1.isArray(value) ? value.join(", ") : value);
        }), obj;
      }
      [Symbol.iterator]() {
        return Object.entries(this.toJSON())[Symbol.iterator]();
      }
      toString() {
        return Object.entries(this.toJSON()).map(([header, value]) => header + ": " + value).join(`
`);
      }
      getSetCookie() {
        return this.get("set-cookie") || [];
      }
      get [Symbol.toStringTag]() {
        return "AxiosHeaders";
      }
      static from(thing) {
        return thing instanceof this ? thing : new this(thing);
      }
      static concat(first, ...targets) {
        let computed = new this(first);
        return targets.forEach((target) => computed.set(target)), computed;
      }
      static accessor(header) {
        let accessors = (this[$internals] = this[$internals] = {
          accessors: {}
        }).accessors, prototype2 = this.prototype;
        function defineAccessor(_header) {
          let lHeader = normalizeHeader(_header);
          accessors[lHeader] || (buildAccessors(prototype2, _header), accessors[lHeader] = !0);
        }
        return utils$1.isArray(header) ? header.forEach(defineAccessor) : defineAccessor(header), this;
      }
    };
    AxiosHeaders.accessor(["Content-Type", "Content-Length", "Accept", "Accept-Encoding", "User-Agent", "Authorization"]);
    utils$1.reduceDescriptors(AxiosHeaders.prototype, ({
      value
    }, key) => {
      let mapped = key[0].toUpperCase() + key.slice(1);
      return {
        get: () => value,
        set(headerValue) {
          this[mapped] = headerValue;
        }
      };
    });
    utils$1.freezeMethods(AxiosHeaders);
    var REDACTED = "[REDACTED ****]";
    function hasOwnOrPrototypeToJSON(source) {
      if (utils$1.hasOwnProp(source, "toJSON"))
        return !0;
      let prototype2 = Object.getPrototypeOf(source);
      for (; prototype2 && prototype2 !== Object.prototype; ) {
        if (utils$1.hasOwnProp(prototype2, "toJSON"))
          return !0;
        prototype2 = Object.getPrototypeOf(prototype2);
      }
      return !1;
    }
    function redactConfig(config, redactKeys) {
      let lowerKeys = new Set(redactKeys.map((k) => String(k).toLowerCase())), seen = [], visit = (source) => {
        if (source === null || typeof source != "object" || utils$1.isBuffer(source)) return source;
        if (seen.indexOf(source) !== -1) return;
        source instanceof AxiosHeaders && (source = source.toJSON()), seen.push(source);
        let result;
        if (utils$1.isArray(source))
          result = [], source.forEach((v, i) => {
            let reducedValue = visit(v);
            utils$1.isUndefined(reducedValue) || (result[i] = reducedValue);
          });
        else {
          if (!utils$1.isPlainObject(source) && hasOwnOrPrototypeToJSON(source))
            return seen.pop(), source;
          result = /* @__PURE__ */ Object.create(null);
          for (let [key, value] of Object.entries(source)) {
            let reducedValue = lowerKeys.has(key.toLowerCase()) ? REDACTED : visit(value);
            utils$1.isUndefined(reducedValue) || (result[key] = reducedValue);
          }
        }
        return seen.pop(), result;
      };
      return visit(config);
    }
    var AxiosError = class _AxiosError extends Error {
      static from(error, code, config, request, response, customProps) {
        let axiosError = new _AxiosError(error.message, code || error.code, config, request, response);
        return Object.defineProperty(axiosError, "cause", {
          __proto__: null,
          value: error,
          writable: !0,
          enumerable: !1,
          configurable: !0
        }), axiosError.name = error.name, error.status != null && axiosError.status == null && (axiosError.status = error.status), customProps && Object.assign(axiosError, customProps), axiosError;
      }
      /**
       * Create an Error with the specified message, config, error code, request and response.
       *
       * @param {string} message The error message.
       * @param {string} [code] The error code (for example, 'ECONNABORTED').
       * @param {Object} [config] The config.
       * @param {Object} [request] The request.
       * @param {Object} [response] The response.
       *
       * @returns {Error} The created error.
       */
      constructor(message, code, config, request, response) {
        super(message), Object.defineProperty(this, "message", {
          // Null-proto descriptor so a polluted Object.prototype.get cannot turn
          // this data descriptor into an accessor descriptor on the way in.
          __proto__: null,
          value: message,
          enumerable: !0,
          writable: !0,
          configurable: !0
        }), this.name = "AxiosError", this.isAxiosError = !0, code && (this.code = code), config && (this.config = config), request && (this.request = request), response && (this.response = response, this.status = response.status);
      }
      toJSON() {
        let config = this.config, redactKeys = config && utils$1.hasOwnProp(config, "redact") ? config.redact : void 0, serializedConfig = utils$1.isArray(redactKeys) && redactKeys.length > 0 ? redactConfig(config, redactKeys) : utils$1.toJSONObject(config);
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: serializedConfig,
          code: this.code,
          status: this.status
        };
      }
    };
    AxiosError.ERR_BAD_OPTION_VALUE = "ERR_BAD_OPTION_VALUE";
    AxiosError.ERR_BAD_OPTION = "ERR_BAD_OPTION";
    AxiosError.ECONNABORTED = "ECONNABORTED";
    AxiosError.ETIMEDOUT = "ETIMEDOUT";
    AxiosError.ECONNREFUSED = "ECONNREFUSED";
    AxiosError.ERR_NETWORK = "ERR_NETWORK";
    AxiosError.ERR_FR_TOO_MANY_REDIRECTS = "ERR_FR_TOO_MANY_REDIRECTS";
    AxiosError.ERR_DEPRECATED = "ERR_DEPRECATED";
    AxiosError.ERR_BAD_RESPONSE = "ERR_BAD_RESPONSE";
    AxiosError.ERR_BAD_REQUEST = "ERR_BAD_REQUEST";
    AxiosError.ERR_CANCELED = "ERR_CANCELED";
    AxiosError.ERR_NOT_SUPPORT = "ERR_NOT_SUPPORT";
    AxiosError.ERR_INVALID_URL = "ERR_INVALID_URL";
    AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED = "ERR_FORM_DATA_DEPTH_EXCEEDED";
    var DEFAULT_FORM_DATA_MAX_DEPTH = 100;
    function isVisitable(thing) {
      return utils$1.isPlainObject(thing) || utils$1.isArray(thing);
    }
    function removeBrackets(key) {
      return utils$1.endsWith(key, "[]") ? key.slice(0, -2) : key;
    }
    function renderKey(path2, key, dots) {
      return path2 ? path2.concat(key).map(function(token, i) {
        return token = removeBrackets(token), !dots && i ? "[" + token + "]" : token;
      }).join(dots ? "." : "") : key;
    }
    function isFlatArray(arr) {
      return utils$1.isArray(arr) && !arr.some(isVisitable);
    }
    var predicates = utils$1.toFlatObject(utils$1, {}, null, function(prop) {
      return /^is[A-Z]/.test(prop);
    });
    function toFormData(obj, formData, options) {
      if (!utils$1.isObject(obj))
        throw new TypeError("target must be an object");
      formData = formData || new (FormData$1 || FormData)(), options = utils$1.toFlatObject(options, {
        metaTokens: !0,
        dots: !1,
        indexes: !1
      }, !1, function(option, source) {
        return !utils$1.isUndefined(source[option]);
      });
      let metaTokens = options.metaTokens, visitor = options.visitor || defaultVisitor, dots = options.dots, indexes = options.indexes, _Blob = options.Blob || typeof Blob < "u" && Blob, maxDepth = options.maxDepth === void 0 ? DEFAULT_FORM_DATA_MAX_DEPTH : options.maxDepth, useBlob = _Blob && utils$1.isSpecCompliantForm(formData), stack = [];
      if (!utils$1.isFunction(visitor))
        throw new TypeError("visitor must be a function");
      function convertValue(value) {
        if (value === null) return "";
        if (utils$1.isDate(value))
          return value.toISOString();
        if (utils$1.isBoolean(value))
          return value.toString();
        if (!useBlob && utils$1.isBlob(value))
          throw new AxiosError("Blob is not supported. Use a Buffer instead.");
        if (utils$1.isArrayBuffer(value) || utils$1.isTypedArray(value)) {
          if (useBlob && typeof _Blob == "function")
            return new _Blob([value]);
          if (typeof Buffer < "u")
            return Buffer.from(value);
          throw new AxiosError("Blob is not supported. Use a Buffer instead.", AxiosError.ERR_NOT_SUPPORT);
        }
        return value;
      }
      function throwIfMaxDepthExceeded(depth) {
        if (depth > maxDepth)
          throw new AxiosError("Object is too deeply nested (" + depth + " levels). Max depth: " + maxDepth, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
      }
      function stringifyWithDepthLimit(value, depth) {
        if (maxDepth === 1 / 0)
          return JSON.stringify(value);
        let ancestors = [];
        return JSON.stringify(value, function(_key, currentValue) {
          if (!utils$1.isObject(currentValue))
            return currentValue;
          for (; ancestors.length && ancestors[ancestors.length - 1] !== this; )
            ancestors.pop();
          return ancestors.push(currentValue), throwIfMaxDepthExceeded(depth + ancestors.length - 1), currentValue;
        });
      }
      function defaultVisitor(value, key, path2) {
        let arr = value;
        if (utils$1.isReactNative(formData) && utils$1.isReactNativeBlob(value))
          return formData.append(renderKey(path2, key, dots), convertValue(value)), !1;
        if (value && !path2 && typeof value == "object") {
          if (utils$1.endsWith(key, "{}"))
            key = metaTokens ? key : key.slice(0, -2), value = stringifyWithDepthLimit(value, 1);
          else if (utils$1.isArray(value) && isFlatArray(value) || (utils$1.isFileList(value) || utils$1.endsWith(key, "[]")) && (arr = utils$1.toArray(value)))
            return key = removeBrackets(key), arr.forEach(function(el, index) {
              !(utils$1.isUndefined(el) || el === null) && formData.append(
                // eslint-disable-next-line no-nested-ternary
                indexes === !0 ? renderKey([key], index, dots) : indexes === null ? key : key + "[]",
                convertValue(el)
              );
            }), !1;
        }
        return isVisitable(value) ? !0 : (formData.append(renderKey(path2, key, dots), convertValue(value)), !1);
      }
      let exposedHelpers = Object.assign(predicates, {
        defaultVisitor,
        convertValue,
        isVisitable
      });
      function build(value, path2, depth = 0) {
        if (!utils$1.isUndefined(value)) {
          if (throwIfMaxDepthExceeded(depth), stack.indexOf(value) !== -1)
            throw new Error("Circular reference detected in " + path2.join("."));
          stack.push(value), utils$1.forEach(value, function(el, key) {
            (!(utils$1.isUndefined(el) || el === null) && visitor.call(formData, el, utils$1.isString(key) ? key.trim() : key, path2, exposedHelpers)) === !0 && build(el, path2 ? path2.concat(key) : [key], depth + 1);
          }), stack.pop();
        }
      }
      if (!utils$1.isObject(obj))
        throw new TypeError("data must be an object");
      return build(obj), formData;
    }
    function encode$1(str) {
      let charMap = {
        "!": "%21",
        "'": "%27",
        "(": "%28",
        ")": "%29",
        "~": "%7E",
        "%20": "+"
      };
      return encodeURIComponent(str).replace(/[!'()~]|%20/g, function(match) {
        return charMap[match];
      });
    }
    function AxiosURLSearchParams(params, options) {
      this._pairs = [], params && toFormData(params, this, options);
    }
    var prototype = AxiosURLSearchParams.prototype;
    prototype.append = function(name, value) {
      this._pairs.push([name, value]);
    };
    prototype.toString = function(encoder) {
      let _encode = encoder ? (value) => encoder.call(this, value, encode$1) : encode$1;
      return this._pairs.map(function(pair) {
        return _encode(pair[0]) + "=" + _encode(pair[1]);
      }, "").join("&");
    };
    function encode(val) {
      return encodeURIComponent(val).replace(/%3A/gi, ":").replace(/%24/g, "$").replace(/%2C/gi, ",").replace(/%20/g, "+");
    }
    function buildURL(url2, params, options) {
      if (!params)
        return url2;
      url2 = url2 || "";
      let _options = utils$1.isFunction(options) ? {
        serialize: options
      } : options, _encode = utils$1.getSafeProp(_options, "encode") || encode, serializeFn = utils$1.getSafeProp(_options, "serialize"), serializedParams;
      if (serializeFn ? serializedParams = serializeFn(params, _options) : serializedParams = utils$1.isURLSearchParams(params) ? params.toString() : new AxiosURLSearchParams(params, _options).toString(_encode), serializedParams) {
        let hashmarkIndex = url2.indexOf("#");
        hashmarkIndex !== -1 && (url2 = url2.slice(0, hashmarkIndex)), url2 += (url2.indexOf("?") === -1 ? "?" : "&") + serializedParams;
      }
      return url2;
    }
    var InterceptorManager = class {
      constructor() {
        this.handlers = [];
      }
      /**
       * Add a new interceptor to the stack
       *
       * @param {Function} fulfilled The function to handle `then` for a `Promise`
       * @param {Function} rejected The function to handle `reject` for a `Promise`
       * @param {Object} options The options for the interceptor, synchronous and runWhen
       *
       * @return {Number} An ID used to remove interceptor later
       */
      use(fulfilled, rejected, options) {
        return this.handlers.push({
          fulfilled,
          rejected,
          synchronous: options ? options.synchronous : !1,
          runWhen: options ? options.runWhen : null
        }), this.handlers.length - 1;
      }
      /**
       * Remove an interceptor from the stack
       *
       * @param {Number} id The ID that was returned by `use`
       *
       * @returns {void}
       */
      eject(id) {
        this.handlers[id] && (this.handlers[id] = null);
      }
      /**
       * Clear all interceptors from the stack
       *
       * @returns {void}
       */
      clear() {
        this.handlers && (this.handlers = []);
      }
      /**
       * Iterate over all the registered interceptors
       *
       * This method is particularly useful for skipping over any
       * interceptors that may have become `null` calling `eject`.
       *
       * @param {Function} fn The function to call for each interceptor
       *
       * @returns {void}
       */
      forEach(fn) {
        utils$1.forEach(this.handlers, function(h) {
          h !== null && fn(h);
        });
      }
    }, transitionalDefaults = {
      silentJSONParsing: !0,
      forcedJSONParsing: !0,
      clarifyTimeoutError: !1,
      legacyInterceptorReqResOrdering: !0,
      advertiseZstdAcceptEncoding: !1,
      validateStatusUndefinedResolves: !0
    }, URLSearchParams = url.URLSearchParams, ALPHA = "abcdefghijklmnopqrstuvwxyz", DIGIT = "0123456789", ALPHABET = {
      DIGIT,
      ALPHA,
      ALPHA_DIGIT: ALPHA + ALPHA.toUpperCase() + DIGIT
    }, generateString = (size = 16, alphabet = ALPHABET.ALPHA_DIGIT) => {
      let str = "", {
        length
      } = alphabet, randomValues = new Uint32Array(size);
      crypto2.randomFillSync(randomValues);
      for (let i = 0; i < size; i++)
        str += alphabet[randomValues[i] % length];
      return str;
    }, platform$1 = {
      isNode: !0,
      classes: {
        URLSearchParams,
        FormData: FormData$1,
        Blob: typeof Blob < "u" && Blob || null
      },
      ALPHABET,
      generateString,
      protocols: ["http", "https", "file", "data"]
    }, hasBrowserEnv = typeof window < "u" && typeof document < "u", _navigator = typeof navigator == "object" && navigator || void 0, hasStandardBrowserEnv = hasBrowserEnv && (!_navigator || ["ReactNative", "NativeScript", "NS"].indexOf(_navigator.product) < 0), hasStandardBrowserWebWorkerEnv = typeof WorkerGlobalScope < "u" && // eslint-disable-next-line no-undef
    self instanceof WorkerGlobalScope && typeof self.importScripts == "function", origin = hasBrowserEnv && window.location.href || "http://localhost", utils = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      hasBrowserEnv,
      hasStandardBrowserEnv,
      hasStandardBrowserWebWorkerEnv,
      navigator: _navigator,
      origin
    }), platform = {
      ...utils,
      ...platform$1
    };
    function toURLEncodedForm(data, options) {
      return toFormData(data, new platform.classes.URLSearchParams(), {
        visitor: function(value, key, path2, helpers) {
          return platform.isNode && utils$1.isBuffer(value) ? (this.append(key, value.toString("base64")), !1) : helpers.defaultVisitor.apply(this, arguments);
        },
        ...options
      });
    }
    var MAX_DEPTH = DEFAULT_FORM_DATA_MAX_DEPTH;
    function throwIfDepthExceeded(index) {
      if (index > MAX_DEPTH)
        throw new AxiosError("FormData field is too deeply nested (" + index + " levels). Max depth: " + MAX_DEPTH, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
    }
    function parsePropPath(name) {
      let path2 = [], pattern = /\w+|\[(\w*)]/g, match;
      for (; (match = pattern.exec(name)) !== null; )
        throwIfDepthExceeded(path2.length), path2.push(match[0] === "[]" ? "" : match[1] || match[0]);
      return path2;
    }
    function arrayToObject(arr) {
      let obj = {}, keys = Object.keys(arr), i, len = keys.length, key;
      for (i = 0; i < len; i++)
        key = keys[i], obj[key] = arr[key];
      return obj;
    }
    function formDataToJSON(formData) {
      function buildPath(path2, value, target, index) {
        throwIfDepthExceeded(index);
        let name = path2[index++];
        if (name === "__proto__") return !0;
        let isNumericKey = Number.isFinite(+name), isLast = index >= path2.length;
        return name = !name && utils$1.isArray(target) ? target.length : name, isLast ? (utils$1.hasOwnProp(target, name) ? target[name] = utils$1.isArray(target[name]) ? target[name].concat(value) : [target[name], value] : target[name] = value, !isNumericKey) : ((!utils$1.hasOwnProp(target, name) || !utils$1.isObject(target[name])) && (target[name] = []), buildPath(path2, value, target[name], index) && utils$1.isArray(target[name]) && (target[name] = arrayToObject(target[name])), !isNumericKey);
      }
      if (utils$1.isFormData(formData) && utils$1.isFunction(formData.entries)) {
        let obj = {};
        return utils$1.forEachEntry(formData, (name, value) => {
          buildPath(parsePropPath(name), value, obj, 0);
        }), obj;
      }
      return null;
    }
    var own = (obj, key) => obj != null && utils$1.hasOwnProp(obj, key) ? obj[key] : void 0;
    function stringifySafely(rawValue, parser, encoder) {
      if (utils$1.isString(rawValue))
        try {
          return (parser || JSON.parse)(rawValue), utils$1.trim(rawValue);
        } catch (e) {
          if (e.name !== "SyntaxError")
            throw e;
        }
      return (encoder || JSON.stringify)(rawValue);
    }
    var defaults = {
      transitional: transitionalDefaults,
      adapter: ["xhr", "http", "fetch"],
      transformRequest: [function(data, headers) {
        let contentType = headers.getContentType() || "", hasJSONContentType = contentType.indexOf("application/json") > -1, isObjectPayload = utils$1.isObject(data);
        if (isObjectPayload && utils$1.isHTMLForm(data) && (data = new FormData(data)), utils$1.isFormData(data))
          return hasJSONContentType ? JSON.stringify(formDataToJSON(data)) : data;
        if (utils$1.isArrayBuffer(data) || utils$1.isBuffer(data) || utils$1.isStream(data) || utils$1.isFile(data) || utils$1.isBlob(data) || utils$1.isReadableStream(data))
          return data;
        if (utils$1.isArrayBufferView(data))
          return data.buffer;
        if (utils$1.isURLSearchParams(data))
          return headers.setContentType("application/x-www-form-urlencoded;charset=utf-8", !1), data.toString();
        let isFileList2;
        if (isObjectPayload) {
          let formSerializer = own(this, "formSerializer");
          if (contentType.indexOf("application/x-www-form-urlencoded") > -1)
            return toURLEncodedForm(data, formSerializer).toString();
          if ((isFileList2 = utils$1.isFileList(data)) || contentType.indexOf("multipart/form-data") > -1) {
            let env = own(this, "env"), _FormData = env && env.FormData;
            return toFormData(isFileList2 ? {
              "files[]": data
            } : data, _FormData && new _FormData(), formSerializer);
          }
        }
        return isObjectPayload || hasJSONContentType ? (headers.setContentType("application/json", !1), stringifySafely(data)) : data;
      }],
      transformResponse: [function(data) {
        let transitional = own(this, "transitional") || defaults.transitional, forcedJSONParsing = transitional && transitional.forcedJSONParsing, responseType = own(this, "responseType"), JSONRequested = responseType === "json";
        if (utils$1.isResponse(data) || utils$1.isReadableStream(data))
          return data;
        if (data && utils$1.isString(data) && (forcedJSONParsing && !responseType || JSONRequested)) {
          let strictJSONParsing = !(transitional && transitional.silentJSONParsing) && JSONRequested;
          try {
            return JSON.parse(data, own(this, "parseReviver"));
          } catch (e) {
            if (strictJSONParsing)
              throw e.name === "SyntaxError" ? AxiosError.from(e, AxiosError.ERR_BAD_RESPONSE, this, null, own(this, "response")) : e;
          }
        }
        return data;
      }],
      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,
      xsrfCookieName: "XSRF-TOKEN",
      xsrfHeaderName: "X-XSRF-TOKEN",
      maxContentLength: -1,
      maxBodyLength: -1,
      env: {
        FormData: platform.classes.FormData,
        Blob: platform.classes.Blob
      },
      validateStatus: function(status) {
        return status >= 200 && status < 300;
      },
      headers: {
        common: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": void 0
        }
      }
    };
    utils$1.forEach(["delete", "get", "head", "post", "put", "patch", "query"], (method) => {
      defaults.headers[method] = {};
    });
    function transformData(fns, response) {
      let config = this || defaults, context = response || config, headers = AxiosHeaders.from(context.headers), data = context.data;
      return utils$1.forEach(fns, function(fn) {
        data = fn.call(config, data, headers.normalize(), response ? response.status : void 0);
      }), headers.normalize(), data;
    }
    function isCancel(value) {
      return !!(value && value.__CANCEL__);
    }
    var CanceledError = class extends AxiosError {
      /**
       * A `CanceledError` is an object that is thrown when an operation is canceled.
       *
       * @param {string=} message The message.
       * @param {Object=} config The config.
       * @param {Object=} request The request.
       *
       * @returns {CanceledError} The created error.
       */
      constructor(message, config, request) {
        super(message ?? "canceled", AxiosError.ERR_CANCELED, config, request), this.name = "CanceledError", this.__CANCEL__ = !0;
      }
    };
    function settle(resolve, reject, response) {
      let validateStatus = response.config.validateStatus;
      !response.status || !validateStatus || validateStatus(response.status) ? resolve(response) : reject(new AxiosError("Request failed with status code " + response.status, response.status >= 400 && response.status < 500 ? AxiosError.ERR_BAD_REQUEST : AxiosError.ERR_BAD_RESPONSE, response.config, response.request, response));
    }
    function isAbsoluteURL(url2) {
      return typeof url2 != "string" ? !1 : /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url2);
    }
    function combineURLs(baseURL, relativeURL) {
      return relativeURL ? baseURL.replace(/\/?\/$/, "") + "/" + relativeURL.replace(/^\/+/, "") : baseURL;
    }
    var malformedHttpProtocol = /^https?:(?!\/\/)/i, httpProtocolControlCharacters = /[\t\n\r]/g;
    function stripLeadingC0ControlOrSpace(url2) {
      let i = 0;
      for (; i < url2.length && url2.charCodeAt(i) <= 32; )
        i++;
      return url2.slice(i);
    }
    function normalizeURLForProtocolCheck(url2) {
      return stripLeadingC0ControlOrSpace(url2).replace(httpProtocolControlCharacters, "");
    }
    function assertValidHttpProtocolURL(url2, config) {
      if (typeof url2 == "string" && malformedHttpProtocol.test(normalizeURLForProtocolCheck(url2)))
        throw new AxiosError('Invalid URL: missing "//" after protocol', AxiosError.ERR_INVALID_URL, config);
    }
    function buildFullPath(baseURL, requestedURL, allowAbsoluteUrls, config) {
      assertValidHttpProtocolURL(requestedURL, config);
      let isRelativeUrl = !isAbsoluteURL(requestedURL);
      return baseURL && (isRelativeUrl || allowAbsoluteUrls === !1) ? (assertValidHttpProtocolURL(baseURL, config), combineURLs(baseURL, requestedURL)) : requestedURL;
    }
    var DEFAULT_PORTS$1 = {
      ftp: 21,
      gopher: 70,
      http: 80,
      https: 443,
      ws: 80,
      wss: 443
    };
    function parseUrl(urlString) {
      try {
        return new URL(urlString);
      } catch {
        return null;
      }
    }
    function getProxyForUrl(url2) {
      var parsedUrl = (typeof url2 == "string" ? parseUrl(url2) : url2) || {}, proto = parsedUrl.protocol, hostname = parsedUrl.host, port = parsedUrl.port;
      if (typeof hostname != "string" || !hostname || typeof proto != "string" || (proto = proto.split(":", 1)[0], hostname = hostname.replace(/:\d*$/, ""), port = parseInt(port) || DEFAULT_PORTS$1[proto] || 0, !shouldProxy(hostname, port)))
        return "";
      var proxy = getEnv(proto + "_proxy") || getEnv("all_proxy");
      return proxy && proxy.indexOf("://") === -1 && (proxy = proto + "://" + proxy), proxy;
    }
    function shouldProxy(hostname, port) {
      var NO_PROXY = getEnv("no_proxy").toLowerCase();
      return NO_PROXY ? NO_PROXY === "*" ? !1 : NO_PROXY.split(/[,\s]/).every(function(proxy) {
        if (!proxy)
          return !0;
        var parsedProxy = proxy.match(/^(.+):(\d+)$/), parsedProxyHostname = parsedProxy ? parsedProxy[1] : proxy, parsedProxyPort = parsedProxy ? parseInt(parsedProxy[2]) : 0;
        return parsedProxyPort && parsedProxyPort !== port ? !0 : /^[.*]/.test(parsedProxyHostname) ? (parsedProxyHostname.charAt(0) === "*" && (parsedProxyHostname = parsedProxyHostname.slice(1)), !hostname.endsWith(parsedProxyHostname)) : hostname !== parsedProxyHostname;
      }) : !0;
    }
    function getEnv(key) {
      return process.env[key.toLowerCase()] || process.env[key.toUpperCase()] || "";
    }
    var VERSION = "1.18.1";
    function parseProtocol(url2) {
      let match = /^([-+\w]{1,25}):(?:\/\/)?/.exec(url2);
      return match && match[1] || "";
    }
    var DATA_URL_PATTERN = /^([^,;]+\/[^,;]+)?((?:;[^,;=]+=[^,;]+)*)(;base64)?,([\s\S]*)$/;
    function fromDataURI(uri, asBlob, options) {
      let _Blob = options && options.Blob || platform.classes.Blob, protocol = parseProtocol(uri);
      if (asBlob === void 0 && _Blob && (asBlob = !0), protocol === "data") {
        uri = protocol.length ? uri.slice(protocol.length + 1) : uri;
        let match = DATA_URL_PATTERN.exec(uri);
        if (!match)
          throw new AxiosError("Invalid URL", AxiosError.ERR_INVALID_URL);
        let type = match[1], params = match[2], encoding = match[3] ? "base64" : "utf8", body = match[4], mime = "";
        type ? mime = params ? type + params : type : params && (mime = "text/plain" + params);
        let buffer = encoding === "base64" ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body), encoding);
        if (asBlob) {
          if (!_Blob)
            throw new AxiosError("Blob is not supported", AxiosError.ERR_NOT_SUPPORT);
          return new _Blob([buffer], {
            type: mime
          });
        }
        return buffer;
      }
      throw new AxiosError("Unsupported protocol " + protocol, AxiosError.ERR_NOT_SUPPORT);
    }
    var kInternals = /* @__PURE__ */ Symbol("internals"), AxiosTransformStream = class extends stream.Transform {
      constructor(options) {
        options = utils$1.toFlatObject(options, {
          maxRate: 0,
          chunkSize: 64 * 1024,
          minChunkSize: 100,
          timeWindow: 500,
          ticksRate: 2,
          samplesCount: 15
        }, null, (prop, source) => !utils$1.isUndefined(source[prop])), super({
          readableHighWaterMark: options.chunkSize
        });
        let internals = this[kInternals] = {
          timeWindow: options.timeWindow,
          chunkSize: options.chunkSize,
          maxRate: options.maxRate,
          minChunkSize: options.minChunkSize,
          bytesSeen: 0,
          isCaptured: !1,
          notifiedBytesLoaded: 0,
          ts: Date.now(),
          bytes: 0,
          onReadCallback: null
        };
        this.on("newListener", (event) => {
          event === "progress" && (internals.isCaptured || (internals.isCaptured = !0));
        });
      }
      _read(size) {
        let internals = this[kInternals];
        return internals.onReadCallback && internals.onReadCallback(), super._read(size);
      }
      _transform(chunk, encoding, callback) {
        let internals = this[kInternals], maxRate = internals.maxRate, readableHighWaterMark = this.readableHighWaterMark, timeWindow = internals.timeWindow, divider = 1e3 / timeWindow, bytesThreshold = maxRate / divider, minChunkSize = internals.minChunkSize !== !1 ? Math.max(internals.minChunkSize, bytesThreshold * 0.01) : 0, pushChunk = (_chunk, _callback) => {
          let bytes = Buffer.byteLength(_chunk);
          internals.bytesSeen += bytes, internals.bytes += bytes, internals.isCaptured && this.emit("progress", internals.bytesSeen), this.push(_chunk) ? process.nextTick(_callback) : internals.onReadCallback = () => {
            internals.onReadCallback = null, process.nextTick(_callback);
          };
        }, transformChunk = (_chunk, _callback) => {
          let chunkSize = Buffer.byteLength(_chunk), chunkRemainder = null, maxChunkSize = readableHighWaterMark, bytesLeft, passed = 0;
          if (maxRate) {
            let now = Date.now();
            (!internals.ts || (passed = now - internals.ts) >= timeWindow) && (internals.ts = now, bytesLeft = bytesThreshold - internals.bytes, internals.bytes = bytesLeft < 0 ? -bytesLeft : 0, passed = 0), bytesLeft = bytesThreshold - internals.bytes;
          }
          if (maxRate) {
            if (bytesLeft <= 0)
              return setTimeout(() => {
                _callback(null, _chunk);
              }, timeWindow - passed);
            bytesLeft < maxChunkSize && (maxChunkSize = bytesLeft);
          }
          maxChunkSize && chunkSize > maxChunkSize && chunkSize - maxChunkSize > minChunkSize && (chunkRemainder = _chunk.subarray(maxChunkSize), _chunk = _chunk.subarray(0, maxChunkSize)), pushChunk(_chunk, chunkRemainder ? () => {
            process.nextTick(_callback, null, chunkRemainder);
          } : _callback);
        };
        transformChunk(chunk, function transformNextChunk(err, _chunk) {
          if (err)
            return callback(err);
          _chunk ? transformChunk(_chunk, transformNextChunk) : callback(null);
        });
      }
    }, {
      asyncIterator
    } = Symbol, readBlob = async function* (blob) {
      blob.stream ? yield* blob.stream() : blob.arrayBuffer ? yield await blob.arrayBuffer() : blob[asyncIterator] ? yield* blob[asyncIterator]() : yield blob;
    }, BOUNDARY_ALPHABET = platform.ALPHABET.ALPHA_DIGIT + "-_", textEncoder = typeof TextEncoder == "function" ? new TextEncoder() : new util.TextEncoder(), CRLF = `\r
`, CRLF_BYTES = textEncoder.encode(CRLF), CRLF_BYTES_COUNT = 2, FormDataPart = class {
      constructor(name, value) {
        let {
          escapeName
        } = this.constructor, isStringValue = utils$1.isString(value), headers = `Content-Disposition: form-data; name="${escapeName(name)}"${!isStringValue && value.name ? `; filename="${escapeName(value.name)}"` : ""}${CRLF}`;
        if (isStringValue)
          value = textEncoder.encode(String(value).replace(/\r?\n|\r\n?/g, CRLF));
        else {
          let safeType = String(value.type || "application/octet-stream").replace(/[\r\n]/g, "");
          headers += `Content-Type: ${safeType}${CRLF}`;
        }
        this.headers = textEncoder.encode(headers + CRLF), this.contentLength = isStringValue ? value.byteLength : value.size, this.size = this.headers.byteLength + this.contentLength + CRLF_BYTES_COUNT, this.name = name, this.value = value;
      }
      async *encode() {
        yield this.headers;
        let {
          value
        } = this;
        utils$1.isTypedArray(value) ? yield value : yield* readBlob(value), yield CRLF_BYTES;
      }
      static escapeName(name) {
        return String(name).replace(/[\r\n"]/g, (match) => ({
          "\r": "%0D",
          "\n": "%0A",
          '"': "%22"
        })[match]);
      }
    }, formDataToStream = (form, headersHandler, options) => {
      let {
        tag = "form-data-boundary",
        size = 25,
        boundary = tag + "-" + platform.generateString(size, BOUNDARY_ALPHABET)
      } = options || {};
      if (!utils$1.isFormData(form))
        throw new TypeError("FormData instance required");
      if (boundary.length < 1 || boundary.length > 70)
        throw new Error("boundary must be 1-70 characters long");
      let boundaryBytes = textEncoder.encode("--" + boundary + CRLF), footerBytes = textEncoder.encode("--" + boundary + "--" + CRLF), contentLength = footerBytes.byteLength, parts = Array.from(form.entries()).map(([name, value]) => {
        let part = new FormDataPart(name, value);
        return contentLength += part.size, part;
      });
      contentLength += boundaryBytes.byteLength * parts.length, contentLength = utils$1.toFiniteNumber(contentLength);
      let computedHeaders = {
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      };
      return Number.isFinite(contentLength) && (computedHeaders["Content-Length"] = contentLength), headersHandler && headersHandler(computedHeaders), stream.Readable.from((async function* () {
        for (let part of parts)
          yield boundaryBytes, yield* part.encode();
        yield footerBytes;
      })());
    }, ZlibHeaderTransformStream = class extends stream.Transform {
      __transform(chunk, encoding, callback) {
        this.push(chunk), callback();
      }
      _transform(chunk, encoding, callback) {
        if (chunk.length !== 0 && (this._transform = this.__transform, chunk[0] !== 120)) {
          let header = Buffer.alloc(2);
          header[0] = 120, header[1] = 156, this.push(header, encoding);
        }
        this.__transform(chunk, encoding, callback);
      }
    }, Http2Sessions = class {
      constructor() {
        this.sessions = /* @__PURE__ */ Object.create(null);
      }
      getSession(authority, options) {
        options = Object.assign({
          sessionTimeout: 1e3
        }, options);
        let authoritySessions = this.sessions[authority];
        if (authoritySessions) {
          let len = authoritySessions.length;
          for (let i = 0; i < len; i++) {
            let [sessionHandle, sessionOptions] = authoritySessions[i];
            if (!sessionHandle.destroyed && !sessionHandle.closed && util.isDeepStrictEqual(sessionOptions, options))
              return sessionHandle;
          }
        }
        let session = http2.connect(authority, options), removed, timer, removeSession = () => {
          if (removed)
            return;
          removed = !0, timer && (clearTimeout(timer), timer = null);
          let entries = authoritySessions, len = entries.length, i = len;
          for (; i--; )
            if (entries[i][0] === session) {
              len === 1 ? delete this.sessions[authority] : entries.splice(i, 1), session.closed || session.close();
              return;
            }
        }, originalRequestFn = session.request, {
          sessionTimeout
        } = options;
        if (sessionTimeout != null) {
          let streamsCount = 0;
          session.request = function() {
            let stream2 = originalRequestFn.apply(this, arguments);
            return streamsCount++, timer && (clearTimeout(timer), timer = null), stream2.once("close", () => {
              --streamsCount || (timer = setTimeout(() => {
                timer = null, removeSession();
              }, sessionTimeout));
            }), stream2;
          };
        }
        session.once("close", removeSession);
        let entry = [session, options];
        return authoritySessions ? authoritySessions.push(entry) : authoritySessions = this.sessions[authority] = [entry], session;
      }
    }, callbackify = (fn, reducer) => utils$1.isAsyncFn(fn) ? function(...args) {
      let cb = args.pop();
      fn.apply(this, args).then((value) => {
        try {
          reducer ? cb(null, ...reducer(value)) : cb(null, value);
        } catch (err) {
          cb(err);
        }
      }, cb);
    } : fn, LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "0.0.0.0"]), isIPv4Loopback = (host) => {
      let parts = host.split(".");
      return parts.length !== 4 || parts[0] !== "127" ? !1 : parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
    }, isIPv6ZeroGroup = (group) => /^0{1,4}$/.test(group), isIPv6Unspecified = (host) => {
      if (host === "::") return !0;
      let compressionIndex = host.indexOf("::");
      if (compressionIndex !== -1) {
        if (compressionIndex !== host.lastIndexOf("::")) return !1;
        let left = host.slice(0, compressionIndex), right = host.slice(compressionIndex + 2), leftGroups = left ? left.split(":") : [], rightGroups = right ? right.split(":") : [];
        return leftGroups.length + rightGroups.length < 8 && leftGroups.every(isIPv6ZeroGroup) && rightGroups.every(isIPv6ZeroGroup);
      }
      let groups = host.split(":");
      return groups.length === 8 && groups.every(isIPv6ZeroGroup);
    }, isIPv6Loopback = (host) => {
      if (host === "::1") return !0;
      let v4MappedDotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
      if (v4MappedDotted) return isIPv4Loopback(v4MappedDotted[1]);
      let v4MappedHex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
      if (v4MappedHex) {
        let high = parseInt(v4MappedHex[1], 16);
        return high >= 32512 && high <= 32767;
      }
      let groups = host.split(":");
      if (groups.length === 8) {
        for (let i = 0; i < 7; i++)
          if (!/^0+$/.test(groups[i])) return !1;
        return /^0*1$/.test(groups[7]);
      }
      return !1;
    }, isLoopback = (host) => host ? LOOPBACK_HOSTNAMES.has(host) || isIPv4Loopback(host) || isIPv6Unspecified(host) ? !0 : isIPv6Loopback(host) : !1, DEFAULT_PORTS = {
      http: 80,
      https: 443,
      ws: 80,
      wss: 443,
      ftp: 21
    }, parseNoProxyEntry = (entry) => {
      let entryHost = entry, entryPort = 0;
      if (entryHost.charAt(0) === "[") {
        let bracketIndex = entryHost.indexOf("]");
        if (bracketIndex !== -1) {
          let host = entryHost.slice(1, bracketIndex), rest = entryHost.slice(bracketIndex + 1);
          return rest.charAt(0) === ":" && /^\d+$/.test(rest.slice(1)) && (entryPort = Number.parseInt(rest.slice(1), 10)), [host, entryPort];
        }
      }
      let firstColon = entryHost.indexOf(":"), lastColon = entryHost.lastIndexOf(":");
      return firstColon !== -1 && firstColon === lastColon && /^\d+$/.test(entryHost.slice(lastColon + 1)) && (entryPort = Number.parseInt(entryHost.slice(lastColon + 1), 10), entryHost = entryHost.slice(0, lastColon)), [entryHost, entryPort];
    }, IPV4_MAPPED_DOTTED_RE = /^(?:::|(?:0{1,4}:){1,4}:|(?:0{1,4}:){5})ffff:(\d+\.\d+\.\d+\.\d+)$/i, IPV4_MAPPED_HEX_RE = /^(?:::|(?:0{1,4}:){1,4}:|(?:0{1,4}:){5})ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i, unmapIPv4MappedIPv6 = (host) => {
      if (typeof host != "string" || host.indexOf(":") === -1) return host;
      let dotted = host.match(IPV4_MAPPED_DOTTED_RE);
      if (dotted) return dotted[1];
      let hex = host.match(IPV4_MAPPED_HEX_RE);
      if (hex) {
        let high = parseInt(hex[1], 16), low = parseInt(hex[2], 16);
        return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
      }
      return host;
    }, normalizeNoProxyHost = (hostname) => hostname && (hostname.charAt(0) === "[" && hostname.charAt(hostname.length - 1) === "]" && (hostname = hostname.slice(1, -1)), unmapIPv4MappedIPv6(hostname.replace(/\.+$/, "")));
    function shouldBypassProxy(location) {
      let parsed;
      try {
        parsed = new URL(location);
      } catch {
        return !1;
      }
      let noProxy = (process.env.no_proxy || process.env.NO_PROXY || "").toLowerCase();
      if (!noProxy)
        return !1;
      if (noProxy === "*")
        return !0;
      let port = Number.parseInt(parsed.port, 10) || DEFAULT_PORTS[parsed.protocol.split(":", 1)[0]] || 0, hostname = normalizeNoProxyHost(parsed.hostname.toLowerCase());
      return noProxy.split(/[\s,]+/).some((entry) => {
        if (!entry)
          return !1;
        let [entryHost, entryPort] = parseNoProxyEntry(entry);
        return entryHost = normalizeNoProxyHost(entryHost), !entryHost || entryPort && entryPort !== port ? !1 : (entryHost.charAt(0) === "*" && (entryHost = entryHost.slice(1)), entryHost.charAt(0) === "." ? hostname.endsWith(entryHost) : hostname === entryHost || isLoopback(hostname) && isLoopback(entryHost));
      });
    }
    function speedometer(samplesCount, min) {
      samplesCount = samplesCount || 10;
      let bytes = new Array(samplesCount), timestamps = new Array(samplesCount), head = 0, tail = 0, firstSampleTS;
      return min = min !== void 0 ? min : 1e3, function(chunkLength) {
        let now = Date.now(), startedAt = timestamps[tail];
        firstSampleTS || (firstSampleTS = now), bytes[head] = chunkLength, timestamps[head] = now;
        let i = tail, bytesCount = 0;
        for (; i !== head; )
          bytesCount += bytes[i++], i = i % samplesCount;
        if (head = (head + 1) % samplesCount, head === tail && (tail = (tail + 1) % samplesCount), now - firstSampleTS < min)
          return;
        let passed = startedAt && now - startedAt;
        return passed ? Math.round(bytesCount * 1e3 / passed) : void 0;
      };
    }
    function throttle(fn, freq) {
      let timestamp = 0, threshold = 1e3 / freq, lastArgs, timer, invoke = (args, now = Date.now()) => {
        timestamp = now, lastArgs = null, timer && (clearTimeout(timer), timer = null), fn(...args);
      };
      return [(...args) => {
        let now = Date.now(), passed = now - timestamp;
        passed >= threshold ? invoke(args, now) : (lastArgs = args, timer || (timer = setTimeout(() => {
          timer = null, invoke(lastArgs);
        }, threshold - passed)));
      }, () => lastArgs && invoke(lastArgs)];
    }
    var progressEventReducer = (listener, isDownloadStream, freq = 3) => {
      let bytesNotified = 0, _speedometer = speedometer(50, 250);
      return throttle((e) => {
        if (!e || typeof e.loaded != "number")
          return;
        let rawLoaded = e.loaded, total = e.lengthComputable ? e.total : void 0, loaded = total != null ? Math.min(rawLoaded, total) : rawLoaded, progressBytes = Math.max(0, loaded - bytesNotified), rate = _speedometer(progressBytes);
        bytesNotified = Math.max(bytesNotified, loaded);
        let data = {
          loaded,
          total,
          progress: total ? loaded / total : void 0,
          bytes: progressBytes,
          rate: rate || void 0,
          estimated: rate && total ? (total - loaded) / rate : void 0,
          event: e,
          lengthComputable: total != null,
          [isDownloadStream ? "download" : "upload"]: !0
        };
        listener(data);
      }, freq);
    }, progressEventDecorator = (total, throttled) => {
      let lengthComputable = total != null;
      return [(loaded) => throttled[0]({
        lengthComputable,
        total,
        loaded
      }), throttled[1]];
    }, asyncDecorator = (fn) => (...args) => utils$1.asap(() => fn(...args)), isHexDigit = (charCode) => charCode >= 48 && charCode <= 57 || charCode >= 65 && charCode <= 70 || charCode >= 97 && charCode <= 102, isPercentEncodedByte = (str, i, len) => i + 2 < len && isHexDigit(str.charCodeAt(i + 1)) && isHexDigit(str.charCodeAt(i + 2));
    function estimateDataURLDecodedBytes(url2) {
      if (!url2 || typeof url2 != "string" || !url2.startsWith("data:")) return 0;
      let comma = url2.indexOf(",");
      if (comma < 0) return 0;
      let meta = url2.slice(5, comma), body = url2.slice(comma + 1);
      if (/;base64/i.test(meta)) {
        let effectiveLen = body.length, len = body.length;
        for (let i = 0; i < len; i++)
          if (body.charCodeAt(i) === 37 && i + 2 < len) {
            let a = body.charCodeAt(i + 1), b = body.charCodeAt(i + 2);
            isHexDigit(a) && isHexDigit(b) && (effectiveLen -= 2, i += 2);
          }
        let pad = 0, idx = len - 1, tailIsPct3D = (j) => j >= 2 && body.charCodeAt(j - 2) === 37 && // '%'
        body.charCodeAt(j - 1) === 51 && // '3'
        (body.charCodeAt(j) === 68 || body.charCodeAt(j) === 100);
        idx >= 0 && (body.charCodeAt(idx) === 61 ? (pad++, idx--) : tailIsPct3D(idx) && (pad++, idx -= 3)), pad === 1 && idx >= 0 && (body.charCodeAt(idx) === 61 || tailIsPct3D(idx)) && pad++;
        let bytes2 = Math.floor(effectiveLen / 4) * 3 - (pad || 0);
        return bytes2 > 0 ? bytes2 : 0;
      }
      let bytes = 0;
      for (let i = 0, len = body.length; i < len; i++) {
        let c = body.charCodeAt(i);
        if (c === 37 && isPercentEncodedByte(body, i, len))
          bytes += 1, i += 2;
        else if (c < 128)
          bytes += 1;
        else if (c < 2048)
          bytes += 2;
        else if (c >= 55296 && c <= 56319 && i + 1 < len) {
          let next = body.charCodeAt(i + 1);
          next >= 56320 && next <= 57343 ? (bytes += 4, i++) : bytes += 3;
        } else
          bytes += 3;
      }
      return bytes;
    }
    var zlibOptions = {
      flush: zlib.constants.Z_SYNC_FLUSH,
      finishFlush: zlib.constants.Z_SYNC_FLUSH
    }, brotliOptions = {
      flush: zlib.constants.BROTLI_OPERATION_FLUSH,
      finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
    }, zstdOptions = {
      flush: zlib.constants.ZSTD_e_flush,
      finishFlush: zlib.constants.ZSTD_e_flush
    }, isBrotliSupported = utils$1.isFunction(zlib.createBrotliDecompress), isZstdSupported = utils$1.isFunction(zlib.createZstdDecompress), ACCEPT_ENCODING = "gzip, compress, deflate" + (isBrotliSupported ? ", br" : ""), ACCEPT_ENCODING_WITH_ZSTD = ACCEPT_ENCODING + (isZstdSupported ? ", zstd" : ""), {
      http: httpFollow,
      https: httpsFollow
    } = followRedirects, isHttps = /https:?/, FORM_DATA_CONTENT_HEADERS$1 = ["content-type", "content-length"];
    function setFormDataHeaders$1(headers, formHeaders, policy) {
      if (policy !== "content-only") {
        headers.set(formHeaders);
        return;
      }
      Object.entries(formHeaders).forEach(([key, val]) => {
        FORM_DATA_CONTENT_HEADERS$1.includes(key.toLowerCase()) && headers.set(key, val);
      });
    }
    var kAxiosSocketListener = /* @__PURE__ */ Symbol("axios.http.socketListener"), kAxiosCurrentReq = /* @__PURE__ */ Symbol("axios.http.currentReq"), kAxiosInstalledTunnel = /* @__PURE__ */ Symbol("axios.http.installedTunnel"), tunnelingAgentCache = /* @__PURE__ */ new Map(), tunnelingAgentCacheUser = /* @__PURE__ */ new WeakMap(), NODE_NATIVE_ENV_PROXY_SUPPORT = {
      22: 21,
      24: 5
    };
    function isNodeNativeEnvProxySupported(nodeVersion = process.versions && process.versions.node) {
      if (!nodeVersion)
        return !1;
      let [major, minor] = nodeVersion.split(".").map((part) => Number(part));
      return !Number.isInteger(major) || !Number.isInteger(minor) ? !1 : major > 24 ? !0 : NODE_NATIVE_ENV_PROXY_SUPPORT[major] != null && minor >= NODE_NATIVE_ENV_PROXY_SUPPORT[major];
    }
    function isNodeEnvProxyEnabled(agent, nodeVersion = process.versions && process.versions.node) {
      if (!isNodeNativeEnvProxySupported(nodeVersion))
        return !1;
      let agentOptions = agent && agent.options;
      return !!(agentOptions && utils$1.hasOwnProp(agentOptions, "proxyEnv") && agentOptions.proxyEnv != null);
    }
    function getProxyEnvAgent(options, configHttpAgent, configHttpsAgent) {
      return isHttps.test(options.protocol) ? configHttpsAgent || https.globalAgent : configHttpAgent || http.globalAgent;
    }
    function getTunnelingAgent(agentOptions, userHttpsAgent) {
      let key = agentOptions.protocol + "//" + agentOptions.hostname + ":" + (agentOptions.port || "") + "#" + (agentOptions.auth || ""), cache = userHttpsAgent ? tunnelingAgentCacheUser.get(userHttpsAgent) || tunnelingAgentCacheUser.set(userHttpsAgent, /* @__PURE__ */ new Map()).get(userHttpsAgent) : tunnelingAgentCache, agent = cache.get(key);
      if (agent) return agent;
      let merged = userHttpsAgent && userHttpsAgent.options ? {
        ...userHttpsAgent.options,
        ...agentOptions
      } : agentOptions;
      if (agent = new HttpsProxyAgent(merged), userHttpsAgent && userHttpsAgent.options) {
        let originTLSOptions = {
          ...userHttpsAgent.options
        }, callback = agent.callback;
        agent.callback = function(req, opts) {
          return callback.call(this, req, {
            ...originTLSOptions,
            ...opts
          });
        };
      }
      return agent[kAxiosInstalledTunnel] = !0, cache.set(key, agent), agent;
    }
    var supportedProtocols = platform.protocols.map((protocol) => protocol + ":"), decodeURIComponentSafe$1 = (value) => {
      if (!utils$1.isString(value))
        return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }, flushOnFinish = (stream2, [throttled, flush]) => (stream2.on("end", flush).on("error", flush), throttled), http2Sessions = new Http2Sessions();
    function dispatchBeforeRedirect(options, responseDetails, requestDetails) {
      options.beforeRedirects.proxy && options.beforeRedirects.proxy(options), options.beforeRedirects.auth && options.beforeRedirects.auth(options), options.beforeRedirects.sensitiveHeaders && options.beforeRedirects.sensitiveHeaders(options, requestDetails), options.beforeRedirects.config && options.beforeRedirects.config(options, responseDetails, requestDetails);
    }
    function stripMatchingHeaders(headers, sensitiveSet) {
      headers && Object.keys(headers).forEach((header) => {
        sensitiveSet.has(header.toLowerCase()) && delete headers[header];
      });
    }
    function isSameOriginRedirect(redirectOptions, requestDetails) {
      if (!requestDetails)
        return !1;
      try {
        return new URL(requestDetails.url).origin === new URL(redirectOptions.href).origin;
      } catch {
        return !1;
      }
    }
    function setProxy(options, configProxy, location, isRedirect, configHttpsAgent, configHttpAgent) {
      let proxy = configProxy, proxyEnvAgent = getProxyEnvAgent(options, configHttpAgent, configHttpsAgent);
      if (!proxy && proxy !== !1 && !isNodeEnvProxyEnabled(proxyEnvAgent)) {
        let proxyUrl = getProxyForUrl(location);
        proxyUrl && (shouldBypassProxy(location) || (proxy = new URL(proxyUrl)));
      }
      if (isRedirect && options.headers)
        for (let name of Object.keys(options.headers))
          name.toLowerCase() === "proxy-authorization" && delete options.headers[name];
      if (isRedirect && options.agent && options.agent[kAxiosInstalledTunnel] && (options.agent = void 0), proxy) {
        let isProxyURL = proxy instanceof URL, readProxyField = (key) => isProxyURL || utils$1.hasOwnProp(proxy, key) ? proxy[key] : void 0, proxyUsername = readProxyField("username"), proxyPassword = readProxyField("password"), proxyAuth = utils$1.hasOwnProp(proxy, "auth") ? proxy.auth : void 0;
        if (proxyUsername && (proxyAuth = (proxyUsername || "") + ":" + (proxyPassword || "")), proxyAuth) {
          let authIsObject = typeof proxyAuth == "object", authUsername = authIsObject && utils$1.hasOwnProp(proxyAuth, "username") ? proxyAuth.username : void 0, authPassword = authIsObject && utils$1.hasOwnProp(proxyAuth, "password") ? proxyAuth.password : void 0;
          if (!!(authUsername || authPassword))
            proxyAuth = (authUsername || "") + ":" + (authPassword || "");
          else if (authIsObject)
            throw new AxiosError("Invalid proxy authorization", AxiosError.ERR_BAD_OPTION, {
              proxy
            });
        }
        if (isHttps.test(options.protocol)) {
          if (!(configHttpsAgent instanceof HttpsProxyAgent)) {
            let proxyHost = readProxyField("hostname") || readProxyField("host"), proxyPort = readProxyField("port"), rawProxyProtocol = readProxyField("protocol"), normalizedProtocol = rawProxyProtocol ? rawProxyProtocol.includes(":") ? rawProxyProtocol : `${rawProxyProtocol}:` : "http:", proxyHostForURL = proxyHost && proxyHost.includes(":") && !proxyHost.startsWith("[") ? `[${proxyHost}]` : proxyHost, proxyURL = new URL(`${normalizedProtocol}//${proxyHostForURL}${proxyPort ? ":" + proxyPort : ""}`), agentOptions = {
              protocol: proxyURL.protocol,
              hostname: proxyURL.hostname.replace(/^\[|\]$/g, ""),
              port: proxyURL.port,
              auth: proxyAuth && typeof proxyAuth == "string" ? proxyAuth : void 0
            };
            proxyURL.protocol === "https:" && (agentOptions.ALPNProtocols = ["http/1.1"]);
            let tunnelingAgent = getTunnelingAgent(agentOptions, configHttpsAgent);
            options.agent = tunnelingAgent, options.agents && (options.agents.https = tunnelingAgent);
          }
        } else {
          if (proxyAuth) {
            let base64 = Buffer.from(proxyAuth, "utf8").toString("base64");
            options.headers["Proxy-Authorization"] = "Basic " + base64;
          }
          let hasUserHostHeader = !1;
          for (let name of Object.keys(options.headers))
            if (name.toLowerCase() === "host") {
              hasUserHostHeader = !0;
              break;
            }
          hasUserHostHeader || (options.headers.host = options.hostname + (options.port ? ":" + options.port : ""));
          let proxyHost = readProxyField("hostname") || readProxyField("host");
          options.hostname = proxyHost, options.host = proxyHost, options.port = readProxyField("port"), options.path = location;
          let proxyProtocol = readProxyField("protocol");
          proxyProtocol && (options.protocol = proxyProtocol.includes(":") ? proxyProtocol : `${proxyProtocol}:`);
        }
      }
      options.beforeRedirects.proxy = function(redirectOptions) {
        setProxy(redirectOptions, configProxy, redirectOptions.href, !0, configHttpsAgent, configHttpAgent);
      };
    }
    var isHttpAdapterSupported = typeof process < "u" && utils$1.kindOf(process) === "process", wrapAsync = (asyncExecutor) => new Promise((resolve, reject) => {
      let onDone, isDone, done = (value, isRejected) => {
        isDone || (isDone = !0, onDone && onDone(value, isRejected));
      }, _resolve = (value) => {
        done(value), resolve(value);
      }, _reject = (reason) => {
        done(reason, !0), reject(reason);
      };
      asyncExecutor(_resolve, _reject, (onDoneHandler) => onDone = onDoneHandler).catch(_reject);
    }), resolveFamily = ({
      address,
      family
    }) => {
      if (!utils$1.isString(address))
        throw TypeError("address must be a string");
      return {
        address,
        family: family || (address.indexOf(".") < 0 ? 6 : 4)
      };
    }, buildAddressEntry = (address, family) => resolveFamily(utils$1.isObject(address) ? address : {
      address,
      family
    }), http2Transport = {
      request(options, cb) {
        let authority = options.protocol + "//" + options.hostname + ":" + (options.port || (options.protocol === "https:" ? 443 : 80)), {
          http2Options,
          headers
        } = options, session = http2Sessions.getSession(authority, http2Options), {
          HTTP2_HEADER_SCHEME,
          HTTP2_HEADER_METHOD,
          HTTP2_HEADER_PATH,
          HTTP2_HEADER_STATUS
        } = http2.constants, http2Headers = {
          [HTTP2_HEADER_SCHEME]: options.protocol.replace(":", ""),
          [HTTP2_HEADER_METHOD]: options.method,
          [HTTP2_HEADER_PATH]: options.path
        };
        utils$1.forEach(headers, (header, name) => {
          name.charAt(0) !== ":" && (http2Headers[name] = header);
        });
        let req = session.request(http2Headers);
        return req.once("response", (responseHeaders) => {
          let response = req;
          responseHeaders = Object.assign({}, responseHeaders);
          let status = responseHeaders[HTTP2_HEADER_STATUS];
          delete responseHeaders[HTTP2_HEADER_STATUS], response.headers = responseHeaders, response.statusCode = +status, cb(response);
        }), req;
      }
    }, httpAdapter = isHttpAdapterSupported && function(config) {
      return wrapAsync(async function(resolve, reject, onDone) {
        let own2 = (key) => utils$1.getSafeProp(config, key), transitional = own2("transitional") || transitionalDefaults, data = own2("data"), lookup = own2("lookup"), family = own2("family"), httpVersion = own2("httpVersion");
        httpVersion === void 0 && (httpVersion = 1);
        let http2Options = own2("http2Options"), httpAgent = own2("httpAgent"), httpsAgent = own2("httpsAgent"), configProxy = own2("proxy"), responseType = own2("responseType"), responseEncoding = own2("responseEncoding"), socketPath = own2("socketPath"), method = own2("method").toUpperCase(), maxRedirects = own2("maxRedirects"), maxBodyLength = own2("maxBodyLength"), maxContentLength = own2("maxContentLength"), decompress = own2("decompress"), isDone, rejected = !1, req, connectPhaseTimer;
        if (httpVersion = +httpVersion, Number.isNaN(httpVersion))
          throw TypeError(`Invalid protocol version: '${config.httpVersion}' is not a number`);
        if (httpVersion !== 1 && httpVersion !== 2)
          throw TypeError(`Unsupported protocol version '${httpVersion}'`);
        let isHttp2 = httpVersion === 2;
        if (lookup) {
          let _lookup = callbackify(lookup, (value) => utils$1.isArray(value) ? value : [value]);
          lookup = (hostname, opt, cb) => {
            _lookup(hostname, opt, (err, arg0, arg1) => {
              if (err)
                return cb(err);
              let addresses = utils$1.isArray(arg0) ? arg0.map((addr) => buildAddressEntry(addr)) : [buildAddressEntry(arg0, arg1)];
              opt.all ? cb(err, addresses) : cb(err, addresses[0].address, addresses[0].family);
            });
          };
        }
        let abortEmitter = new events.EventEmitter();
        function abort(reason) {
          try {
            abortEmitter.emit("abort", !reason || reason.type ? new CanceledError(null, config, req) : reason);
          } catch {
          }
        }
        function clearConnectPhaseTimer() {
          connectPhaseTimer && (clearTimeout(connectPhaseTimer), connectPhaseTimer = null);
        }
        function createTimeoutError() {
          let configTimeout = own2("timeout"), timeoutErrorMessage = configTimeout ? "timeout of " + configTimeout + "ms exceeded" : "timeout exceeded", configTimeoutErrorMessage = own2("timeoutErrorMessage");
          return configTimeoutErrorMessage && (timeoutErrorMessage = configTimeoutErrorMessage), new AxiosError(timeoutErrorMessage, transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED, config, req);
        }
        abortEmitter.once("abort", reject);
        let onFinished = () => {
          clearConnectPhaseTimer(), config.cancelToken && config.cancelToken.unsubscribe(abort), config.signal && config.signal.removeEventListener("abort", abort), abortEmitter.removeAllListeners();
        };
        (config.cancelToken || config.signal) && (config.cancelToken && config.cancelToken.subscribe(abort), config.signal && (config.signal.aborted ? abort() : config.signal.addEventListener("abort", abort))), onDone((response, isRejected) => {
          if (isDone = !0, clearConnectPhaseTimer(), isRejected) {
            rejected = !0, onFinished();
            return;
          }
          let {
            data: data2
          } = response;
          if (data2 instanceof stream.Readable || data2 instanceof stream.Duplex) {
            let offListeners = stream.finished(data2, () => {
              offListeners(), onFinished();
            });
          } else
            onFinished();
        });
        let fullPath = buildFullPath(own2("baseURL"), own2("url"), own2("allowAbsoluteUrls"), config), urlBase = socketPath ? "http://localhost" : platform.hasBrowserEnv ? platform.origin : void 0, parsed = new URL(fullPath, urlBase), protocol = parsed.protocol || supportedProtocols[0];
        if (protocol === "data:") {
          if (maxContentLength > -1) {
            let dataUrl = String(own2("url") || fullPath || "");
            if (estimateDataURLDecodedBytes(dataUrl) > maxContentLength)
              return reject(new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config));
          }
          let convertedData;
          if (method !== "GET")
            return settle(resolve, reject, {
              status: 405,
              statusText: "method not allowed",
              headers: {},
              config
            });
          try {
            convertedData = fromDataURI(own2("url"), responseType === "blob", {
              Blob: config.env && config.env.Blob
            });
          } catch (err) {
            throw AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config);
          }
          return responseType === "text" ? (convertedData = convertedData.toString(responseEncoding), (!responseEncoding || responseEncoding === "utf8") && (convertedData = utils$1.stripBOM(convertedData))) : responseType === "stream" && (convertedData = stream.Readable.from(convertedData)), settle(resolve, reject, {
            data: convertedData,
            status: 200,
            statusText: "OK",
            headers: new AxiosHeaders(),
            config
          });
        }
        if (supportedProtocols.indexOf(protocol) === -1)
          return reject(new AxiosError("Unsupported protocol " + protocol, AxiosError.ERR_BAD_REQUEST, config));
        let headers = AxiosHeaders.from(config.headers).normalize();
        headers.set("User-Agent", "axios/" + VERSION, !1);
        let {
          onUploadProgress,
          onDownloadProgress
        } = config, maxRate = config.maxRate, maxUploadRate, maxDownloadRate;
        if (utils$1.isSpecCompliantForm(data)) {
          let userBoundary = headers.getContentType(/boundary=([-_\w\d]{10,70})/i);
          data = formDataToStream(data, (formHeaders) => {
            headers.set(formHeaders);
          }, {
            tag: `axios-${VERSION}-boundary`,
            boundary: userBoundary && userBoundary[1] || void 0
          });
        } else if (utils$1.isFormData(data) && utils$1.isFunction(data.getHeaders) && data.getHeaders !== Object.prototype.getHeaders) {
          if (setFormDataHeaders$1(headers, data.getHeaders(), own2("formDataHeaderPolicy")), !headers.hasContentLength())
            try {
              let knownLength = await util.promisify(data.getLength).call(data);
              Number.isFinite(knownLength) && knownLength >= 0 && headers.setContentLength(knownLength);
            } catch {
            }
        } else if (utils$1.isBlob(data) || utils$1.isFile(data))
          data.size && headers.setContentType(data.type || "application/octet-stream"), headers.setContentLength(data.size || 0), data = stream.Readable.from(readBlob(data));
        else if (data && !utils$1.isStream(data)) {
          if (!Buffer.isBuffer(data)) if (utils$1.isArrayBuffer(data))
            data = Buffer.from(new Uint8Array(data));
          else if (utils$1.isString(data))
            data = Buffer.from(data, "utf-8");
          else
            return reject(new AxiosError("Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream", AxiosError.ERR_BAD_REQUEST, config));
          if (headers.setContentLength(data.length, !1), maxBodyLength > -1 && data.length > maxBodyLength)
            return reject(new AxiosError("Request body larger than maxBodyLength limit", AxiosError.ERR_BAD_REQUEST, config));
        }
        let contentLength = utils$1.toFiniteNumber(headers.getContentLength());
        utils$1.isArray(maxRate) ? (maxUploadRate = maxRate[0], maxDownloadRate = maxRate[1]) : maxUploadRate = maxDownloadRate = maxRate, data && (onUploadProgress || maxUploadRate) && (utils$1.isStream(data) || (data = stream.Readable.from(data, {
          objectMode: !1
        })), data = stream.pipeline([data, new AxiosTransformStream({
          maxRate: utils$1.toFiniteNumber(maxUploadRate)
        })], utils$1.noop), onUploadProgress && data.on("progress", flushOnFinish(data, progressEventDecorator(contentLength, progressEventReducer(asyncDecorator(onUploadProgress), !1, 3)))));
        let auth, configAuth = own2("auth");
        if (configAuth) {
          let username = utils$1.getSafeProp(configAuth, "username") || "", password = utils$1.getSafeProp(configAuth, "password") || "";
          auth = username + ":" + password;
        }
        if (!auth && (parsed.username || parsed.password)) {
          let urlUsername = decodeURIComponentSafe$1(parsed.username), urlPassword = decodeURIComponentSafe$1(parsed.password);
          auth = urlUsername + ":" + urlPassword;
        }
        auth && headers.delete("authorization");
        let path$1;
        try {
          path$1 = buildURL(parsed.pathname + parsed.search, own2("params"), own2("paramsSerializer")).replace(/^\?/, "");
        } catch (err) {
          return reject(AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config, null, null, {
            url: own2("url"),
            exists: !0
          }));
        }
        headers.set("Accept-Encoding", utils$1.hasOwnProp(transitional, "advertiseZstdAcceptEncoding") && transitional.advertiseZstdAcceptEncoding === !0 ? ACCEPT_ENCODING_WITH_ZSTD : ACCEPT_ENCODING, !1);
        let options = Object.assign(/* @__PURE__ */ Object.create(null), {
          path: path$1,
          method,
          headers: toByteStringHeaderObject(headers),
          agents: {
            http: httpAgent,
            https: httpsAgent
          },
          auth,
          protocol,
          family,
          beforeRedirect: dispatchBeforeRedirect,
          beforeRedirects: /* @__PURE__ */ Object.create(null),
          http2Options
        });
        if (!utils$1.isUndefined(lookup) && (options.lookup = lookup), socketPath) {
          if (typeof socketPath != "string")
            return reject(new AxiosError("socketPath must be a string", AxiosError.ERR_BAD_OPTION_VALUE, config));
          let allowedSocketPaths = own2("allowedSocketPaths");
          if (allowedSocketPaths != null) {
            let allowed = Array.isArray(allowedSocketPaths) ? allowedSocketPaths : [allowedSocketPaths], resolvedSocket = path.resolve(socketPath);
            if (!allowed.some((entry) => typeof entry == "string" && path.resolve(entry) === resolvedSocket))
              return reject(new AxiosError(`socketPath "${socketPath}" is not permitted by allowedSocketPaths`, AxiosError.ERR_BAD_OPTION_VALUE, config));
          }
          options.socketPath = socketPath;
        } else
          options.hostname = parsed.hostname.startsWith("[") ? parsed.hostname.slice(1, -1) : parsed.hostname, options.port = parsed.port, setProxy(options, configProxy, protocol + "//" + parsed.hostname + (parsed.port ? ":" + parsed.port : "") + options.path, !1, httpsAgent, httpAgent);
        let transport, isNativeTransport = !1, transportEnforcesMaxBodyLength = !1, isHttpsRequest = isHttps.test(options.protocol);
        if (options.agent == null && (options.agent = isHttpsRequest ? httpsAgent : httpAgent), isHttp2)
          transport = http2Transport;
        else {
          let configTransport = own2("transport");
          if (configTransport)
            transport = configTransport;
          else if (maxRedirects === 0)
            transport = isHttpsRequest ? https : http, isNativeTransport = !0;
          else {
            transportEnforcesMaxBodyLength = !0, options.sensitiveHeaders = [], maxRedirects && (options.maxRedirects = maxRedirects);
            let configBeforeRedirect = own2("beforeRedirect");
            if (configBeforeRedirect && (options.beforeRedirects.config = configBeforeRedirect), auth) {
              let requestOrigin = parsed.origin, authToRestore = auth;
              options.beforeRedirects.auth = function(redirectOptions) {
                try {
                  new URL(redirectOptions.href).origin === requestOrigin && (redirectOptions.auth = authToRestore);
                } catch {
                }
              };
            }
            let sensitiveHeaders = own2("sensitiveHeaders");
            if (sensitiveHeaders != null) {
              if (!utils$1.isArray(sensitiveHeaders))
                return reject(new AxiosError("sensitiveHeaders must be an array of strings", AxiosError.ERR_BAD_OPTION_VALUE, config));
              let sensitiveSet = /* @__PURE__ */ new Set();
              for (let header of sensitiveHeaders) {
                if (!utils$1.isString(header))
                  return reject(new AxiosError("sensitiveHeaders must be an array of strings", AxiosError.ERR_BAD_OPTION_VALUE, config));
                sensitiveSet.add(header.toLowerCase());
              }
              sensitiveSet.size && (options.sensitiveHeaders = Array.from(sensitiveSet), options.beforeRedirects.sensitiveHeaders = function(redirectOptions, requestDetails) {
                isSameOriginRedirect(redirectOptions, requestDetails) || stripMatchingHeaders(redirectOptions.headers, sensitiveSet);
              });
            }
            transport = isHttpsRequest ? httpsFollow : httpFollow;
          }
        }
        maxBodyLength > -1 ? options.maxBodyLength = maxBodyLength : options.maxBodyLength = 1 / 0, options.insecureHTTPParser = !!own2("insecureHTTPParser"), req = transport.request(options, function(res) {
          if (clearConnectPhaseTimer(), req.destroyed) return;
          let streams = [res], responseLength = utils$1.toFiniteNumber(res.headers["content-length"]);
          if (onDownloadProgress || maxDownloadRate) {
            let transformStream = new AxiosTransformStream({
              maxRate: utils$1.toFiniteNumber(maxDownloadRate)
            });
            onDownloadProgress && transformStream.on("progress", flushOnFinish(transformStream, progressEventDecorator(responseLength, progressEventReducer(asyncDecorator(onDownloadProgress), !0, 3)))), streams.push(transformStream);
          }
          let responseStream = res, lastRequest = res.req || req;
          if (decompress !== !1 && res.headers["content-encoding"])
            switch ((method === "HEAD" || res.statusCode === 204) && delete res.headers["content-encoding"], (res.headers["content-encoding"] || "").toLowerCase()) {
              /*eslint default-case:0*/
              case "gzip":
              case "x-gzip":
              case "compress":
              case "x-compress":
                streams.push(zlib.createUnzip(zlibOptions)), delete res.headers["content-encoding"];
                break;
              case "deflate":
                streams.push(new ZlibHeaderTransformStream()), streams.push(zlib.createUnzip(zlibOptions)), delete res.headers["content-encoding"];
                break;
              case "br":
                isBrotliSupported && (streams.push(zlib.createBrotliDecompress(brotliOptions)), delete res.headers["content-encoding"]);
                break;
              case "zstd":
                isZstdSupported && (streams.push(zlib.createZstdDecompress(zstdOptions)), delete res.headers["content-encoding"]);
                break;
            }
          responseStream = streams.length > 1 ? stream.pipeline(streams, utils$1.noop) : streams[0];
          let response = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: new AxiosHeaders(res.headers),
            config,
            request: lastRequest
          };
          if (responseType === "stream") {
            if (maxContentLength > -1) {
              let limit = maxContentLength, source = responseStream;
              async function* enforceMaxContentLength() {
                let totalResponseBytes = 0;
                for await (let chunk of source) {
                  if (totalResponseBytes += chunk.length, totalResponseBytes > limit)
                    throw new AxiosError("maxContentLength size of " + limit + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, lastRequest);
                  yield chunk;
                }
              }
              responseStream = stream.Readable.from(enforceMaxContentLength(), {
                objectMode: !1
              });
            }
            response.data = responseStream, settle(resolve, reject, response);
          } else {
            let responseBuffer = [], totalResponseBytes = 0;
            responseStream.on("data", function(chunk) {
              responseBuffer.push(chunk), totalResponseBytes += chunk.length, maxContentLength > -1 && totalResponseBytes > maxContentLength && (rejected = !0, responseStream.destroy(), abort(new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, lastRequest)));
            }), responseStream.on("aborted", function() {
              if (rejected)
                return;
              let err = new AxiosError("stream has been aborted", AxiosError.ERR_BAD_RESPONSE, config, lastRequest, response);
              responseStream.destroy(err), reject(err);
            }), responseStream.on("error", function(err) {
              rejected || reject(AxiosError.from(err, null, config, lastRequest, response));
            }), responseStream.on("end", function() {
              try {
                let responseData = responseBuffer.length === 1 ? responseBuffer[0] : Buffer.concat(responseBuffer);
                responseType !== "arraybuffer" && (responseData = responseData.toString(responseEncoding), (!responseEncoding || responseEncoding === "utf8") && (responseData = utils$1.stripBOM(responseData))), response.data = responseData;
              } catch (err) {
                return reject(AxiosError.from(err, null, config, response.request, response));
              }
              settle(resolve, reject, response);
            });
          }
          abortEmitter.once("abort", (err) => {
            responseStream.destroyed || (responseStream.emit("error", err), responseStream.destroy());
          });
        }), abortEmitter.once("abort", (err) => {
          req.close ? req.close() : req.destroy(err);
        }), req.on("error", function(err) {
          reject(AxiosError.from(err, null, config, req));
        });
        let boundSockets = /* @__PURE__ */ new Set();
        if (req.on("socket", function(socket) {
          typeof socket.setKeepAlive == "function" && socket.setKeepAlive(!0, 1e3 * 60), socket[kAxiosSocketListener] || (socket.on("error", function(err) {
            let current = socket[kAxiosCurrentReq];
            current && !current.destroyed && current.destroy(err);
          }), socket[kAxiosSocketListener] = !0), socket[kAxiosCurrentReq] = req, boundSockets.add(socket);
        }), req.once("close", function() {
          clearConnectPhaseTimer();
          for (let socket of boundSockets)
            socket[kAxiosCurrentReq] === req && (socket[kAxiosCurrentReq] = null);
          boundSockets.clear();
        }), own2("timeout")) {
          let timeout = parseInt(own2("timeout"), 10);
          if (Number.isNaN(timeout)) {
            abort(new AxiosError("error trying to parse `config.timeout` to int", AxiosError.ERR_BAD_OPTION_VALUE, config, req));
            return;
          }
          let handleTimeout = function() {
            isDone || abort(createTimeoutError());
          };
          isNativeTransport && timeout > 0 && (connectPhaseTimer = setTimeout(handleTimeout, timeout)), req.setTimeout(timeout, handleTimeout);
        } else
          req.setTimeout(0);
        if (utils$1.isStream(data)) {
          let ended = !1, errored = !1;
          data.on("end", () => {
            ended = !0;
          }), data.once("error", (err) => {
            errored = !0, req.destroy(err);
          }), data.on("close", () => {
            !ended && !errored && abort(new CanceledError("Request stream has been aborted", config, req));
          });
          let uploadStream = data;
          if (maxBodyLength > -1 && !transportEnforcesMaxBodyLength) {
            let limit = maxBodyLength, bytesSent = 0;
            uploadStream = stream.pipeline([data, new stream.Transform({
              transform(chunk, _enc, cb) {
                if (bytesSent += chunk.length, bytesSent > limit)
                  return cb(new AxiosError("Request body larger than maxBodyLength limit", AxiosError.ERR_BAD_REQUEST, config, req));
                cb(null, chunk);
              }
            })], utils$1.noop), uploadStream.on("error", (err) => {
              req.destroyed || req.destroy(err);
            });
          }
          uploadStream.pipe(req);
        } else
          data && req.write(data), req.end();
      });
    }, isURLSameOrigin = platform.hasStandardBrowserEnv ? /* @__PURE__ */ ((origin2, isMSIE) => (url2) => (url2 = new URL(url2, platform.origin), origin2.protocol === url2.protocol && origin2.host === url2.host && (isMSIE || origin2.port === url2.port)))(new URL(platform.origin), platform.navigator && /(msie|trident)/i.test(platform.navigator.userAgent)) : () => !0, cookies = platform.hasStandardBrowserEnv ? (
      // Standard browser envs support document.cookie
      {
        write(name, value, expires, path2, domain, secure, sameSite) {
          if (typeof document > "u") return;
          let cookie = [`${name}=${encodeURIComponent(value)}`];
          utils$1.isNumber(expires) && cookie.push(`expires=${new Date(expires).toUTCString()}`), utils$1.isString(path2) && cookie.push(`path=${path2}`), utils$1.isString(domain) && cookie.push(`domain=${domain}`), secure === !0 && cookie.push("secure"), utils$1.isString(sameSite) && cookie.push(`SameSite=${sameSite}`), document.cookie = cookie.join("; ");
        },
        read(name) {
          if (typeof document > "u") return null;
          let cookies2 = document.cookie.split(";");
          for (let i = 0; i < cookies2.length; i++) {
            let cookie = cookies2[i].replace(/^\s+/, ""), eq = cookie.indexOf("=");
            if (eq !== -1 && cookie.slice(0, eq) === name)
              try {
                return decodeURIComponent(cookie.slice(eq + 1));
              } catch {
                return cookie.slice(eq + 1);
              }
          }
          return null;
        },
        remove(name) {
          this.write(name, "", Date.now() - 864e5, "/");
        }
      }
    ) : (
      // Non-standard browser env (web workers, react-native) lack needed support.
      {
        write() {
        },
        read() {
          return null;
        },
        remove() {
        }
      }
    ), headersToObject = (thing) => thing instanceof AxiosHeaders ? {
      ...thing
    } : thing;
    function mergeConfig(config1, config2) {
      config1 = config1 || {}, config2 = config2 || {};
      let config = /* @__PURE__ */ Object.create(null);
      Object.defineProperty(config, "hasOwnProperty", {
        // Null-proto descriptor so a polluted Object.prototype.get cannot turn
        // this data descriptor into an accessor descriptor on the way in.
        __proto__: null,
        value: Object.prototype.hasOwnProperty,
        enumerable: !1,
        writable: !0,
        configurable: !0
      });
      function getMergedValue(target, source, prop, caseless) {
        return utils$1.isPlainObject(target) && utils$1.isPlainObject(source) ? utils$1.merge.call({
          caseless
        }, target, source) : utils$1.isPlainObject(source) ? utils$1.merge({}, source) : utils$1.isArray(source) ? source.slice() : source;
      }
      function mergeDeepProperties(a, b, prop, caseless) {
        if (utils$1.isUndefined(b)) {
          if (!utils$1.isUndefined(a))
            return getMergedValue(void 0, a, prop, caseless);
        } else return getMergedValue(a, b, prop, caseless);
      }
      function valueFromConfig2(a, b) {
        if (!utils$1.isUndefined(b))
          return getMergedValue(void 0, b);
      }
      function defaultToConfig2(a, b) {
        if (utils$1.isUndefined(b)) {
          if (!utils$1.isUndefined(a))
            return getMergedValue(void 0, a);
        } else return getMergedValue(void 0, b);
      }
      function getMergedTransitionalOption(prop) {
        let transitional2 = utils$1.hasOwnProp(config2, "transitional") ? config2.transitional : void 0;
        if (!utils$1.isUndefined(transitional2))
          if (utils$1.isPlainObject(transitional2)) {
            if (utils$1.hasOwnProp(transitional2, prop))
              return transitional2[prop];
          } else
            return;
        let transitional1 = utils$1.hasOwnProp(config1, "transitional") ? config1.transitional : void 0;
        if (utils$1.isPlainObject(transitional1) && utils$1.hasOwnProp(transitional1, prop))
          return transitional1[prop];
      }
      function mergeDirectKeys(a, b, prop) {
        if (utils$1.hasOwnProp(config2, prop))
          return getMergedValue(a, b);
        if (utils$1.hasOwnProp(config1, prop))
          return getMergedValue(void 0, a);
      }
      let mergeMap = {
        url: valueFromConfig2,
        method: valueFromConfig2,
        data: valueFromConfig2,
        baseURL: defaultToConfig2,
        transformRequest: defaultToConfig2,
        transformResponse: defaultToConfig2,
        paramsSerializer: defaultToConfig2,
        timeout: defaultToConfig2,
        timeoutMessage: defaultToConfig2,
        withCredentials: defaultToConfig2,
        withXSRFToken: defaultToConfig2,
        adapter: defaultToConfig2,
        responseType: defaultToConfig2,
        xsrfCookieName: defaultToConfig2,
        xsrfHeaderName: defaultToConfig2,
        onUploadProgress: defaultToConfig2,
        onDownloadProgress: defaultToConfig2,
        decompress: defaultToConfig2,
        maxContentLength: defaultToConfig2,
        maxBodyLength: defaultToConfig2,
        beforeRedirect: defaultToConfig2,
        transport: defaultToConfig2,
        httpAgent: defaultToConfig2,
        httpsAgent: defaultToConfig2,
        cancelToken: defaultToConfig2,
        socketPath: defaultToConfig2,
        allowedSocketPaths: defaultToConfig2,
        responseEncoding: defaultToConfig2,
        validateStatus: mergeDirectKeys,
        headers: (a, b, prop) => mergeDeepProperties(headersToObject(a), headersToObject(b), prop, !0)
      };
      return utils$1.forEach(Object.keys({
        ...config1,
        ...config2
      }), function(prop) {
        if (prop === "__proto__" || prop === "constructor" || prop === "prototype") return;
        let merge2 = utils$1.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties, a = utils$1.hasOwnProp(config1, prop) ? config1[prop] : void 0, b = utils$1.hasOwnProp(config2, prop) ? config2[prop] : void 0, configValue = merge2(a, b, prop);
        utils$1.isUndefined(configValue) && merge2 !== mergeDirectKeys || (config[prop] = configValue);
      }), utils$1.hasOwnProp(config2, "validateStatus") && utils$1.isUndefined(config2.validateStatus) && getMergedTransitionalOption("validateStatusUndefinedResolves") === !1 && (utils$1.hasOwnProp(config1, "validateStatus") ? config.validateStatus = getMergedValue(void 0, config1.validateStatus) : delete config.validateStatus), config;
    }
    var FORM_DATA_CONTENT_HEADERS = ["content-type", "content-length"];
    function setFormDataHeaders(headers, formHeaders, policy) {
      if (policy !== "content-only") {
        headers.set(formHeaders);
        return;
      }
      Object.entries(formHeaders || {}).forEach(([key, val]) => {
        FORM_DATA_CONTENT_HEADERS.includes(key.toLowerCase()) && headers.set(key, val);
      });
    }
    var encodeUTF8$1 = (str) => encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    function resolveConfig(config) {
      let newConfig = mergeConfig({}, config), own2 = (key) => utils$1.hasOwnProp(newConfig, key) ? newConfig[key] : void 0, data = own2("data"), withXSRFToken = own2("withXSRFToken"), xsrfHeaderName = own2("xsrfHeaderName"), xsrfCookieName = own2("xsrfCookieName"), headers = own2("headers"), auth = own2("auth"), baseURL = own2("baseURL"), allowAbsoluteUrls = own2("allowAbsoluteUrls"), url2 = own2("url");
      if (newConfig.headers = headers = AxiosHeaders.from(headers), newConfig.url = buildURL(buildFullPath(baseURL, url2, allowAbsoluteUrls, newConfig), own2("params"), own2("paramsSerializer")), auth) {
        let username = utils$1.getSafeProp(auth, "username") || "", password = utils$1.getSafeProp(auth, "password") || "";
        try {
          headers.set("Authorization", "Basic " + btoa(username + ":" + (password ? encodeUTF8$1(password) : "")));
        } catch (e) {
          throw AxiosError.from(e, AxiosError.ERR_BAD_OPTION_VALUE, config);
        }
      }
      if (utils$1.isFormData(data) && (platform.hasStandardBrowserEnv || platform.hasStandardBrowserWebWorkerEnv || utils$1.isReactNative(data) ? headers.setContentType(void 0) : utils$1.isFunction(data.getHeaders) && setFormDataHeaders(headers, data.getHeaders(), own2("formDataHeaderPolicy"))), platform.hasStandardBrowserEnv && (utils$1.isFunction(withXSRFToken) && (withXSRFToken = withXSRFToken(newConfig)), withXSRFToken === !0 || withXSRFToken == null && isURLSameOrigin(newConfig.url))) {
        let xsrfValue = xsrfHeaderName && xsrfCookieName && cookies.read(xsrfCookieName);
        xsrfValue && headers.set(xsrfHeaderName, xsrfValue);
      }
      return newConfig;
    }
    var isXHRAdapterSupported = typeof XMLHttpRequest < "u", xhrAdapter = isXHRAdapterSupported && function(config) {
      return new Promise(function(resolve, reject) {
        let _config = resolveConfig(config), requestData = _config.data, requestHeaders = AxiosHeaders.from(_config.headers).normalize(), {
          responseType,
          onUploadProgress,
          onDownloadProgress
        } = _config, onCanceled, uploadThrottled, downloadThrottled, flushUpload, flushDownload;
        function done() {
          flushUpload && flushUpload(), flushDownload && flushDownload(), _config.cancelToken && _config.cancelToken.unsubscribe(onCanceled), _config.signal && _config.signal.removeEventListener("abort", onCanceled);
        }
        let request = new XMLHttpRequest();
        request.open(_config.method.toUpperCase(), _config.url, !0), request.timeout = _config.timeout;
        function onloadend() {
          if (!request)
            return;
          let responseHeaders = AxiosHeaders.from("getAllResponseHeaders" in request && request.getAllResponseHeaders()), response = {
            data: !responseType || responseType === "text" || responseType === "json" ? request.responseText : request.response,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config,
            request
          };
          settle(function(value) {
            resolve(value), done();
          }, function(err) {
            reject(err), done();
          }, response), request = null;
        }
        "onloadend" in request ? request.onloadend = onloadend : request.onreadystatechange = function() {
          !request || request.readyState !== 4 || request.status === 0 && !(request.responseURL && request.responseURL.startsWith("file:")) || setTimeout(onloadend);
        }, request.onabort = function() {
          request && (reject(new AxiosError("Request aborted", AxiosError.ECONNABORTED, config, request)), done(), request = null);
        }, request.onerror = function(event) {
          let msg = event && event.message ? event.message : "Network Error", err = new AxiosError(msg, AxiosError.ERR_NETWORK, config, request);
          err.event = event || null, reject(err), done(), request = null;
        }, request.ontimeout = function() {
          let timeoutErrorMessage = _config.timeout ? "timeout of " + _config.timeout + "ms exceeded" : "timeout exceeded", transitional = _config.transitional || transitionalDefaults;
          _config.timeoutErrorMessage && (timeoutErrorMessage = _config.timeoutErrorMessage), reject(new AxiosError(timeoutErrorMessage, transitional.clarifyTimeoutError ? AxiosError.ETIMEDOUT : AxiosError.ECONNABORTED, config, request)), done(), request = null;
        }, requestData === void 0 && requestHeaders.setContentType(null), "setRequestHeader" in request && utils$1.forEach(toByteStringHeaderObject(requestHeaders), function(val, key) {
          request.setRequestHeader(key, val);
        }), utils$1.isUndefined(_config.withCredentials) || (request.withCredentials = !!_config.withCredentials), responseType && responseType !== "json" && (request.responseType = _config.responseType), onDownloadProgress && ([downloadThrottled, flushDownload] = progressEventReducer(onDownloadProgress, !0), request.addEventListener("progress", downloadThrottled)), onUploadProgress && request.upload && ([uploadThrottled, flushUpload] = progressEventReducer(onUploadProgress), request.upload.addEventListener("progress", uploadThrottled), request.upload.addEventListener("loadend", flushUpload)), (_config.cancelToken || _config.signal) && (onCanceled = (cancel) => {
          request && (reject(!cancel || cancel.type ? new CanceledError(null, config, request) : cancel), request.abort(), done(), request = null);
        }, _config.cancelToken && _config.cancelToken.subscribe(onCanceled), _config.signal && (_config.signal.aborted ? onCanceled() : _config.signal.addEventListener("abort", onCanceled)));
        let protocol = parseProtocol(_config.url);
        if (protocol && !platform.protocols.includes(protocol)) {
          reject(new AxiosError("Unsupported protocol " + protocol + ":", AxiosError.ERR_BAD_REQUEST, config)), done();
          return;
        }
        request.send(requestData || null);
      });
    }, composeSignals = (signals, timeout) => {
      if (signals = signals ? signals.filter(Boolean) : [], !timeout && !signals.length)
        return;
      let controller = new AbortController(), aborted = !1, onabort = function(reason) {
        if (!aborted) {
          aborted = !0, unsubscribe();
          let err = reason instanceof Error ? reason : this.reason;
          controller.abort(err instanceof AxiosError ? err : new CanceledError(err instanceof Error ? err.message : err));
        }
      }, timer = timeout && setTimeout(() => {
        timer = null, onabort(new AxiosError(`timeout of ${timeout}ms exceeded`, AxiosError.ETIMEDOUT));
      }, timeout), unsubscribe = () => {
        signals && (timer && clearTimeout(timer), timer = null, signals.forEach((signal2) => {
          signal2.unsubscribe ? signal2.unsubscribe(onabort) : signal2.removeEventListener("abort", onabort);
        }), signals = null);
      };
      signals.forEach((signal2) => signal2.addEventListener("abort", onabort, {
        once: !0
      }));
      let {
        signal
      } = controller;
      return signal.unsubscribe = () => utils$1.asap(unsubscribe), signal;
    }, streamChunk = function* (chunk, chunkSize) {
      let len = chunk.byteLength;
      if (len < chunkSize) {
        yield chunk;
        return;
      }
      let pos = 0, end;
      for (; pos < len; )
        end = pos + chunkSize, yield chunk.slice(pos, end), pos = end;
    }, readBytes = async function* (iterable, chunkSize) {
      for await (let chunk of readStream(iterable))
        yield* streamChunk(chunk, chunkSize);
    }, readStream = async function* (stream2) {
      if (stream2[Symbol.asyncIterator]) {
        yield* stream2;
        return;
      }
      let reader = stream2.getReader();
      try {
        for (; ; ) {
          let {
            done,
            value
          } = await reader.read();
          if (done)
            break;
          yield value;
        }
      } finally {
        await reader.cancel();
      }
    }, trackStream = (stream2, chunkSize, onProgress, onFinish) => {
      let iterator2 = readBytes(stream2, chunkSize), bytes = 0, done, _onFinish = (e) => {
        done || (done = !0, onFinish && onFinish(e));
      };
      return new ReadableStream({
        async pull(controller) {
          try {
            let {
              done: done2,
              value
            } = await iterator2.next();
            if (done2) {
              _onFinish(), controller.close();
              return;
            }
            let len = value.byteLength;
            if (onProgress) {
              let loadedBytes = bytes += len;
              onProgress(loadedBytes);
            }
            controller.enqueue(new Uint8Array(value));
          } catch (err) {
            throw _onFinish(err), err;
          }
        },
        cancel(reason) {
          return _onFinish(reason), iterator2.return();
        }
      }, {
        highWaterMark: 2
      });
    }, DEFAULT_CHUNK_SIZE = 64 * 1024, {
      isFunction
    } = utils$1, encodeUTF8 = (str) => encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))), decodeURIComponentSafe = (value) => {
      if (!utils$1.isString(value))
        return value;
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }, test = (fn, ...args) => {
      try {
        return !!fn(...args);
      } catch {
        return !1;
      }
    }, maybeWithAuthCredentials = (url2) => {
      let protocolIndex = url2.indexOf("://"), urlToCheck = url2;
      return protocolIndex !== -1 && (urlToCheck = urlToCheck.slice(protocolIndex + 3)), urlToCheck.includes("@") || urlToCheck.includes(":");
    }, factory = (env) => {
      let globalObject = utils$1.global !== void 0 && utils$1.global !== null ? utils$1.global : globalThis, {
        ReadableStream: ReadableStream2,
        TextEncoder: TextEncoder2
      } = globalObject;
      env = utils$1.merge.call({
        skipUndefined: !0
      }, {
        Request: globalObject.Request,
        Response: globalObject.Response
      }, env);
      let {
        fetch: envFetch,
        Request,
        Response
      } = env, isFetchSupported = envFetch ? isFunction(envFetch) : typeof fetch == "function", isRequestSupported = isFunction(Request), isResponseSupported = isFunction(Response);
      if (!isFetchSupported)
        return !1;
      let isReadableStreamSupported = isFetchSupported && isFunction(ReadableStream2), encodeText = isFetchSupported && (typeof TextEncoder2 == "function" ? /* @__PURE__ */ ((encoder) => (str) => encoder.encode(str))(new TextEncoder2()) : async (str) => new Uint8Array(await new Request(str).arrayBuffer())), supportsRequestStream = isRequestSupported && isReadableStreamSupported && test(() => {
        let duplexAccessed = !1, request = new Request(platform.origin, {
          body: new ReadableStream2(),
          method: "POST",
          get duplex() {
            return duplexAccessed = !0, "half";
          }
        }), hasContentType = request.headers.has("Content-Type");
        return request.body != null && request.body.cancel(), duplexAccessed && !hasContentType;
      }), supportsResponseStream = isResponseSupported && isReadableStreamSupported && test(() => utils$1.isReadableStream(new Response("").body)), resolvers = {
        stream: supportsResponseStream && ((res) => res.body)
      };
      isFetchSupported && ["text", "arrayBuffer", "blob", "formData", "stream"].forEach((type) => {
        !resolvers[type] && (resolvers[type] = (res, config) => {
          let method = res && res[type];
          if (method)
            return method.call(res);
          throw new AxiosError(`Response type '${type}' is not supported`, AxiosError.ERR_NOT_SUPPORT, config);
        });
      });
      let getBodyLength = async (body) => {
        if (body == null)
          return 0;
        if (utils$1.isBlob(body))
          return body.size;
        if (utils$1.isSpecCompliantForm(body))
          return (await new Request(platform.origin, {
            method: "POST",
            body
          }).arrayBuffer()).byteLength;
        if (utils$1.isArrayBufferView(body) || utils$1.isArrayBuffer(body))
          return body.byteLength;
        if (utils$1.isURLSearchParams(body) && (body = body + ""), utils$1.isString(body))
          return (await encodeText(body)).byteLength;
      }, resolveBodyLength = async (headers, body) => {
        let length = utils$1.toFiniteNumber(headers.getContentLength());
        return length ?? getBodyLength(body);
      };
      return async (config) => {
        let {
          url: url2,
          method,
          data,
          signal,
          cancelToken,
          timeout,
          onDownloadProgress,
          onUploadProgress,
          responseType,
          headers,
          withCredentials = "same-origin",
          fetchOptions,
          maxContentLength,
          maxBodyLength
        } = resolveConfig(config), hasMaxContentLength = utils$1.isNumber(maxContentLength) && maxContentLength > -1, hasMaxBodyLength = utils$1.isNumber(maxBodyLength) && maxBodyLength > -1, own2 = (key) => utils$1.hasOwnProp(config, key) ? config[key] : void 0, _fetch = envFetch || fetch;
        responseType = responseType ? (responseType + "").toLowerCase() : "text";
        let composedSignal = composeSignals([signal, cancelToken && cancelToken.toAbortSignal()], timeout), request = null, unsubscribe = composedSignal && composedSignal.unsubscribe && (() => {
          composedSignal.unsubscribe();
        }), requestContentLength, pendingBodyError = null, maxBodyLengthError = () => new AxiosError("Request body larger than maxBodyLength limit", AxiosError.ERR_BAD_REQUEST, config, request);
        try {
          let auth, configAuth = own2("auth");
          if (configAuth) {
            let username = utils$1.getSafeProp(configAuth, "username") || "", password = utils$1.getSafeProp(configAuth, "password") || "";
            auth = {
              username,
              password
            };
          }
          if (maybeWithAuthCredentials(url2)) {
            let parsedURL = new URL(url2, platform.origin);
            if (!auth && (parsedURL.username || parsedURL.password)) {
              let urlUsername = decodeURIComponentSafe(parsedURL.username), urlPassword = decodeURIComponentSafe(parsedURL.password);
              auth = {
                username: urlUsername,
                password: urlPassword
              };
            }
            (parsedURL.username || parsedURL.password) && (parsedURL.username = "", parsedURL.password = "", url2 = parsedURL.href);
          }
          if (auth && (headers.delete("authorization"), headers.set("Authorization", "Basic " + btoa(encodeUTF8((auth.username || "") + ":" + (auth.password || ""))))), hasMaxContentLength && typeof url2 == "string" && url2.startsWith("data:") && estimateDataURLDecodedBytes(url2) > maxContentLength)
            throw new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, request);
          if (hasMaxBodyLength && method !== "get" && method !== "head") {
            let outboundLength = await getBodyLength(data);
            if (typeof outboundLength == "number" && isFinite(outboundLength) && (requestContentLength = outboundLength, outboundLength > maxBodyLength))
              throw maxBodyLengthError();
          }
          let mustEnforceStreamBody = hasMaxBodyLength && (utils$1.isReadableStream(data) || utils$1.isStream(data)), trackRequestStream = (stream2, onProgress, flush) => trackStream(stream2, DEFAULT_CHUNK_SIZE, (loadedBytes) => {
            if (hasMaxBodyLength && loadedBytes > maxBodyLength)
              throw pendingBodyError = maxBodyLengthError();
            onProgress && onProgress(loadedBytes);
          }, flush);
          if (supportsRequestStream && method !== "get" && method !== "head" && (onUploadProgress || mustEnforceStreamBody)) {
            if (requestContentLength = requestContentLength ?? await resolveBodyLength(headers, data), requestContentLength !== 0 || mustEnforceStreamBody) {
              let _request = new Request(url2, {
                method: "POST",
                body: data,
                duplex: "half"
              }), contentTypeHeader;
              if (utils$1.isFormData(data) && (contentTypeHeader = _request.headers.get("content-type")) && headers.setContentType(contentTypeHeader), _request.body) {
                let [onProgress, flush] = onUploadProgress && progressEventDecorator(requestContentLength, progressEventReducer(asyncDecorator(onUploadProgress))) || [];
                data = trackRequestStream(_request.body, onProgress, flush);
              }
            }
          } else if (mustEnforceStreamBody && !isRequestSupported && isReadableStreamSupported && method !== "get" && method !== "head")
            data = trackRequestStream(data);
          else if (mustEnforceStreamBody && isRequestSupported && !supportsRequestStream && method !== "get" && method !== "head")
            throw new AxiosError("Stream request bodies are not supported by the current fetch implementation", AxiosError.ERR_NOT_SUPPORT, config, request);
          utils$1.isString(withCredentials) || (withCredentials = withCredentials ? "include" : "omit");
          let isCredentialsSupported = isRequestSupported && "credentials" in Request.prototype;
          if (utils$1.isFormData(data)) {
            let contentType = headers.getContentType();
            contentType && /^multipart\/form-data/i.test(contentType) && !/boundary=/i.test(contentType) && headers.delete("content-type");
          }
          headers.set("User-Agent", "axios/" + VERSION, !1);
          let resolvedOptions = {
            ...fetchOptions,
            signal: composedSignal,
            method: method.toUpperCase(),
            headers: toByteStringHeaderObject(headers.normalize()),
            body: data,
            duplex: "half",
            credentials: isCredentialsSupported ? withCredentials : void 0
          };
          request = isRequestSupported && new Request(url2, resolvedOptions);
          let response = await (isRequestSupported ? _fetch(request, fetchOptions) : _fetch(url2, resolvedOptions)), responseHeaders = AxiosHeaders.from(response.headers);
          if (hasMaxContentLength) {
            let declaredLength = utils$1.toFiniteNumber(responseHeaders.getContentLength());
            if (declaredLength != null && declaredLength > maxContentLength)
              throw new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, request);
          }
          let isStreamResponse = supportsResponseStream && (responseType === "stream" || responseType === "response");
          if (supportsResponseStream && response.body && (onDownloadProgress || hasMaxContentLength || isStreamResponse && unsubscribe)) {
            let options = {};
            ["status", "statusText", "headers"].forEach((prop) => {
              options[prop] = response[prop];
            });
            let responseContentLength = utils$1.toFiniteNumber(responseHeaders.getContentLength()), [onProgress, flush] = onDownloadProgress && progressEventDecorator(responseContentLength, progressEventReducer(asyncDecorator(onDownloadProgress), !0)) || [], bytesRead = 0, onChunkProgress = (loadedBytes) => {
              if (hasMaxContentLength && (bytesRead = loadedBytes, bytesRead > maxContentLength))
                throw new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, request);
              onProgress && onProgress(loadedBytes);
            };
            response = new Response(trackStream(response.body, DEFAULT_CHUNK_SIZE, onChunkProgress, () => {
              flush && flush(), unsubscribe && unsubscribe();
            }), options);
          }
          responseType = responseType || "text";
          let responseData = await resolvers[utils$1.findKey(resolvers, responseType) || "text"](response, config);
          if (hasMaxContentLength && !supportsResponseStream && !isStreamResponse) {
            let materializedSize;
            if (responseData != null && (typeof responseData.byteLength == "number" ? materializedSize = responseData.byteLength : typeof responseData.size == "number" ? materializedSize = responseData.size : typeof responseData == "string" && (materializedSize = typeof TextEncoder2 == "function" ? new TextEncoder2().encode(responseData).byteLength : responseData.length)), typeof materializedSize == "number" && materializedSize > maxContentLength)
              throw new AxiosError("maxContentLength size of " + maxContentLength + " exceeded", AxiosError.ERR_BAD_RESPONSE, config, request);
          }
          return !isStreamResponse && unsubscribe && unsubscribe(), await new Promise((resolve, reject) => {
            settle(resolve, reject, {
              data: responseData,
              headers: AxiosHeaders.from(response.headers),
              status: response.status,
              statusText: response.statusText,
              config,
              request
            });
          });
        } catch (err) {
          if (unsubscribe && unsubscribe(), composedSignal && composedSignal.aborted && composedSignal.reason instanceof AxiosError) {
            let canceledError = composedSignal.reason;
            throw canceledError.config = config, request && (canceledError.request = request), err !== canceledError && Object.defineProperty(canceledError, "cause", {
              __proto__: null,
              value: err,
              writable: !0,
              enumerable: !1,
              configurable: !0
            }), canceledError;
          }
          if (pendingBodyError)
            throw request && !pendingBodyError.request && (pendingBodyError.request = request), pendingBodyError;
          if (err instanceof AxiosError)
            throw request && !err.request && (err.request = request), err;
          if (err && err.name === "TypeError" && /Load failed|fetch/i.test(err.message)) {
            let networkError = new AxiosError("Network Error", AxiosError.ERR_NETWORK, config, request, err && err.response);
            throw Object.defineProperty(networkError, "cause", {
              __proto__: null,
              value: err.cause || err,
              writable: !0,
              enumerable: !1,
              configurable: !0
            }), networkError;
          }
          throw AxiosError.from(err, err && err.code, config, request, err && err.response);
        }
      };
    }, seedCache = /* @__PURE__ */ new Map(), getFetch = (config) => {
      let env = config && config.env || {}, {
        fetch: fetch2,
        Request,
        Response
      } = env, seeds = [Request, Response, fetch2], len = seeds.length, i = len, seed, target, map = seedCache;
      for (; i--; )
        seed = seeds[i], target = map.get(seed), target === void 0 && map.set(seed, target = i ? /* @__PURE__ */ new Map() : factory(env)), map = target;
      return target;
    };
    getFetch();
    var knownAdapters = {
      http: httpAdapter,
      xhr: xhrAdapter,
      fetch: {
        get: getFetch
      }
    };
    utils$1.forEach(knownAdapters, (fn, value) => {
      if (fn) {
        try {
          Object.defineProperty(fn, "name", {
            __proto__: null,
            value
          });
        } catch {
        }
        Object.defineProperty(fn, "adapterName", {
          __proto__: null,
          value
        });
      }
    });
    var renderReason = (reason) => `- ${reason}`, isResolvedHandle = (adapter) => utils$1.isFunction(adapter) || adapter === null || adapter === !1;
    function getAdapter(adapters2, config) {
      adapters2 = utils$1.isArray(adapters2) ? adapters2 : [adapters2];
      let {
        length
      } = adapters2, nameOrAdapter, adapter, rejectedReasons = {};
      for (let i = 0; i < length; i++) {
        nameOrAdapter = adapters2[i];
        let id;
        if (adapter = nameOrAdapter, !isResolvedHandle(nameOrAdapter) && (adapter = knownAdapters[(id = String(nameOrAdapter)).toLowerCase()], adapter === void 0))
          throw new AxiosError(`Unknown adapter '${id}'`);
        if (adapter && (utils$1.isFunction(adapter) || (adapter = adapter.get(config))))
          break;
        rejectedReasons[id || "#" + i] = adapter;
      }
      if (!adapter) {
        let reasons = Object.entries(rejectedReasons).map(([id, state]) => `adapter ${id} ` + (state === !1 ? "is not supported by the environment" : "is not available in the build")), s = length ? reasons.length > 1 ? `since :
` + reasons.map(renderReason).join(`
`) : " " + renderReason(reasons[0]) : "as no adapter specified";
        throw new AxiosError("There is no suitable adapter to dispatch the request " + s, AxiosError.ERR_NOT_SUPPORT);
      }
      return adapter;
    }
    var adapters = {
      /**
       * Resolve an adapter from a list of adapter names or functions.
       * @type {Function}
       */
      getAdapter,
      /**
       * Exposes all known adapters
       * @type {Object<string, Function|Object>}
       */
      adapters: knownAdapters
    };
    function throwIfCancellationRequested(config) {
      if (config.cancelToken && config.cancelToken.throwIfRequested(), config.signal && config.signal.aborted)
        throw new CanceledError(null, config);
    }
    function dispatchRequest(config) {
      return throwIfCancellationRequested(config), config.headers = AxiosHeaders.from(config.headers), config.data = transformData.call(config, config.transformRequest), ["post", "put", "patch"].indexOf(config.method) !== -1 && config.headers.setContentType("application/x-www-form-urlencoded", !1), adapters.getAdapter(config.adapter || defaults.adapter, config)(config).then(function(response) {
        throwIfCancellationRequested(config), config.response = response;
        try {
          response.data = transformData.call(config, config.transformResponse, response);
        } finally {
          delete config.response;
        }
        return response.headers = AxiosHeaders.from(response.headers), response;
      }, function(reason) {
        if (!isCancel(reason) && (throwIfCancellationRequested(config), reason && reason.response)) {
          config.response = reason.response;
          try {
            reason.response.data = transformData.call(config, config.transformResponse, reason.response);
          } finally {
            delete config.response;
          }
          reason.response.headers = AxiosHeaders.from(reason.response.headers);
        }
        return Promise.reject(reason);
      });
    }
    var validators$1 = {};
    ["object", "boolean", "number", "function", "string", "symbol"].forEach((type, i) => {
      validators$1[type] = function(thing) {
        return typeof thing === type || "a" + (i < 1 ? "n " : " ") + type;
      };
    });
    var deprecatedWarnings = {};
    validators$1.transitional = function(validator2, version, message) {
      function formatMessage(opt, desc) {
        return "[Axios v" + VERSION + "] Transitional option '" + opt + "'" + desc + (message ? ". " + message : "");
      }
      return (value, opt, opts) => {
        if (validator2 === !1)
          throw new AxiosError(formatMessage(opt, " has been removed" + (version ? " in " + version : "")), AxiosError.ERR_DEPRECATED);
        return version && !deprecatedWarnings[opt] && (deprecatedWarnings[opt] = !0, console.warn(formatMessage(opt, " has been deprecated since v" + version + " and will be removed in the near future"))), validator2 ? validator2(value, opt, opts) : !0;
      };
    };
    validators$1.spelling = function(correctSpelling) {
      return (value, opt) => (console.warn(`${opt} is likely a misspelling of ${correctSpelling}`), !0);
    };
    function assertOptions(options, schema, allowUnknown) {
      if (typeof options != "object" || options === null)
        throw new AxiosError("options must be an object", AxiosError.ERR_BAD_OPTION_VALUE);
      let keys = Object.keys(options), i = keys.length;
      for (; i-- > 0; ) {
        let opt = keys[i], validator2 = Object.prototype.hasOwnProperty.call(schema, opt) ? schema[opt] : void 0;
        if (validator2) {
          let value = options[opt], result = value === void 0 || validator2(value, opt, options);
          if (result !== !0)
            throw new AxiosError("option " + opt + " must be " + result, AxiosError.ERR_BAD_OPTION_VALUE);
          continue;
        }
        if (allowUnknown !== !0)
          throw new AxiosError("Unknown option " + opt, AxiosError.ERR_BAD_OPTION);
      }
    }
    var validator = {
      assertOptions,
      validators: validators$1
    }, validators = validator.validators, Axios = class {
      constructor(instanceConfig) {
        this.defaults = instanceConfig || {}, this.interceptors = {
          request: new InterceptorManager(),
          response: new InterceptorManager()
        };
      }
      /**
       * Dispatch a request
       *
       * @param {String|Object} configOrUrl The config specific for this request (merged with this.defaults)
       * @param {?Object} config
       *
       * @returns {Promise} The Promise to be fulfilled
       */
      async request(configOrUrl, config) {
        try {
          return await this._request(configOrUrl, config);
        } catch (err) {
          if (err instanceof Error) {
            let dummy = {};
            Error.captureStackTrace ? Error.captureStackTrace(dummy) : dummy = new Error();
            let stack = (() => {
              if (!dummy.stack)
                return "";
              let firstNewlineIndex = dummy.stack.indexOf(`
`);
              return firstNewlineIndex === -1 ? "" : dummy.stack.slice(firstNewlineIndex + 1);
            })();
            try {
              if (!err.stack)
                err.stack = stack;
              else if (stack) {
                let firstNewlineIndex = stack.indexOf(`
`), secondNewlineIndex = firstNewlineIndex === -1 ? -1 : stack.indexOf(`
`, firstNewlineIndex + 1), stackWithoutTwoTopLines = secondNewlineIndex === -1 ? "" : stack.slice(secondNewlineIndex + 1);
                String(err.stack).endsWith(stackWithoutTwoTopLines) || (err.stack += `
` + stack);
              }
            } catch {
            }
          }
          throw err;
        }
      }
      _request(configOrUrl, config) {
        typeof configOrUrl == "string" ? (config = config || {}, config.url = configOrUrl) : config = configOrUrl || {}, config = mergeConfig(this.defaults, config);
        let {
          transitional,
          paramsSerializer,
          headers
        } = config;
        transitional !== void 0 && validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean),
          legacyInterceptorReqResOrdering: validators.transitional(validators.boolean),
          advertiseZstdAcceptEncoding: validators.transitional(validators.boolean),
          validateStatusUndefinedResolves: validators.transitional(validators.boolean)
        }, !1), paramsSerializer != null && (utils$1.isFunction(paramsSerializer) ? config.paramsSerializer = {
          serialize: paramsSerializer
        } : validator.assertOptions(paramsSerializer, {
          encode: validators.function,
          serialize: validators.function
        }, !0)), config.allowAbsoluteUrls !== void 0 || (this.defaults.allowAbsoluteUrls !== void 0 ? config.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls : config.allowAbsoluteUrls = !0), validator.assertOptions(config, {
          baseUrl: validators.spelling("baseURL"),
          withXsrfToken: validators.spelling("withXSRFToken")
        }, !0), config.method = (config.method || this.defaults.method || "get").toLowerCase();
        let contextHeaders = headers && utils$1.merge(headers.common, headers[config.method]);
        headers && utils$1.forEach(["delete", "get", "head", "post", "put", "patch", "query", "common"], (method) => {
          delete headers[method];
        }), config.headers = AxiosHeaders.concat(contextHeaders, headers);
        let requestInterceptorChain = [], synchronousRequestInterceptors = !0;
        this.interceptors.request.forEach(function(interceptor) {
          if (typeof interceptor.runWhen == "function" && interceptor.runWhen(config) === !1)
            return;
          synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;
          let transitional2 = config.transitional || transitionalDefaults;
          transitional2 && transitional2.legacyInterceptorReqResOrdering ? requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected) : requestInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
        });
        let responseInterceptorChain = [];
        this.interceptors.response.forEach(function(interceptor) {
          responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
        });
        let promise, i = 0, len;
        if (!synchronousRequestInterceptors) {
          let chain = [dispatchRequest.bind(this), void 0];
          for (chain.unshift(...requestInterceptorChain), chain.push(...responseInterceptorChain), len = chain.length, promise = Promise.resolve(config); i < len; )
            promise = promise.then(chain[i++], chain[i++]);
          return promise;
        }
        len = requestInterceptorChain.length;
        let newConfig = config;
        for (; i < len; ) {
          let onFulfilled = requestInterceptorChain[i++], onRejected = requestInterceptorChain[i++];
          try {
            newConfig = onFulfilled(newConfig);
          } catch (error) {
            onRejected.call(this, error);
            break;
          }
        }
        try {
          promise = dispatchRequest.call(this, newConfig);
        } catch (error) {
          return Promise.reject(error);
        }
        for (i = 0, len = responseInterceptorChain.length; i < len; )
          promise = promise.then(responseInterceptorChain[i++], responseInterceptorChain[i++]);
        return promise;
      }
      getUri(config) {
        config = mergeConfig(this.defaults, config);
        let fullPath = buildFullPath(config.baseURL, config.url, config.allowAbsoluteUrls, config);
        return buildURL(fullPath, config.params, config.paramsSerializer);
      }
    };
    utils$1.forEach(["delete", "get", "head", "options"], function(method) {
      Axios.prototype[method] = function(url2, config) {
        return this.request(mergeConfig(config || {}, {
          method,
          url: url2,
          data: config && utils$1.hasOwnProp(config, "data") ? config.data : void 0
        }));
      };
    });
    utils$1.forEach(["post", "put", "patch", "query"], function(method) {
      function generateHTTPMethod(isForm) {
        return function(url2, data, config) {
          return this.request(mergeConfig(config || {}, {
            method,
            headers: isForm ? {
              "Content-Type": "multipart/form-data"
            } : {},
            url: url2,
            data
          }));
        };
      }
      Axios.prototype[method] = generateHTTPMethod(), method !== "query" && (Axios.prototype[method + "Form"] = generateHTTPMethod(!0));
    });
    var CancelToken = class _CancelToken {
      constructor(executor) {
        if (typeof executor != "function")
          throw new TypeError("executor must be a function.");
        let resolvePromise;
        this.promise = new Promise(function(resolve) {
          resolvePromise = resolve;
        });
        let token = this;
        this.promise.then((cancel) => {
          if (!token._listeners) return;
          let i = token._listeners.length;
          for (; i-- > 0; )
            token._listeners[i](cancel);
          token._listeners = null;
        }), this.promise.then = (onfulfilled) => {
          let _resolve, promise = new Promise((resolve) => {
            token.subscribe(resolve), _resolve = resolve;
          }).then(onfulfilled);
          return promise.cancel = function() {
            token.unsubscribe(_resolve);
          }, promise;
        }, executor(function(message, config, request) {
          token.reason || (token.reason = new CanceledError(message, config, request), resolvePromise(token.reason));
        });
      }
      /**
       * Throws a `CanceledError` if cancellation has been requested.
       */
      throwIfRequested() {
        if (this.reason)
          throw this.reason;
      }
      /**
       * Subscribe to the cancel signal
       */
      subscribe(listener) {
        if (this.reason) {
          listener(this.reason);
          return;
        }
        this._listeners ? this._listeners.push(listener) : this._listeners = [listener];
      }
      /**
       * Unsubscribe from the cancel signal
       */
      unsubscribe(listener) {
        if (!this._listeners)
          return;
        let index = this._listeners.indexOf(listener);
        index !== -1 && this._listeners.splice(index, 1);
      }
      toAbortSignal() {
        let controller = new AbortController(), abort = (err) => {
          controller.abort(err);
        };
        return this.subscribe(abort), controller.signal.unsubscribe = () => this.unsubscribe(abort), controller.signal;
      }
      /**
       * Returns an object that contains a new `CancelToken` and a function that, when called,
       * cancels the `CancelToken`.
       */
      static source() {
        let cancel;
        return {
          token: new _CancelToken(function(c) {
            cancel = c;
          }),
          cancel
        };
      }
    };
    function spread(callback) {
      return function(arr) {
        return callback.apply(null, arr);
      };
    }
    function isAxiosError(payload) {
      return utils$1.isObject(payload) && payload.isAxiosError === !0;
    }
    var HttpStatusCode = {
      Continue: 100,
      SwitchingProtocols: 101,
      Processing: 102,
      EarlyHints: 103,
      Ok: 200,
      Created: 201,
      Accepted: 202,
      NonAuthoritativeInformation: 203,
      NoContent: 204,
      ResetContent: 205,
      PartialContent: 206,
      MultiStatus: 207,
      AlreadyReported: 208,
      ImUsed: 226,
      MultipleChoices: 300,
      MovedPermanently: 301,
      Found: 302,
      SeeOther: 303,
      NotModified: 304,
      UseProxy: 305,
      Unused: 306,
      TemporaryRedirect: 307,
      PermanentRedirect: 308,
      BadRequest: 400,
      Unauthorized: 401,
      PaymentRequired: 402,
      Forbidden: 403,
      NotFound: 404,
      MethodNotAllowed: 405,
      NotAcceptable: 406,
      ProxyAuthenticationRequired: 407,
      RequestTimeout: 408,
      Conflict: 409,
      Gone: 410,
      LengthRequired: 411,
      PreconditionFailed: 412,
      PayloadTooLarge: 413,
      UriTooLong: 414,
      UnsupportedMediaType: 415,
      RangeNotSatisfiable: 416,
      ExpectationFailed: 417,
      ImATeapot: 418,
      MisdirectedRequest: 421,
      UnprocessableEntity: 422,
      Locked: 423,
      FailedDependency: 424,
      TooEarly: 425,
      UpgradeRequired: 426,
      PreconditionRequired: 428,
      TooManyRequests: 429,
      RequestHeaderFieldsTooLarge: 431,
      UnavailableForLegalReasons: 451,
      InternalServerError: 500,
      NotImplemented: 501,
      BadGateway: 502,
      ServiceUnavailable: 503,
      GatewayTimeout: 504,
      HttpVersionNotSupported: 505,
      VariantAlsoNegotiates: 506,
      InsufficientStorage: 507,
      LoopDetected: 508,
      NotExtended: 510,
      NetworkAuthenticationRequired: 511,
      WebServerIsDown: 521,
      ConnectionTimedOut: 522,
      OriginIsUnreachable: 523,
      TimeoutOccurred: 524,
      SslHandshakeFailed: 525,
      InvalidSslCertificate: 526
    };
    Object.entries(HttpStatusCode).forEach(([key, value]) => {
      HttpStatusCode[value] = key;
    });
    function createInstance(defaultConfig) {
      let context = new Axios(defaultConfig), instance = bind(Axios.prototype.request, context);
      return utils$1.extend(instance, Axios.prototype, context, {
        allOwnKeys: !0
      }), utils$1.extend(instance, context, null, {
        allOwnKeys: !0
      }), instance.create = function(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      }, instance;
    }
    var axios = createInstance(defaults);
    axios.Axios = Axios;
    axios.CanceledError = CanceledError;
    axios.CancelToken = CancelToken;
    axios.isCancel = isCancel;
    axios.VERSION = VERSION;
    axios.toFormData = toFormData;
    axios.AxiosError = AxiosError;
    axios.Cancel = axios.CanceledError;
    axios.all = function(promises) {
      return Promise.all(promises);
    };
    axios.spread = spread;
    axios.isAxiosError = isAxiosError;
    axios.mergeConfig = mergeConfig;
    axios.AxiosHeaders = AxiosHeaders;
    axios.formToJSON = (thing) => formDataToJSON(utils$1.isHTMLForm(thing) ? new FormData(thing) : thing);
    axios.getAdapter = adapters.getAdapter;
    axios.HttpStatusCode = HttpStatusCode;
    axios.default = axios;
    module2.exports = axios;
  }
});

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports2, module2) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"], hasBlob = typeof Blob < "u";
    hasBlob && BINARY_TYPES.push("blob");
    module2.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports2, module2) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants(), FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      let target = Buffer.allocUnsafe(totalLength), offset = 0;
      for (let i = 0; i < list.length; i++) {
        let buf = list[i];
        target.set(buf, offset), offset += buf.length;
      }
      return offset < totalLength ? new FastBuffer(target.buffer, target.byteOffset, offset) : target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++)
        output[offset + i] = source[i] ^ mask[i & 3];
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++)
        buffer[i] ^= mask[i & 3];
    }
    function toArrayBuffer(buf) {
      return buf.length === buf.buffer.byteLength ? buf.buffer : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      if (toBuffer.readOnly = !0, Buffer.isBuffer(data)) return data;
      let buf;
      return data instanceof ArrayBuffer ? buf = new FastBuffer(data) : ArrayBuffer.isView(data) ? buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength) : (buf = Buffer.from(data), toBuffer.readOnly = !1), buf;
    }
    module2.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL)
      try {
        let bufferUtil = require("bufferutil");
        module2.exports.mask = function(source, mask, output, offset, length) {
          length < 48 ? _mask(source, mask, output, offset, length) : bufferUtil.mask(source, mask, output, offset, length);
        }, module2.exports.unmask = function(buffer, mask) {
          buffer.length < 32 ? _unmask(buffer, mask) : bufferUtil.unmask(buffer, mask);
        };
      } catch {
      }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports2, module2) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone"), kRun = /* @__PURE__ */ Symbol("kRun"), Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--, this[kRun]();
        }, this.concurrency = concurrency || 1 / 0, this.jobs = [], this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job), this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending !== this.concurrency && this.jobs.length) {
          let job = this.jobs.shift();
          this.pending++, job(this[kDone]);
        }
      }
    };
    module2.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports2, module2) {
    "use strict";
    var zlib = require("zlib"), bufferUtil = require_buffer_util(), Limiter = require_limiter(), { kStatusCode } = require_constants(), FastBuffer = Buffer[Symbol.species], TRAILER = Buffer.from([0, 0, 255, 255]), kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate"), kTotalLength = /* @__PURE__ */ Symbol("total-length"), kCallback = /* @__PURE__ */ Symbol("callback"), kBuffers = /* @__PURE__ */ Symbol("buffers"), kError = /* @__PURE__ */ Symbol("error"), zlibLimiter, PerMessageDeflate = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        if (this._options = options || {}, this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024, this._maxPayload = this._options.maxPayload | 0, this._isServer = !!this._options.isServer, this._deflate = null, this._inflate = null, this.params = null, !zlibLimiter) {
          let concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        let params = {};
        return this._options.serverNoContextTakeover && (params.server_no_context_takeover = !0), this._options.clientNoContextTakeover && (params.client_no_context_takeover = !0), this._options.serverMaxWindowBits && (params.server_max_window_bits = this._options.serverMaxWindowBits), this._options.clientMaxWindowBits ? params.client_max_window_bits = this._options.clientMaxWindowBits : this._options.clientMaxWindowBits == null && (params.client_max_window_bits = !0), params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        return configurations = this.normalizeParams(configurations), this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations), this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate && (this._inflate.close(), this._inflate = null), this._deflate) {
          let callback = this._deflate[kCallback];
          this._deflate.close(), this._deflate = null, callback && callback(
            new Error(
              "The deflate stream was closed while data was being processed"
            )
          );
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        let opts = this._options, accepted = offers.find((params) => !(opts.serverNoContextTakeover === !1 && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === !1 || typeof opts.serverMaxWindowBits == "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits == "number" && !params.client_max_window_bits));
        if (!accepted)
          throw new Error("None of the extension offers can be accepted");
        return opts.serverNoContextTakeover && (accepted.server_no_context_takeover = !0), opts.clientNoContextTakeover && (accepted.client_no_context_takeover = !0), typeof opts.serverMaxWindowBits == "number" && (accepted.server_max_window_bits = opts.serverMaxWindowBits), typeof opts.clientMaxWindowBits == "number" ? accepted.client_max_window_bits = opts.clientMaxWindowBits : (accepted.client_max_window_bits === !0 || opts.clientMaxWindowBits === !1) && delete accepted.client_max_window_bits, accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        let params = response[0];
        if (this._options.clientNoContextTakeover === !1 && params.client_no_context_takeover)
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        if (!params.client_max_window_bits)
          typeof this._options.clientMaxWindowBits == "number" && (params.client_max_window_bits = this._options.clientMaxWindowBits);
        else if (this._options.clientMaxWindowBits === !1 || typeof this._options.clientMaxWindowBits == "number" && params.client_max_window_bits > this._options.clientMaxWindowBits)
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        return configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1)
              throw new Error(`Parameter "${key}" must have only a single value`);
            if (value = value[0], key === "client_max_window_bits") {
              if (value !== !0) {
                let num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15)
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                value = num;
              } else if (!this._isServer)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
            } else if (key === "server_max_window_bits") {
              let num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== !0)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
            } else
              throw new Error(`Unknown parameter "${key}"`);
            params[key] = value;
          });
        }), configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done(), callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done(), callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        let endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          let key = `${endpoint}_max_window_bits`, windowBits = typeof this.params[key] != "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          }), this._inflate[kPerMessageDeflate] = this, this._inflate[kTotalLength] = 0, this._inflate[kBuffers] = [], this._inflate.on("error", inflateOnError), this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback, this._inflate.write(data), fin && this._inflate.write(TRAILER), this._inflate.flush(() => {
          let err = this._inflate[kError];
          if (err) {
            this._inflate.close(), this._inflate = null, callback(err);
            return;
          }
          let data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          this._inflate._readableState.endEmitted ? (this._inflate.close(), this._inflate = null) : (this._inflate[kTotalLength] = 0, this._inflate[kBuffers] = [], fin && this.params[`${endpoint}_no_context_takeover`] && this._inflate.reset()), callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        let endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          let key = `${endpoint}_max_window_bits`, windowBits = typeof this.params[key] != "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          }), this._deflate[kTotalLength] = 0, this._deflate[kBuffers] = [], this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback, this._deflate.write(data), this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate)
            return;
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          fin && (data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4)), this._deflate[kCallback] = null, this._deflate[kTotalLength] = 0, this._deflate[kBuffers] = [], fin && this.params[`${endpoint}_no_context_takeover`] && this._deflate.reset(), callback(null, data2);
        });
      }
    };
    module2.exports = PerMessageDeflate;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk), this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      if (this[kTotalLength] += chunk.length, this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded"), this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH", this[kError][kStatusCode] = 1009, this.removeListener("data", inflateOnData), this.reset();
    }
    function inflateOnError(err) {
      if (this[kPerMessageDeflate]._inflate = null, this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007, this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports2, module2) {
    "use strict";
    var { isUtf8 } = require("buffer"), { hasBlob } = require_constants(), tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      let len = buf.length, i = 0;
      for (; i < len; )
        if ((buf[i] & 128) === 0)
          i++;
        else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192)
            return !1;
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160)
            return !1;
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244)
            return !1;
          i += 4;
        } else
          return !1;
      return !0;
    }
    function isBlob(value) {
      return hasBlob && typeof value == "object" && typeof value.arrayBuffer == "function" && typeof value.type == "string" && typeof value.stream == "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module2.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8)
      module2.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    else if (!process.env.WS_NO_UTF_8_VALIDATE)
      try {
        let isValidUTF8 = require("utf-8-validate");
        module2.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch {
      }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports2, module2) {
    "use strict";
    var { Writable } = require("stream"), PerMessageDeflate = require_permessage_deflate(), {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants(), { concat, toArrayBuffer, unmask } = require_buffer_util(), { isValidStatusCode, isValidUTF8 } = require_validation(), FastBuffer = Buffer[Symbol.species], GET_INFO = 0, GET_PAYLOAD_LENGTH_16 = 1, GET_PAYLOAD_LENGTH_64 = 2, GET_MASK = 3, GET_DATA = 4, INFLATING = 5, DEFER_EVENT = 6, Receiver = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super(), this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : !0, this._binaryType = options.binaryType || BINARY_TYPES[0], this._extensions = options.extensions || {}, this._isServer = !!options.isServer, this._maxBufferedChunks = options.maxBufferedChunks | 0, this._maxFragments = options.maxFragments | 0, this._maxPayload = options.maxPayload | 0, this._skipUTF8Validation = !!options.skipUTF8Validation, this[kWebSocket] = void 0, this._bufferedBytes = 0, this._buffers = [], this._compressed = !1, this._payloadLength = 0, this._mask = void 0, this._fragmented = 0, this._masked = !1, this._fin = !1, this._opcode = 0, this._totalPayloadLength = 0, this._messageLength = 0, this._fragments = [], this._errored = !1, this._loop = !1, this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              !1,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length, this._buffers.push(chunk), this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        if (this._bufferedBytes -= n, n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          let buf = this._buffers[0];
          return this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          ), new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        let dst = Buffer.allocUnsafe(n);
        do {
          let buf = this._buffers[0], offset = dst.length - n;
          n >= buf.length ? dst.set(this._buffers.shift(), offset) : (dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset), this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          )), n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = !0;
        do
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = !1;
              return;
          }
        while (this._loop);
        this._errored || cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        let buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          let error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        let compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
          let error = this.createError(
            RangeError,
            "RSV1 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        if (this._fin = (buf[0] & 128) === 128, this._opcode = buf[0] & 15, this._payloadLength = buf[1] & 127, this._opcode === 0) {
          if (compressed) {
            let error = this.createError(
              RangeError,
              "RSV1 must be clear",
              !0,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            let error = this.createError(
              RangeError,
              "invalid opcode 0",
              !0,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            let error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              !0,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            let error = this.createError(
              RangeError,
              "FIN must be set",
              !0,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            let error = this.createError(
              RangeError,
              "RSV1 must be clear",
              !0,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            let error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              !0,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          let error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            !0,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented && (this._fragmented = this._opcode), this._masked = (buf[1] & 128) === 128, this._isServer) {
          if (!this._masked) {
            let error = this.createError(
              RangeError,
              "MASK must be set",
              !0,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          let error = this.createError(
            RangeError,
            "MASK must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        this._payloadLength === 126 ? this._state = GET_PAYLOAD_LENGTH_16 : this._payloadLength === 127 ? this._state = GET_PAYLOAD_LENGTH_64 : this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0), this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = !1;
          return;
        }
        let buf = this.consume(8), num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 21) - 1) {
          let error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            !1,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4), this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8 && (this._totalPayloadLength += this._payloadLength, this._totalPayloadLength > this._maxPayload && this._maxPayload > 0)) {
          let error = this.createError(
            RangeError,
            "Max payload size exceeded",
            !1,
            1009,
            "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
          );
          cb(error);
          return;
        }
        this._masked ? this._state = GET_MASK : this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = !1;
          return;
        }
        this._mask = this.consume(4), this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = !1;
            return;
          }
          data = this.consume(this._payloadLength), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0 && unmask(data, this._mask);
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING, this.decompress(data, cb);
          return;
        }
        if (data.length) {
          if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
            let error = this.createError(
              RangeError,
              "Too many message fragments",
              !1,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            );
            cb(error);
            return;
          }
          this._messageLength = this._totalPayloadLength, this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        this._extensions[PerMessageDeflate.extensionName].decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            if (this._messageLength += buf.length, this._messageLength > this._maxPayload && this._maxPayload > 0) {
              let error = this.createError(
                RangeError,
                "Max payload size exceeded",
                !1,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
              let error = this.createError(
                RangeError,
                "Too many message fragments",
                !1,
                1008,
                "WS_ERR_TOO_MANY_BUFFERED_PARTS"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb), this._state === GET_INFO && this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        let messageLength = this._messageLength, fragments = this._fragments;
        if (this._totalPayloadLength = 0, this._messageLength = 0, this._fragmented = 0, this._fragments = [], this._opcode === 2) {
          let data;
          this._binaryType === "nodebuffer" ? data = concat(fragments, messageLength) : this._binaryType === "arraybuffer" ? data = toArrayBuffer(concat(fragments, messageLength)) : this._binaryType === "blob" ? data = new Blob(fragments) : data = fragments, this._allowSynchronousEvents ? (this.emit("message", data, !0), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
            this.emit("message", data, !0), this._state = GET_INFO, this.startLoop(cb);
          }));
        } else {
          let buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            let error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              !0,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          this._state === INFLATING || this._allowSynchronousEvents ? (this.emit("message", buf, !1), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
            this.emit("message", buf, !1), this._state = GET_INFO, this.startLoop(cb);
          }));
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0)
            this._loop = !1, this.emit("conclude", 1005, EMPTY_BUFFER), this.end();
          else {
            let code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              let error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                !0,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            let buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              let error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                !0,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = !1, this.emit("conclude", code, buf), this.end();
          }
          this._state = GET_INFO;
          return;
        }
        this._allowSynchronousEvents ? (this.emit(this._opcode === 9 ? "ping" : "pong", data), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
          this.emit(this._opcode === 9 ? "ping" : "pong", data), this._state = GET_INFO, this.startLoop(cb);
        }));
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = !1, this._errored = !0;
        let err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        return Error.captureStackTrace(err, this.createError), err.code = errorCode, err[kStatusCode] = statusCode, err;
      }
    };
    module2.exports = Receiver;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports2, module2) {
    "use strict";
    var { Duplex } = require("stream"), { randomFillSync } = require("crypto"), {
      types: { isUint8Array }
    } = require("util"), PerMessageDeflate = require_permessage_deflate(), { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants(), { isBlob, isValidStatusCode } = require_validation(), { mask: applyMask, toBuffer } = require_buffer_util(), kByteLength = /* @__PURE__ */ Symbol("kByteLength"), maskBuffer = Buffer.alloc(4), RANDOM_POOL_SIZE = 8 * 1024, randomPool, randomPoolPointer = RANDOM_POOL_SIZE, DEFAULT = 0, DEFLATING = 1, GET_BLOB_DATA = 2, Sender = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {}, generateMask && (this._generateMask = generateMask, this._maskBuffer = Buffer.alloc(4)), this._socket = socket, this._firstFragment = !0, this._compress = !1, this._bufferedBytes = 0, this._queue = [], this._state = DEFAULT, this.onerror = NOOP, this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask, merge = !1, offset = 2, skipMasking = !1;
        options.mask && (mask = options.maskBuffer || maskBuffer, options.generateMask ? options.generateMask(mask) : (randomPoolPointer === RANDOM_POOL_SIZE && (randomPool === void 0 && (randomPool = Buffer.alloc(RANDOM_POOL_SIZE)), randomFillSync(randomPool, 0, RANDOM_POOL_SIZE), randomPoolPointer = 0), mask[0] = randomPool[randomPoolPointer++], mask[1] = randomPool[randomPoolPointer++], mask[2] = randomPool[randomPoolPointer++], mask[3] = randomPool[randomPoolPointer++]), skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0, offset = 6);
        let dataLength;
        typeof data == "string" ? (!options.mask || skipMasking) && options[kByteLength] !== void 0 ? dataLength = options[kByteLength] : (data = Buffer.from(data), dataLength = data.length) : (dataLength = data.length, merge = options.mask && options.readOnly && !skipMasking);
        let payloadLength = dataLength;
        dataLength >= 65536 ? (offset += 8, payloadLength = 127) : dataLength > 125 && (offset += 2, payloadLength = 126);
        let target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        return target[0] = options.fin ? options.opcode | 128 : options.opcode, options.rsv1 && (target[0] |= 64), target[1] = payloadLength, payloadLength === 126 ? target.writeUInt16BE(dataLength, 2) : payloadLength === 127 && (target[2] = target[3] = 0, target.writeUIntBE(dataLength, 4, 6)), options.mask ? (target[1] |= 128, target[offset - 4] = mask[0], target[offset - 3] = mask[1], target[offset - 2] = mask[2], target[offset - 1] = mask[3], skipMasking ? [target, data] : merge ? (applyMask(data, mask, target, offset, dataLength), [target]) : (applyMask(data, mask, data, 0, dataLength), [target, data])) : [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0)
          buf = EMPTY_BUFFER;
        else {
          if (typeof code != "number" || !isValidStatusCode(code))
            throw new TypeError("First argument must be a valid error code number");
          if (data === void 0 || !data.length)
            buf = Buffer.allocUnsafe(2), buf.writeUInt16BE(code, 0);
          else {
            let length = Buffer.byteLength(data);
            if (length > 123)
              throw new RangeError("The message must not be greater than 123 bytes");
            if (buf = Buffer.allocUnsafe(2 + length), buf.writeUInt16BE(code, 0), typeof data == "string")
              buf.write(data, 2);
            else if (isUint8Array(data))
              buf.set(data, 2);
            else
              throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        let options = {
          [kByteLength]: buf.length,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: !1,
          rsv1: !1
        };
        this._state !== DEFAULT ? this.enqueue([this.dispatch, buf, !1, options, cb]) : this.sendFrame(_Sender.frame(buf, options), cb);
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength, readOnly;
        if (typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), byteLength > 125)
          throw new RangeError("The data size must not be greater than 125 bytes");
        let options = {
          [kByteLength]: byteLength,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: !1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, !1, options, cb]) : this.getBlobData(data, !1, options, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, !1, options, cb]) : this.sendFrame(_Sender.frame(data, options), cb);
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength, readOnly;
        if (typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), byteLength > 125)
          throw new RangeError("The data size must not be greater than 125 bytes");
        let options = {
          [kByteLength]: byteLength,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: !1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, !1, options, cb]) : this.getBlobData(data, !1, options, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, !1, options, cb]) : this.sendFrame(_Sender.frame(data, options), cb);
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        let perMessageDeflate = this._extensions[PerMessageDeflate.extensionName], opcode = options.binary ? 2 : 1, rsv1 = options.compress, byteLength, readOnly;
        typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), this._firstFragment ? (this._firstFragment = !1, rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"] && (rsv1 = byteLength >= perMessageDeflate._threshold), this._compress = rsv1) : (rsv1 = !1, opcode = 0), options.fin && (this._firstFragment = !0);
        let opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, this._compress, opts, cb]) : this.getBlobData(data, this._compress, opts, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, this._compress, opts, cb]) : this.dispatch(data, this._compress, opts, cb);
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength], this._state = GET_BLOB_DATA, blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            let err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          let data = toBuffer(arrayBuffer);
          compress ? this.dispatch(data, compress, options, cb) : (this._state = DEFAULT, this.sendFrame(_Sender.frame(data, options), cb), this.dequeue());
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        let perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
        this._bufferedBytes += options[kByteLength], this._state = DEFLATING, perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            let err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength], this._state = DEFAULT, options.readOnly = !1, this.sendFrame(_Sender.frame(buf, options), cb), this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        for (; this._state === DEFAULT && this._queue.length; ) {
          let params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength], Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength], this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        list.length === 2 ? (this._socket.cork(), this._socket.write(list[0]), this._socket.write(list[1], cb), this._socket.uncork()) : this._socket.write(list[0], cb);
      }
    };
    module2.exports = Sender;
    function callCallbacks(sender, err, cb) {
      typeof cb == "function" && cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        let params = sender._queue[i], callback = params[params.length - 1];
        typeof callback == "function" && callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb), sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports2, module2) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants(), kCode = /* @__PURE__ */ Symbol("kCode"), kData = /* @__PURE__ */ Symbol("kData"), kError = /* @__PURE__ */ Symbol("kError"), kMessage = /* @__PURE__ */ Symbol("kMessage"), kReason = /* @__PURE__ */ Symbol("kReason"), kTarget = /* @__PURE__ */ Symbol("kTarget"), kType = /* @__PURE__ */ Symbol("kType"), kWasClean = /* @__PURE__ */ Symbol("kWasClean"), Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null, this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: !0 });
    Object.defineProperty(Event.prototype, "type", { enumerable: !0 });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type), this[kCode] = options.code === void 0 ? 0 : options.code, this[kReason] = options.reason === void 0 ? "" : options.reason, this[kWasClean] = options.wasClean === void 0 ? !1 : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: !0 });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: !0 });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: !0 });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type), this[kError] = options.error === void 0 ? null : options.error, this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: !0 });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: !0 });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type), this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: !0 });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (let listener of this.listeners(type))
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute])
            return;
        let wrapper;
        if (type === "message")
          wrapper = function(data, isBinary) {
            let event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "close")
          wrapper = function(code, message) {
            let event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "error")
          wrapper = function(error) {
            let event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "open")
          wrapper = function() {
            let event = new Event("open");
            event[kTarget] = this, callListener(handler, this, event);
          };
        else
          return;
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute], wrapper[kListener] = handler, options.once ? this.once(type, wrapper) : this.on(type, wrapper);
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (let listener of this.listeners(type))
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
      }
    };
    module2.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      typeof listener == "object" && listener.handleEvent ? listener.handleEvent.call(listener, event) : listener.call(thisArg, event);
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      dest[name] === void 0 ? dest[name] = [elem] : dest[name].push(elem);
    }
    function parse(header) {
      let offers = /* @__PURE__ */ Object.create(null), params = /* @__PURE__ */ Object.create(null), mustUnescape = !1, isEscaping = !1, inQuotes = !1, extensionName, paramName, start = -1, code = -1, end = -1, i = 0;
      for (; i < header.length; i++)
        if (code = header.charCodeAt(i), extensionName === void 0)
          if (end === -1 && tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (i !== 0 && (code === 32 || code === 9))
            end === -1 && start !== -1 && (end = i);
          else if (code === 59 || code === 44) {
            if (start === -1)
              throw new SyntaxError(`Unexpected character at index ${i}`);
            end === -1 && (end = i);
            let name = header.slice(start, end);
            code === 44 ? (push(offers, name, params), params = /* @__PURE__ */ Object.create(null)) : extensionName = name, start = end = -1;
          } else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (paramName === void 0)
          if (end === -1 && tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (code === 32 || code === 9)
            end === -1 && start !== -1 && (end = i);
          else if (code === 59 || code === 44) {
            if (start === -1)
              throw new SyntaxError(`Unexpected character at index ${i}`);
            end === -1 && (end = i), push(params, header.slice(start, end), !0), code === 44 && (push(offers, extensionName, params), params = /* @__PURE__ */ Object.create(null), extensionName = void 0), start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1)
            paramName = header.slice(start, i), start = end = -1;
          else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (isEscaping) {
          if (tokenChars[code] !== 1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          start === -1 ? start = i : mustUnescape || (mustUnescape = !0), isEscaping = !1;
        } else if (inQuotes)
          if (tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (code === 34 && start !== -1)
            inQuotes = !1, end = i;
          else if (code === 92)
            isEscaping = !0;
          else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (code === 34 && header.charCodeAt(i - 1) === 61)
          inQuotes = !0;
        else if (end === -1 && tokenChars[code] === 1)
          start === -1 && (start = i);
        else if (start !== -1 && (code === 32 || code === 9))
          end === -1 && (end = i);
        else if (code === 59 || code === 44) {
          if (start === -1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          end === -1 && (end = i);
          let value = header.slice(start, end);
          mustUnescape && (value = value.replace(/\\/g, ""), mustUnescape = !1), push(params, paramName, value), code === 44 && (push(offers, extensionName, params), params = /* @__PURE__ */ Object.create(null), extensionName = void 0), paramName = void 0, start = end = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${i}`);
      if (start === -1 || inQuotes || code === 32 || code === 9)
        throw new SyntaxError("Unexpected end of input");
      end === -1 && (end = i);
      let token = header.slice(start, end);
      return extensionName === void 0 ? push(offers, token, params) : (paramName === void 0 ? push(params, token, !0) : mustUnescape ? push(params, paramName, token.replace(/\\/g, "")) : push(params, paramName, token), push(offers, extensionName, params)), offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension) => {
        let configurations = extensions[extension];
        return Array.isArray(configurations) || (configurations = [configurations]), configurations.map((params) => [extension].concat(
          Object.keys(params).map((k) => {
            let values = params[k];
            return Array.isArray(values) || (values = [values]), values.map((v) => v === !0 ? k : `${k}=${v}`).join("; ");
          })
        ).join("; ")).join(", ");
      }).join(", ");
    }
    module2.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events"), https = require("https"), http = require("http"), net = require("net"), tls = require("tls"), { randomBytes, createHash: createHash2 } = require("crypto"), { Duplex, Readable } = require("stream"), { URL: URL2 } = require("url"), PerMessageDeflate = require_permessage_deflate(), Receiver = require_receiver(), Sender = require_sender(), { isBlob } = require_validation(), {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants(), {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target(), { format, parse } = require_extension(), { toBuffer } = require_buffer_util(), kAborted = /* @__PURE__ */ Symbol("kAborted"), protocolVersions = [8, 13], readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"], subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/, WebSocket = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super(), this._binaryType = BINARY_TYPES[0], this._closeCode = 1006, this._closeFrameReceived = !1, this._closeFrameSent = !1, this._closeMessage = EMPTY_BUFFER, this._closeTimer = null, this._errorEmitted = !1, this._extensions = {}, this._paused = !1, this._protocol = "", this._readyState = _WebSocket.CONNECTING, this._receiver = null, this._sender = null, this._socket = null, address !== null ? (this._bufferedAmount = 0, this._isServer = !1, this._redirects = 0, protocols === void 0 ? protocols = [] : Array.isArray(protocols) || (typeof protocols == "object" && protocols !== null ? (options = protocols, protocols = []) : protocols = [protocols]), initAsClient(this, address, protocols, options)) : (this._autoPong = options.autoPong, this._closeTimeout = options.closeTimeout, this._isServer = !0);
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        BINARY_TYPES.includes(type) && (this._binaryType = type, this._receiver && (this._receiver._binaryType = type));
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        return this._socket ? this._socket._writableState.length + this._sender._bufferedBytes : this._bufferedAmount;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        let receiver = new Receiver({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        }), sender = new Sender(socket, this._extensions, options.generateMask);
        this._receiver = receiver, this._sender = sender, this._socket = socket, receiver[kWebSocket] = this, sender[kWebSocket] = this, socket[kWebSocket] = this, receiver.on("conclude", receiverOnConclude), receiver.on("drain", receiverOnDrain), receiver.on("error", receiverOnError), receiver.on("message", receiverOnMessage), receiver.on("ping", receiverOnPing), receiver.on("pong", receiverOnPong), sender.onerror = senderOnError, socket.setTimeout && socket.setTimeout(0), socket.setNoDelay && socket.setNoDelay(), head.length > 0 && socket.unshift(head), socket.on("close", socketOnClose), socket.on("data", socketOnData), socket.on("end", socketOnEnd), socket.on("error", socketOnError), this._readyState = _WebSocket.OPEN, this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        this._extensions[PerMessageDeflate.extensionName] && this._extensions[PerMessageDeflate.extensionName].cleanup(), this._receiver.removeAllListeners(), this._readyState = _WebSocket.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState !== _WebSocket.CLOSED) {
          if (this.readyState === _WebSocket.CONNECTING) {
            abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
            return;
          }
          if (this.readyState === _WebSocket.CLOSING) {
            this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end();
            return;
          }
          this._readyState = _WebSocket.CLOSING, this._sender.close(code, data, !this._isServer, (err) => {
            err || (this._closeFrameSent = !0, (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end());
          }), setCloseTimer(this);
        }
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED || (this._paused = !0, this._socket.pause());
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof data == "function" ? (cb = data, data = mask = void 0) : typeof mask == "function" && (cb = mask, mask = void 0), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        mask === void 0 && (mask = !this._isServer), this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof data == "function" ? (cb = data, data = mask = void 0) : typeof mask == "function" && (cb = mask, mask = void 0), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        mask === void 0 && (mask = !this._isServer), this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED || (this._paused = !1, this._receiver._writableState.needDrain || this._socket.resume());
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof options == "function" && (cb = options, options = {}), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        let opts = {
          binary: typeof data != "string",
          mask: !this._isServer,
          compress: !0,
          fin: !0,
          ...options
        };
        this._extensions[PerMessageDeflate.extensionName] || (opts.compress = !1), this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState !== _WebSocket.CLOSED) {
          if (this.readyState === _WebSocket.CONNECTING) {
            abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
            return;
          }
          this._socket && (this._readyState = _WebSocket.CLOSING, this._socket.destroy());
        }
      }
    };
    Object.defineProperty(WebSocket, "CONNECTING", {
      enumerable: !0,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket.prototype, "CONNECTING", {
      enumerable: !0,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket, "OPEN", {
      enumerable: !0,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket.prototype, "OPEN", {
      enumerable: !0,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket, "CLOSING", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSING", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket, "CLOSED", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket.prototype, "CLOSED", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket.prototype, property, { enumerable: !0 });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket.prototype, `on${method}`, {
        enumerable: !0,
        get() {
          for (let listener of this.listeners(method))
            if (listener[kForOnEventAttribute]) return listener[kListener];
          return null;
        },
        set(handler) {
          for (let listener of this.listeners(method))
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          typeof handler == "function" && this.addEventListener(method, handler, {
            [kForOnEventAttribute]: !0
          });
        }
      });
    });
    WebSocket.prototype.addEventListener = addEventListener;
    WebSocket.prototype.removeEventListener = removeEventListener;
    module2.exports = WebSocket;
    function initAsClient(websocket, address, protocols, options) {
      let opts = {
        allowSynchronousEvents: !0,
        autoPong: !0,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 1048576,
        maxFragments: 131072,
        maxPayload: 104857600,
        skipUTF8Validation: !1,
        perMessageDeflate: !0,
        followRedirects: !1,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      if (websocket._autoPong = opts.autoPong, websocket._closeTimeout = opts.closeTimeout, !protocolVersions.includes(opts.protocolVersion))
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      let parsedUrl;
      if (address instanceof URL2)
        parsedUrl = address;
      else
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      parsedUrl.protocol === "http:" ? parsedUrl.protocol = "ws:" : parsedUrl.protocol === "https:" && (parsedUrl.protocol = "wss:"), websocket._url = parsedUrl.href;
      let isSecure = parsedUrl.protocol === "wss:", isIpcUrl = parsedUrl.protocol === "ws+unix:", invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl ? invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"` : isIpcUrl && !parsedUrl.pathname ? invalidUrlMessage = "The URL's pathname is empty" : parsedUrl.hash && (invalidUrlMessage = "The URL contains a fragment identifier"), invalidUrlMessage) {
        let err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0)
          throw err;
        emitErrorAndClose(websocket, err);
        return;
      }
      let defaultPort = isSecure ? 443 : 80, key = randomBytes(16).toString("base64"), request = isSecure ? https.request : http.request, protocolSet = /* @__PURE__ */ new Set(), perMessageDeflate;
      if (opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect), opts.defaultPort = opts.defaultPort || defaultPort, opts.port = parsedUrl.port || defaultPort, opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname, opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      }, opts.path = parsedUrl.pathname + parsedUrl.search, opts.timeout = opts.handshakeTimeout, opts.perMessageDeflate && (perMessageDeflate = new PerMessageDeflate({
        ...opts.perMessageDeflate,
        isServer: !1,
        maxPayload: opts.maxPayload
      }), opts.headers["Sec-WebSocket-Extensions"] = format({
        [PerMessageDeflate.extensionName]: perMessageDeflate.offer()
      })), protocols.length) {
        for (let protocol of protocols) {
          if (typeof protocol != "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol))
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin && (opts.protocolVersion < 13 ? opts.headers["Sec-WebSocket-Origin"] = opts.origin : opts.headers.Origin = opts.origin), (parsedUrl.username || parsedUrl.password) && (opts.auth = `${parsedUrl.username}:${parsedUrl.password}`), isIpcUrl) {
        let parts = opts.path.split(":");
        opts.socketPath = parts[0], opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl, websocket._originalSecure = isSecure, websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          let headers = options && options.headers;
          if (options = { ...options, headers: {} }, headers)
            for (let [key2, value] of Object.entries(headers))
              options.headers[key2.toLowerCase()] = value;
        } else if (websocket.listenerCount("redirect") === 0) {
          let isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : !1 : websocket._originalIpc ? !1 : parsedUrl.host === websocket._originalHostOrSocketPath;
          (!isSameHost || websocket._originalSecure && !isSecure) && (delete opts.headers.authorization, delete opts.headers.cookie, isSameHost || delete opts.headers.host, opts.auth = void 0);
        }
        opts.auth && !options.headers.authorization && (options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64")), req = websocket._req = request(opts), websocket._redirects && websocket.emit("redirect", websocket.url, req);
      } else
        req = websocket._req = request(opts);
      opts.timeout && req.on("timeout", () => {
        abortHandshake(websocket, req, "Opening handshake has timed out");
      }), req.on("error", (err) => {
        req === null || req[kAborted] || (req = websocket._req = null, emitErrorAndClose(websocket, err));
      }), req.on("response", (res) => {
        let location = res.headers.location, statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch {
            let err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else websocket.emit("unexpected-response", req, res) || abortHandshake(
          websocket,
          req,
          `Unexpected server response: ${res.statusCode}`
        );
      }), req.on("upgrade", (res, socket, head) => {
        if (websocket.emit("upgrade", res), websocket.readyState !== WebSocket.CONNECTING) return;
        req = websocket._req = null;
        let upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        let digest = createHash2("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        let serverProt = res.headers["sec-websocket-protocol"], protError;
        if (serverProt !== void 0 ? protocolSet.size ? protocolSet.has(serverProt) || (protError = "Server sent an invalid subprotocol") : protError = "Server sent a subprotocol but none was requested" : protocolSet.size && (protError = "Server sent no subprotocol"), protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        serverProt && (websocket._protocol = serverProt);
        let secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            abortHandshake(websocket, socket, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch {
            abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
            return;
          }
          let extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
            abortHandshake(websocket, socket, "Server indicated an extension that was not requested");
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
          } catch {
            abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
            return;
          }
          websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      }), opts.finishRequest ? opts.finishRequest(req, websocket) : req.end();
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket.CLOSING, websocket._errorEmitted = !0, websocket.emit("error", err), websocket.emitClose();
    }
    function netConnect(options) {
      return options.path = options.socketPath, net.connect(options);
    }
    function tlsConnect(options) {
      return options.path = void 0, !options.servername && options.servername !== "" && (options.servername = net.isIP(options.host) ? "" : options.host), tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket.CLOSING;
      let err = new Error(message);
      Error.captureStackTrace(err, abortHandshake), stream.setHeader ? (stream[kAborted] = !0, stream.abort(), stream.socket && !stream.socket.destroyed && stream.socket.destroy(), process.nextTick(emitErrorAndClose, websocket, err)) : (stream.destroy(err), stream.once("error", websocket.emit.bind(websocket, "error")), stream.once("close", websocket.emitClose.bind(websocket)));
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        let length = isBlob(data) ? data.size : toBuffer(data).length;
        websocket._socket ? websocket._sender._bufferedBytes += length : websocket._bufferedAmount += length;
      }
      if (cb) {
        let err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      let websocket = this[kWebSocket];
      websocket._closeFrameReceived = !0, websocket._closeMessage = reason, websocket._closeCode = code, websocket._socket[kWebSocket] !== void 0 && (websocket._socket.removeListener("data", socketOnData), process.nextTick(resume, websocket._socket), code === 1005 ? websocket.close() : websocket.close(code, reason));
    }
    function receiverOnDrain() {
      let websocket = this[kWebSocket];
      websocket.isPaused || websocket._socket.resume();
    }
    function receiverOnError(err) {
      let websocket = this[kWebSocket];
      websocket._socket[kWebSocket] !== void 0 && (websocket._socket.removeListener("data", socketOnData), process.nextTick(resume, websocket._socket), websocket.close(err[kStatusCode])), websocket._errorEmitted || (websocket._errorEmitted = !0, websocket.emit("error", err));
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      let websocket = this[kWebSocket];
      websocket._autoPong && websocket.pong(data, !this._isServer, NOOP), websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      let websocket = this[kWebSocket];
      websocket.readyState !== WebSocket.CLOSED && (websocket.readyState === WebSocket.OPEN && (websocket._readyState = WebSocket.CLOSING, setCloseTimer(websocket)), this._socket.end(), websocket._errorEmitted || (websocket._errorEmitted = !0, websocket.emit("error", err)));
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      let websocket = this[kWebSocket];
      if (this.removeListener("close", socketOnClose), this.removeListener("data", socketOnData), this.removeListener("end", socketOnEnd), websocket._readyState = WebSocket.CLOSING, !this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        let chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end(), this[kWebSocket] = void 0, clearTimeout(websocket._closeTimer), websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted ? websocket.emitClose() : (websocket._receiver.on("error", receiverOnFinish), websocket._receiver.on("finish", receiverOnFinish));
    }
    function socketOnData(chunk) {
      this[kWebSocket]._receiver.write(chunk) || this.pause();
    }
    function socketOnEnd() {
      let websocket = this[kWebSocket];
      websocket._readyState = WebSocket.CLOSING, websocket._receiver.end(), this.end();
    }
    function socketOnError() {
      let websocket = this[kWebSocket];
      this.removeListener("error", socketOnError), this.on("error", NOOP), websocket && (websocket._readyState = WebSocket.CLOSING, this.destroy());
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports2, module2) {
    "use strict";
    var WebSocket = require_websocket(), { Duplex } = require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      !this.destroyed && this._writableState.finished && this.destroy();
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError), this.destroy(), this.listenerCount("error") === 0 && this.emit("error", err);
    }
    function createWebSocketStream(ws, options) {
      let terminateOnDestroy = !0, duplex = new Duplex({
        ...options,
        autoDestroy: !1,
        emitClose: !1,
        objectMode: !1,
        writableObjectMode: !1
      });
      return ws.on("message", function(msg, isBinary) {
        let data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        duplex.push(data) || ws.pause();
      }), ws.once("error", function(err) {
        duplex.destroyed || (terminateOnDestroy = !1, duplex.destroy(err));
      }), ws.once("close", function() {
        duplex.destroyed || duplex.push(null);
      }), duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err), process.nextTick(emitClose, duplex);
          return;
        }
        let called = !1;
        ws.once("error", function(err2) {
          called = !0, callback(err2);
        }), ws.once("close", function() {
          called || callback(err), process.nextTick(emitClose, duplex);
        }), terminateOnDestroy && ws.terminate();
      }, duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function() {
            duplex._final(callback);
          });
          return;
        }
        ws._socket !== null && (ws._socket._writableState.finished ? (callback(), duplex._readableState.endEmitted && duplex.destroy()) : (ws._socket.once("finish", function() {
          callback();
        }), ws.close()));
      }, duplex._read = function() {
        ws.isPaused && ws.resume();
      }, duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      }, duplex.on("end", duplexOnEnd), duplex.on("error", duplexOnError), duplex;
    }
    module2.exports = createWebSocketStream;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports2, module2) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      let protocols = /* @__PURE__ */ new Set(), start = -1, end = -1, i = 0;
      for (i; i < header.length; i++) {
        let code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1)
          start === -1 && (start = i);
        else if (i !== 0 && (code === 32 || code === 9))
          end === -1 && start !== -1 && (end = i);
        else if (code === 44) {
          if (start === -1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          end === -1 && (end = i);
          let protocol2 = header.slice(start, end);
          if (protocols.has(protocol2))
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          protocols.add(protocol2), start = end = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${i}`);
      }
      if (start === -1 || end !== -1)
        throw new SyntaxError("Unexpected end of input");
      let protocol = header.slice(start, i);
      if (protocols.has(protocol))
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      return protocols.add(protocol), protocols;
    }
    module2.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports2, module2) {
    "use strict";
    var EventEmitter = require("events"), http = require("http"), { Duplex } = require("stream"), { createHash: createHash2 } = require("crypto"), extension = require_extension(), PerMessageDeflate = require_permessage_deflate(), subprotocol = require_subprotocol(), WebSocket = require_websocket(), { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants(), keyRegex = /^[+/0-9A-Za-z]{22}==$/, RUNNING = 0, CLOSING = 1, CLOSED = 2, WebSocketServer = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=131072] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        if (super(), options = {
          allowSynchronousEvents: !0,
          autoPong: !0,
          maxBufferedChunks: 1024 * 1024,
          maxFragments: 128 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: !1,
          perMessageDeflate: !1,
          handleProtocols: null,
          clientTracking: !0,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: !1,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket,
          ...options
        }, options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer)
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        if (options.port != null ? (this._server = http.createServer((req, res) => {
          let body = http.STATUS_CODES[426];
          res.writeHead(426, {
            "Content-Length": body.length,
            "Content-Type": "text/plain"
          }), res.end(body);
        }), this._server.listen(
          options.port,
          options.host,
          options.backlog,
          callback
        )) : options.server && (this._server = options.server), this._server) {
          let emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        options.perMessageDeflate === !0 && (options.perMessageDeflate = {}), options.clientTracking && (this.clients = /* @__PURE__ */ new Set(), this._shouldEmitClose = !1), this.options = options, this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer)
          throw new Error('The server is operating in "noServer" mode');
        return this._server ? this._server.address() : null;
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          cb && this.once("close", () => {
            cb(new Error("The server is not running"));
          }), process.nextTick(emitClose, this);
          return;
        }
        if (cb && this.once("close", cb), this._state !== CLOSING)
          if (this._state = CLOSING, this.options.noServer || this.options.server)
            this._server && (this._removeListeners(), this._removeListeners = this._server = null), this.clients ? this.clients.size ? this._shouldEmitClose = !0 : process.nextTick(emitClose, this) : process.nextTick(emitClose, this);
          else {
            let server = this._server;
            this._removeListeners(), this._removeListeners = this._server = null, server.close(() => {
              emitClose(this);
            });
          }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          let index = req.url.indexOf("?");
          if ((index !== -1 ? req.url.slice(0, index) : req.url) !== this.options.path) return !1;
        }
        return !0;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        let key = req.headers["sec-websocket-key"], upgrade = req.headers.upgrade, version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, "Invalid HTTP method");
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Upgrade header");
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
          return;
        }
        if (version !== 13 && version !== 8) {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Version header", {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        let secWebSocketProtocol = req.headers["sec-websocket-protocol"], protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0)
          try {
            protocols = subprotocol.parse(secWebSocketProtocol);
          } catch {
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Sec-WebSocket-Protocol header");
            return;
          }
        let secWebSocketExtensions = req.headers["sec-websocket-extensions"], extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          let perMessageDeflate = new PerMessageDeflate({
            ...this.options.perMessageDeflate,
            isServer: !0,
            maxPayload: this.options.maxPayload
          });
          try {
            let offers = extension.parse(secWebSocketExtensions);
            offers[PerMessageDeflate.extensionName] && (perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]), extensions[PerMessageDeflate.extensionName] = perMessageDeflate);
          } catch {
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid or unacceptable Sec-WebSocket-Extensions header");
            return;
          }
        }
        if (this.options.verifyClient) {
          let info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified)
                return abortHandshake(socket, code || 401, message, headers);
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket])
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        let headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${createHash2("sha1").update(key + GUID).digest("base64")}`
        ], ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          let protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          protocol && (headers.push(`Sec-WebSocket-Protocol: ${protocol}`), ws._protocol = protocol);
        }
        if (extensions[PerMessageDeflate.extensionName]) {
          let params = extensions[PerMessageDeflate.extensionName].params, value = extension.format({
            [PerMessageDeflate.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`), ws._extensions = extensions;
        }
        this.emit("headers", headers, req), socket.write(headers.concat(`\r
`).join(`\r
`)), socket.removeListener("error", socketOnError), ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        }), this.clients && (this.clients.add(ws), ws.on("close", () => {
          this.clients.delete(ws), this._shouldEmitClose && !this.clients.size && process.nextTick(emitClose, this);
        })), cb(ws, req);
      }
    };
    module2.exports = WebSocketServer;
    function addListeners(server, map) {
      for (let event of Object.keys(map)) server.on(event, map[event]);
      return function() {
        for (let event of Object.keys(map))
          server.removeListener(event, map[event]);
      };
    }
    function emitClose(server) {
      server._state = CLOSED, server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code], headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      }, socket.once("finish", socket.destroy), socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join(`\r
`) + `\r
\r
` + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        let err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError), server.emit("wsClientError", err, socket, req);
      } else
        abortHandshake(socket, code, message, headers);
    }
  }
});

// node_modules/ws/index.js
var require_ws = __commonJS({
  "node_modules/ws/index.js"(exports2, module2) {
    "use strict";
    var createWebSocketStream = require_stream(), extension = require_extension(), PerMessageDeflate = require_permessage_deflate(), Receiver = require_receiver(), Sender = require_sender(), subprotocol = require_subprotocol(), WebSocket = require_websocket(), WebSocketServer = require_websocket_server();
    WebSocket.createWebSocketStream = createWebSocketStream;
    WebSocket.extension = extension;
    WebSocket.PerMessageDeflate = PerMessageDeflate;
    WebSocket.Receiver = Receiver;
    WebSocket.Sender = Sender;
    WebSocket.Server = WebSocketServer;
    WebSocket.subprotocol = subprotocol;
    WebSocket.WebSocket = WebSocket;
    WebSocket.WebSocketServer = WebSocketServer;
    module2.exports = WebSocket;
  }
});

// node_modules/isomorphic-ws/node.js
var require_node2 = __commonJS({
  "node_modules/isomorphic-ws/node.js"(exports2, module2) {
    "use strict";
    module2.exports = require_ws();
  }
});

// node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/base64-js/index.js"(exports2) {
    "use strict";
    exports2.byteLength = byteLength;
    exports2.toByteArray = toByteArray;
    exports2.fromByteArray = fromByteArray;
    var lookup = [], revLookup = [], Arr = typeof Uint8Array < "u" ? Uint8Array : Array, code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i)
      lookup[i] = code[i], revLookup[code.charCodeAt(i)] = i;
    var i, len;
    revLookup[45] = 62;
    revLookup[95] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0)
        throw new Error("Invalid string. Length must be a multiple of 4");
      var validLen = b64.indexOf("=");
      validLen === -1 && (validLen = len2);
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64), validLen = lens[0], placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp, lens = getLens(b64), validLen = lens[0], placeHoldersLen = lens[1], arr = new Arr(_byteLength(b64, validLen, placeHoldersLen)), curByte = 0, len2 = placeHoldersLen > 0 ? validLen - 4 : validLen, i2;
      for (i2 = 0; i2 < len2; i2 += 4)
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)], arr[curByte++] = tmp >> 16 & 255, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255;
      return placeHoldersLen === 2 && (tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4, arr[curByte++] = tmp & 255), placeHoldersLen === 1 && (tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255), arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      for (var tmp, output = [], i2 = start; i2 < end; i2 += 3)
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255), output.push(tripletToBase64(tmp));
      return output.join("");
    }
    function fromByteArray(uint8) {
      for (var tmp, len2 = uint8.length, extraBytes = len2 % 3, parts = [], maxChunkLength = 16383, i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength)
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      return extraBytes === 1 ? (tmp = uint8[len2 - 1], parts.push(
        lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
      )) : extraBytes === 2 && (tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1], parts.push(
        lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
      )), parts.join("");
    }
  }
});

// node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/ieee754/index.js"(exports2) {
    exports2.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, nBits = -7, i = isLE ? nBytes - 1 : 0, d = isLE ? -1 : 1, s = buffer[offset + i];
      for (i += d, e = s & (1 << -nBits) - 1, s >>= -nBits, nBits += eLen; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8)
        ;
      for (m = e & (1 << -nBits) - 1, e >>= -nBits, nBits += mLen; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8)
        ;
      if (e === 0)
        e = 1 - eBias;
      else {
        if (e === eMax)
          return m ? NaN : (s ? -1 : 1) * (1 / 0);
        m = m + Math.pow(2, mLen), e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports2.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, i = isLE ? 0 : nBytes - 1, d = isLE ? 1 : -1, s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      for (value = Math.abs(value), isNaN(value) || value === 1 / 0 ? (m = isNaN(value) ? 1 : 0, e = eMax) : (e = Math.floor(Math.log(value) / Math.LN2), value * (c = Math.pow(2, -e)) < 1 && (e--, c *= 2), e + eBias >= 1 ? value += rt / c : value += rt * Math.pow(2, 1 - eBias), value * c >= 2 && (e++, c /= 2), e + eBias >= eMax ? (m = 0, e = eMax) : e + eBias >= 1 ? (m = (value * c - 1) * Math.pow(2, mLen), e = e + eBias) : (m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen), e = 0)); mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8)
        ;
      for (e = e << mLen | m, eLen += mLen; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8)
        ;
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/buffer/index.js
var require_buffer = __commonJS({
  "node_modules/buffer/index.js"(exports2) {
    "use strict";
    var base64 = require_base64_js(), ieee754 = require_ieee754(), customInspectSymbol = typeof Symbol == "function" && typeof Symbol.for == "function" ? /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom") : null;
    exports2.Buffer = Buffer2;
    exports2.SlowBuffer = SlowBuffer;
    exports2.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports2.kMaxLength = K_MAX_LENGTH;
    Buffer2.TYPED_ARRAY_SUPPORT = typedArraySupport();
    !Buffer2.TYPED_ARRAY_SUPPORT && typeof console < "u" && typeof console.error == "function" && console.error(
      "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
    );
    function typedArraySupport() {
      try {
        let arr = new Uint8Array(1), proto = { foo: function() {
          return 42;
        } };
        return Object.setPrototypeOf(proto, Uint8Array.prototype), Object.setPrototypeOf(arr, proto), arr.foo() === 42;
      } catch {
        return !1;
      }
    }
    Object.defineProperty(Buffer2.prototype, "parent", {
      enumerable: !0,
      get: function() {
        if (Buffer2.isBuffer(this))
          return this.buffer;
      }
    });
    Object.defineProperty(Buffer2.prototype, "offset", {
      enumerable: !0,
      get: function() {
        if (Buffer2.isBuffer(this))
          return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH)
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      let buf = new Uint8Array(length);
      return Object.setPrototypeOf(buf, Buffer2.prototype), buf;
    }
    function Buffer2(arg, encodingOrOffset, length) {
      if (typeof arg == "number") {
        if (typeof encodingOrOffset == "string")
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer2.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value == "string")
        return fromString(value, encodingOrOffset);
      if (ArrayBuffer.isView(value))
        return fromArrayView(value);
      if (value == null)
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer) || typeof SharedArrayBuffer < "u" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer)))
        return fromArrayBuffer(value, encodingOrOffset, length);
      if (typeof value == "number")
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      let valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value)
        return Buffer2.from(valueOf, encodingOrOffset, length);
      let b = fromObject(value);
      if (b) return b;
      if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] == "function")
        return Buffer2.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer2.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer2.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer2, Uint8Array);
    function assertSize(size) {
      if (typeof size != "number")
        throw new TypeError('"size" argument must be of type number');
      if (size < 0)
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
    }
    function alloc(size, fill, encoding) {
      return assertSize(size), size <= 0 ? createBuffer(size) : fill !== void 0 ? typeof encoding == "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill) : createBuffer(size);
    }
    Buffer2.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      return assertSize(size), createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer2.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer2.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if ((typeof encoding != "string" || encoding === "") && (encoding = "utf8"), !Buffer2.isEncoding(encoding))
        throw new TypeError("Unknown encoding: " + encoding);
      let length = byteLength(string, encoding) | 0, buf = createBuffer(length), actual = buf.write(string, encoding);
      return actual !== length && (buf = buf.slice(0, actual)), buf;
    }
    function fromArrayLike(array) {
      let length = array.length < 0 ? 0 : checked(array.length) | 0, buf = createBuffer(length);
      for (let i = 0; i < length; i += 1)
        buf[i] = array[i] & 255;
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        let copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset)
        throw new RangeError('"offset" is outside of buffer bounds');
      if (array.byteLength < byteOffset + (length || 0))
        throw new RangeError('"length" is outside of buffer bounds');
      let buf;
      return byteOffset === void 0 && length === void 0 ? buf = new Uint8Array(array) : length === void 0 ? buf = new Uint8Array(array, byteOffset) : buf = new Uint8Array(array, byteOffset, length), Object.setPrototypeOf(buf, Buffer2.prototype), buf;
    }
    function fromObject(obj) {
      if (Buffer2.isBuffer(obj)) {
        let len = checked(obj.length) | 0, buf = createBuffer(len);
        return buf.length === 0 || obj.copy(buf, 0, 0, len), buf;
      }
      if (obj.length !== void 0)
        return typeof obj.length != "number" || numberIsNaN(obj.length) ? createBuffer(0) : fromArrayLike(obj);
      if (obj.type === "Buffer" && Array.isArray(obj.data))
        return fromArrayLike(obj.data);
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH)
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      return length | 0;
    }
    function SlowBuffer(length) {
      return +length != length && (length = 0), Buffer2.alloc(+length);
    }
    Buffer2.isBuffer = function(b) {
      return b != null && b._isBuffer === !0 && b !== Buffer2.prototype;
    };
    Buffer2.compare = function(a, b) {
      if (isInstance(a, Uint8Array) && (a = Buffer2.from(a, a.offset, a.byteLength)), isInstance(b, Uint8Array) && (b = Buffer2.from(b, b.offset, b.byteLength)), !Buffer2.isBuffer(a) || !Buffer2.isBuffer(b))
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      if (a === b) return 0;
      let x = a.length, y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i)
        if (a[i] !== b[i]) {
          x = a[i], y = b[i];
          break;
        }
      return x < y ? -1 : y < x ? 1 : 0;
    };
    Buffer2.isEncoding = function(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return !0;
        default:
          return !1;
      }
    };
    Buffer2.concat = function(list, length) {
      if (!Array.isArray(list))
        throw new TypeError('"list" argument must be an Array of Buffers');
      if (list.length === 0)
        return Buffer2.alloc(0);
      let i;
      if (length === void 0)
        for (length = 0, i = 0; i < list.length; ++i)
          length += list[i].length;
      let buffer = Buffer2.allocUnsafe(length), pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array))
          pos + buf.length > buffer.length ? (Buffer2.isBuffer(buf) || (buf = Buffer2.from(buf)), buf.copy(buffer, pos)) : Uint8Array.prototype.set.call(
            buffer,
            buf,
            pos
          );
        else if (Buffer2.isBuffer(buf))
          buf.copy(buffer, pos);
        else
          throw new TypeError('"list" argument must be an Array of Buffers');
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer2.isBuffer(string))
        return string.length;
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer))
        return string.byteLength;
      if (typeof string != "string")
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      let len = string.length, mustMatch = arguments.length > 2 && arguments[2] === !0;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = !1;
      for (; ; )
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase)
              return mustMatch ? -1 : utf8ToBytes(string).length;
            encoding = ("" + encoding).toLowerCase(), loweredCase = !0;
        }
    }
    Buffer2.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = !1;
      if ((start === void 0 || start < 0) && (start = 0), start > this.length || ((end === void 0 || end > this.length) && (end = this.length), end <= 0) || (end >>>= 0, start >>>= 0, end <= start))
        return "";
      for (encoding || (encoding = "utf8"); ; )
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase(), loweredCase = !0;
        }
    }
    Buffer2.prototype._isBuffer = !0;
    function swap(b, n, m) {
      let i = b[n];
      b[n] = b[m], b[m] = i;
    }
    Buffer2.prototype.swap16 = function() {
      let len = this.length;
      if (len % 2 !== 0)
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      for (let i = 0; i < len; i += 2)
        swap(this, i, i + 1);
      return this;
    };
    Buffer2.prototype.swap32 = function() {
      let len = this.length;
      if (len % 4 !== 0)
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      for (let i = 0; i < len; i += 4)
        swap(this, i, i + 3), swap(this, i + 1, i + 2);
      return this;
    };
    Buffer2.prototype.swap64 = function() {
      let len = this.length;
      if (len % 8 !== 0)
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      for (let i = 0; i < len; i += 8)
        swap(this, i, i + 7), swap(this, i + 1, i + 6), swap(this, i + 2, i + 5), swap(this, i + 3, i + 4);
      return this;
    };
    Buffer2.prototype.toString = function() {
      let length = this.length;
      return length === 0 ? "" : arguments.length === 0 ? utf8Slice(this, 0, length) : slowToString.apply(this, arguments);
    };
    Buffer2.prototype.toLocaleString = Buffer2.prototype.toString;
    Buffer2.prototype.equals = function(b) {
      if (!Buffer2.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      return this === b ? !0 : Buffer2.compare(this, b) === 0;
    };
    Buffer2.prototype.inspect = function() {
      let str = "", max = exports2.INSPECT_MAX_BYTES;
      return str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim(), this.length > max && (str += " ... "), "<Buffer " + str + ">";
    };
    customInspectSymbol && (Buffer2.prototype[customInspectSymbol] = Buffer2.prototype.inspect);
    Buffer2.prototype.compare = function(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array) && (target = Buffer2.from(target, target.offset, target.byteLength)), !Buffer2.isBuffer(target))
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      if (start === void 0 && (start = 0), end === void 0 && (end = target ? target.length : 0), thisStart === void 0 && (thisStart = 0), thisEnd === void 0 && (thisEnd = this.length), start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length)
        throw new RangeError("out of range index");
      if (thisStart >= thisEnd && start >= end)
        return 0;
      if (thisStart >= thisEnd)
        return -1;
      if (start >= end)
        return 1;
      if (start >>>= 0, end >>>= 0, thisStart >>>= 0, thisEnd >>>= 0, this === target) return 0;
      let x = thisEnd - thisStart, y = end - start, len = Math.min(x, y), thisCopy = this.slice(thisStart, thisEnd), targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i)
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i], y = targetCopy[i];
          break;
        }
      return x < y ? -1 : y < x ? 1 : 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset == "string" ? (encoding = byteOffset, byteOffset = 0) : byteOffset > 2147483647 ? byteOffset = 2147483647 : byteOffset < -2147483648 && (byteOffset = -2147483648), byteOffset = +byteOffset, numberIsNaN(byteOffset) && (byteOffset = dir ? 0 : buffer.length - 1), byteOffset < 0 && (byteOffset = buffer.length + byteOffset), byteOffset >= buffer.length) {
        if (dir) return -1;
        byteOffset = buffer.length - 1;
      } else if (byteOffset < 0)
        if (dir) byteOffset = 0;
        else return -1;
      if (typeof val == "string" && (val = Buffer2.from(val, encoding)), Buffer2.isBuffer(val))
        return val.length === 0 ? -1 : arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      if (typeof val == "number")
        return val = val & 255, typeof Uint8Array.prototype.indexOf == "function" ? dir ? Uint8Array.prototype.indexOf.call(buffer, val, byteOffset) : Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset) : arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1, arrLength = arr.length, valLength = val.length;
      if (encoding !== void 0 && (encoding = String(encoding).toLowerCase(), encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le")) {
        if (arr.length < 2 || val.length < 2)
          return -1;
        indexSize = 2, arrLength /= 2, valLength /= 2, byteOffset /= 2;
      }
      function read(buf, i2) {
        return indexSize === 1 ? buf[i2] : buf.readUInt16BE(i2 * indexSize);
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++)
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1 && (foundIndex = i), i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else
            foundIndex !== -1 && (i -= i - foundIndex), foundIndex = -1;
      } else
        for (byteOffset + valLength > arrLength && (byteOffset = arrLength - valLength), i = byteOffset; i >= 0; i--) {
          let found = !0;
          for (let j = 0; j < valLength; j++)
            if (read(arr, i + j) !== read(val, j)) {
              found = !1;
              break;
            }
          if (found) return i;
        }
      return -1;
    }
    Buffer2.prototype.includes = function(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer2.prototype.indexOf = function(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, !0);
    };
    Buffer2.prototype.lastIndexOf = function(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, !1);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      let remaining = buf.length - offset;
      length ? (length = Number(length), length > remaining && (length = remaining)) : length = remaining;
      let strLen = string.length;
      length > strLen / 2 && (length = strLen / 2);
      let i;
      for (i = 0; i < length; ++i) {
        let parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer2.prototype.write = function(string, offset, length, encoding) {
      if (offset === void 0)
        encoding = "utf8", length = this.length, offset = 0;
      else if (length === void 0 && typeof offset == "string")
        encoding = offset, length = this.length, offset = 0;
      else if (isFinite(offset))
        offset = offset >>> 0, isFinite(length) ? (length = length >>> 0, encoding === void 0 && (encoding = "utf8")) : (encoding = length, length = void 0);
      else
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      let remaining = this.length - offset;
      if ((length === void 0 || length > remaining) && (length = remaining), string.length > 0 && (length < 0 || offset < 0) || offset > this.length)
        throw new RangeError("Attempt to write outside buffer bounds");
      encoding || (encoding = "utf8");
      let loweredCase = !1;
      for (; ; )
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase(), loweredCase = !0;
        }
    };
    Buffer2.prototype.toJSON = function() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      return start === 0 && end === buf.length ? base64.fromByteArray(buf) : base64.fromByteArray(buf.slice(start, end));
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      let res = [], i = start;
      for (; i < end; ) {
        let firstByte = buf[i], codePoint = null, bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              firstByte < 128 && (codePoint = firstByte);
              break;
            case 2:
              secondByte = buf[i + 1], (secondByte & 192) === 128 && (tempCodePoint = (firstByte & 31) << 6 | secondByte & 63, tempCodePoint > 127 && (codePoint = tempCodePoint));
              break;
            case 3:
              secondByte = buf[i + 1], thirdByte = buf[i + 2], (secondByte & 192) === 128 && (thirdByte & 192) === 128 && (tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63, tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343) && (codePoint = tempCodePoint));
              break;
            case 4:
              secondByte = buf[i + 1], thirdByte = buf[i + 2], fourthByte = buf[i + 3], (secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128 && (tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63, tempCodePoint > 65535 && tempCodePoint < 1114112 && (codePoint = tempCodePoint));
          }
        }
        codePoint === null ? (codePoint = 65533, bytesPerSequence = 1) : codePoint > 65535 && (codePoint -= 65536, res.push(codePoint >>> 10 & 1023 | 55296), codePoint = 56320 | codePoint & 1023), res.push(codePoint), i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      let len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH)
        return String.fromCharCode.apply(String, codePoints);
      let res = "", i = 0;
      for (; i < len; )
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i)
        ret += String.fromCharCode(buf[i] & 127);
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i)
        ret += String.fromCharCode(buf[i]);
      return ret;
    }
    function hexSlice(buf, start, end) {
      let len = buf.length;
      (!start || start < 0) && (start = 0), (!end || end < 0 || end > len) && (end = len);
      let out = "";
      for (let i = start; i < end; ++i)
        out += hexSliceLookupTable[buf[i]];
      return out;
    }
    function utf16leSlice(buf, start, end) {
      let bytes = buf.slice(start, end), res = "";
      for (let i = 0; i < bytes.length - 1; i += 2)
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      return res;
    }
    Buffer2.prototype.slice = function(start, end) {
      let len = this.length;
      start = ~~start, end = end === void 0 ? len : ~~end, start < 0 ? (start += len, start < 0 && (start = 0)) : start > len && (start = len), end < 0 ? (end += len, end < 0 && (end = 0)) : end > len && (end = len), end < start && (end = start);
      let newBuf = this.subarray(start, end);
      return Object.setPrototypeOf(newBuf, Buffer2.prototype), newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer2.prototype.readUintLE = Buffer2.prototype.readUIntLE = function(offset, byteLength2, noAssert) {
      offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, noAssert || checkOffset(offset, byteLength2, this.length);
      let val = this[offset], mul = 1, i = 0;
      for (; ++i < byteLength2 && (mul *= 256); )
        val += this[offset + i] * mul;
      return val;
    };
    Buffer2.prototype.readUintBE = Buffer2.prototype.readUIntBE = function(offset, byteLength2, noAssert) {
      offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, noAssert || checkOffset(offset, byteLength2, this.length);
      let val = this[offset + --byteLength2], mul = 1;
      for (; byteLength2 > 0 && (mul *= 256); )
        val += this[offset + --byteLength2] * mul;
      return val;
    };
    Buffer2.prototype.readUint8 = Buffer2.prototype.readUInt8 = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 1, this.length), this[offset];
    };
    Buffer2.prototype.readUint16LE = Buffer2.prototype.readUInt16LE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 2, this.length), this[offset] | this[offset + 1] << 8;
    };
    Buffer2.prototype.readUint16BE = Buffer2.prototype.readUInt16BE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 2, this.length), this[offset] << 8 | this[offset + 1];
    };
    Buffer2.prototype.readUint32LE = Buffer2.prototype.readUInt32LE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer2.prototype.readUint32BE = Buffer2.prototype.readUInt32BE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer2.prototype.readBigUInt64LE = defineBigIntMethod(function(offset) {
      offset = offset >>> 0, validateNumber(offset, "offset");
      let first = this[offset], last = this[offset + 7];
      (first === void 0 || last === void 0) && boundsError(offset, this.length - 8);
      let lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24, hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer2.prototype.readBigUInt64BE = defineBigIntMethod(function(offset) {
      offset = offset >>> 0, validateNumber(offset, "offset");
      let first = this[offset], last = this[offset + 7];
      (first === void 0 || last === void 0) && boundsError(offset, this.length - 8);
      let hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset], lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer2.prototype.readIntLE = function(offset, byteLength2, noAssert) {
      offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, noAssert || checkOffset(offset, byteLength2, this.length);
      let val = this[offset], mul = 1, i = 0;
      for (; ++i < byteLength2 && (mul *= 256); )
        val += this[offset + i] * mul;
      return mul *= 128, val >= mul && (val -= Math.pow(2, 8 * byteLength2)), val;
    };
    Buffer2.prototype.readIntBE = function(offset, byteLength2, noAssert) {
      offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, noAssert || checkOffset(offset, byteLength2, this.length);
      let i = byteLength2, mul = 1, val = this[offset + --i];
      for (; i > 0 && (mul *= 256); )
        val += this[offset + --i] * mul;
      return mul *= 128, val >= mul && (val -= Math.pow(2, 8 * byteLength2)), val;
    };
    Buffer2.prototype.readInt8 = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 1, this.length), this[offset] & 128 ? (255 - this[offset] + 1) * -1 : this[offset];
    };
    Buffer2.prototype.readInt16LE = function(offset, noAssert) {
      offset = offset >>> 0, noAssert || checkOffset(offset, 2, this.length);
      let val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer2.prototype.readInt16BE = function(offset, noAssert) {
      offset = offset >>> 0, noAssert || checkOffset(offset, 2, this.length);
      let val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer2.prototype.readInt32LE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer2.prototype.readInt32BE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer2.prototype.readBigInt64LE = defineBigIntMethod(function(offset) {
      offset = offset >>> 0, validateNumber(offset, "offset");
      let first = this[offset], last = this[offset + 7];
      (first === void 0 || last === void 0) && boundsError(offset, this.length - 8);
      let val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer2.prototype.readBigInt64BE = defineBigIntMethod(function(offset) {
      offset = offset >>> 0, validateNumber(offset, "offset");
      let first = this[offset], last = this[offset + 7];
      (first === void 0 || last === void 0) && boundsError(offset, this.length - 8);
      let val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer2.prototype.readFloatLE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), ieee754.read(this, offset, !0, 23, 4);
    };
    Buffer2.prototype.readFloatBE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 4, this.length), ieee754.read(this, offset, !1, 23, 4);
    };
    Buffer2.prototype.readDoubleLE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 8, this.length), ieee754.read(this, offset, !0, 52, 8);
    };
    Buffer2.prototype.readDoubleBE = function(offset, noAssert) {
      return offset = offset >>> 0, noAssert || checkOffset(offset, 8, this.length), ieee754.read(this, offset, !1, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer2.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer2.prototype.writeUintLE = Buffer2.prototype.writeUIntLE = function(value, offset, byteLength2, noAssert) {
      if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
        let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1, i = 0;
      for (this[offset] = value & 255; ++i < byteLength2 && (mul *= 256); )
        this[offset + i] = value / mul & 255;
      return offset + byteLength2;
    };
    Buffer2.prototype.writeUintBE = Buffer2.prototype.writeUIntBE = function(value, offset, byteLength2, noAssert) {
      if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
        let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1, mul = 1;
      for (this[offset + i] = value & 255; --i >= 0 && (mul *= 256); )
        this[offset + i] = value / mul & 255;
      return offset + byteLength2;
    };
    Buffer2.prototype.writeUint8 = Buffer2.prototype.writeUInt8 = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 1, 255, 0), this[offset] = value & 255, offset + 1;
    };
    Buffer2.prototype.writeUint16LE = Buffer2.prototype.writeUInt16LE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 2, 65535, 0), this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
    };
    Buffer2.prototype.writeUint16BE = Buffer2.prototype.writeUInt16BE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 2, 65535, 0), this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
    };
    Buffer2.prototype.writeUint32LE = Buffer2.prototype.writeUInt32LE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 4, 4294967295, 0), this[offset + 3] = value >>> 24, this[offset + 2] = value >>> 16, this[offset + 1] = value >>> 8, this[offset] = value & 255, offset + 4;
    };
    Buffer2.prototype.writeUint32BE = Buffer2.prototype.writeUInt32BE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 4, 4294967295, 0), this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      return buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo, lo = lo >> 8, buf[offset + 6] = lo, lo = lo >> 8, buf[offset + 5] = lo, lo = lo >> 8, buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      return buf[offset + 3] = hi, hi = hi >> 8, buf[offset + 2] = hi, hi = hi >> 8, buf[offset + 1] = hi, hi = hi >> 8, buf[offset] = hi, offset + 8;
    }
    Buffer2.prototype.writeBigUInt64LE = defineBigIntMethod(function(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer2.prototype.writeBigUInt64BE = defineBigIntMethod(function(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer2.prototype.writeIntLE = function(value, offset, byteLength2, noAssert) {
      if (value = +value, offset = offset >>> 0, !noAssert) {
        let limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0, mul = 1, sub = 0;
      for (this[offset] = value & 255; ++i < byteLength2 && (mul *= 256); )
        value < 0 && sub === 0 && this[offset + i - 1] !== 0 && (sub = 1), this[offset + i] = (value / mul >> 0) - sub & 255;
      return offset + byteLength2;
    };
    Buffer2.prototype.writeIntBE = function(value, offset, byteLength2, noAssert) {
      if (value = +value, offset = offset >>> 0, !noAssert) {
        let limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1, mul = 1, sub = 0;
      for (this[offset + i] = value & 255; --i >= 0 && (mul *= 256); )
        value < 0 && sub === 0 && this[offset + i + 1] !== 0 && (sub = 1), this[offset + i] = (value / mul >> 0) - sub & 255;
      return offset + byteLength2;
    };
    Buffer2.prototype.writeInt8 = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 1, 127, -128), value < 0 && (value = 255 + value + 1), this[offset] = value & 255, offset + 1;
    };
    Buffer2.prototype.writeInt16LE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 2, 32767, -32768), this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
    };
    Buffer2.prototype.writeInt16BE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 2, 32767, -32768), this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
    };
    Buffer2.prototype.writeInt32LE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 4, 2147483647, -2147483648), this[offset] = value & 255, this[offset + 1] = value >>> 8, this[offset + 2] = value >>> 16, this[offset + 3] = value >>> 24, offset + 4;
    };
    Buffer2.prototype.writeInt32BE = function(value, offset, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkInt(this, value, offset, 4, 2147483647, -2147483648), value < 0 && (value = 4294967295 + value + 1), this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
    };
    Buffer2.prototype.writeBigInt64LE = defineBigIntMethod(function(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer2.prototype.writeBigInt64BE = defineBigIntMethod(function(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22), ieee754.write(buf, value, offset, littleEndian, 23, 4), offset + 4;
    }
    Buffer2.prototype.writeFloatLE = function(value, offset, noAssert) {
      return writeFloat(this, value, offset, !0, noAssert);
    };
    Buffer2.prototype.writeFloatBE = function(value, offset, noAssert) {
      return writeFloat(this, value, offset, !1, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      return value = +value, offset = offset >>> 0, noAssert || checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292), ieee754.write(buf, value, offset, littleEndian, 52, 8), offset + 8;
    }
    Buffer2.prototype.writeDoubleLE = function(value, offset, noAssert) {
      return writeDouble(this, value, offset, !0, noAssert);
    };
    Buffer2.prototype.writeDoubleBE = function(value, offset, noAssert) {
      return writeDouble(this, value, offset, !1, noAssert);
    };
    Buffer2.prototype.copy = function(target, targetStart, start, end) {
      if (!Buffer2.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (start || (start = 0), !end && end !== 0 && (end = this.length), targetStart >= target.length && (targetStart = target.length), targetStart || (targetStart = 0), end > 0 && end < start && (end = start), end === start || target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0)
        throw new RangeError("targetStart out of bounds");
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      end > this.length && (end = this.length), target.length - targetStart < end - start && (end = target.length - targetStart + start);
      let len = end - start;
      return this === target && typeof Uint8Array.prototype.copyWithin == "function" ? this.copyWithin(targetStart, start, end) : Uint8Array.prototype.set.call(
        target,
        this.subarray(start, end),
        targetStart
      ), len;
    };
    Buffer2.prototype.fill = function(val, start, end, encoding) {
      if (typeof val == "string") {
        if (typeof start == "string" ? (encoding = start, start = 0, end = this.length) : typeof end == "string" && (encoding = end, end = this.length), encoding !== void 0 && typeof encoding != "string")
          throw new TypeError("encoding must be a string");
        if (typeof encoding == "string" && !Buffer2.isEncoding(encoding))
          throw new TypeError("Unknown encoding: " + encoding);
        if (val.length === 1) {
          let code = val.charCodeAt(0);
          (encoding === "utf8" && code < 128 || encoding === "latin1") && (val = code);
        }
      } else typeof val == "number" ? val = val & 255 : typeof val == "boolean" && (val = Number(val));
      if (start < 0 || this.length < start || this.length < end)
        throw new RangeError("Out of range index");
      if (end <= start)
        return this;
      start = start >>> 0, end = end === void 0 ? this.length : end >>> 0, val || (val = 0);
      let i;
      if (typeof val == "number")
        for (i = start; i < end; ++i)
          this[i] = val;
      else {
        let bytes = Buffer2.isBuffer(val) ? val : Buffer2.from(val, encoding), len = bytes.length;
        if (len === 0)
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        for (i = 0; i < end - start; ++i)
          this[i + start] = bytes[i % len];
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class extends Base {
        constructor() {
          super(), Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: !0,
            configurable: !0
          }), this.name = `${this.name} [${sym}]`, this.stack, delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: !0,
            enumerable: !0,
            value,
            writable: !0
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        return name ? `${name} is outside of buffer bounds` : "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`, received = input;
        return Number.isInteger(input) && Math.abs(input) > 2 ** 32 ? received = addNumericalSeparator(String(input)) : typeof input == "bigint" && (received = String(input), (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) && (received = addNumericalSeparator(received)), received += "n"), msg += ` It must be ${range}. Received ${received}`, msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "", i = val.length, start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3)
        res = `_${val.slice(i - 3, i)}${res}`;
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset"), (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) && boundsError(offset, buf.length - (byteLength2 + 1));
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        let n = typeof min == "bigint" ? "n" : "", range;
        throw byteLength2 > 3 ? min === 0 || min === BigInt(0) ? range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}` : range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}` : range = `>= ${min}${n} and <= ${max}${n}`, new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value != "number")
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
    }
    function boundsError(value, length, type) {
      throw Math.floor(value) !== value ? (validateNumber(value, type), new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value)) : length < 0 ? new errors.ERR_BUFFER_OUT_OF_BOUNDS() : new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      if (str = str.split("=")[0], str = str.trim().replace(INVALID_BASE64_RE, ""), str.length < 2) return "";
      for (; str.length % 4 !== 0; )
        str = str + "=";
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || 1 / 0;
      let codePoint, length = string.length, leadSurrogate = null, bytes = [];
      for (let i = 0; i < length; ++i) {
        if (codePoint = string.charCodeAt(i), codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              (units -= 3) > -1 && bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              (units -= 3) > -1 && bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            (units -= 3) > -1 && bytes.push(239, 191, 189), leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else leadSurrogate && (units -= 3) > -1 && bytes.push(239, 191, 189);
        if (leadSurrogate = null, codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else
          throw new Error("Invalid code point");
      }
      return bytes;
    }
    function asciiToBytes(str) {
      let byteArray = [];
      for (let i = 0; i < str.length; ++i)
        byteArray.push(str.charCodeAt(i) & 255);
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo, byteArray = [];
      for (let i = 0; i < str.length && !((units -= 2) < 0); ++i)
        c = str.charCodeAt(i), hi = c >> 8, lo = c % 256, byteArray.push(lo), byteArray.push(hi);
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length && !(i + offset >= dst.length || i >= src.length); ++i)
        dst[i + offset] = src[i];
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      let alphabet = "0123456789abcdef", table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        let i16 = i * 16;
        for (let j = 0; j < 16; ++j)
          table[i16 + j] = alphabet[i] + alphabet[j];
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt > "u" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// node_modules/msedge-tts/dist/Output.js
var require_Output = __commonJS({
  "node_modules/msedge-tts/dist/Output.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    exports2.OUTPUT_EXTENSIONS = exports2.OUTPUT_FORMAT = void 0;
    var OUTPUT_FORMAT2;
    (function(OUTPUT_FORMAT3) {
      OUTPUT_FORMAT3.AUDIO_24KHZ_48KBITRATE_MONO_MP3 = "audio-24khz-48kbitrate-mono-mp3", OUTPUT_FORMAT3.AUDIO_24KHZ_96KBITRATE_MONO_MP3 = "audio-24khz-96kbitrate-mono-mp3", OUTPUT_FORMAT3.WEBM_24KHZ_16BIT_MONO_OPUS = "webm-24khz-16bit-mono-opus";
    })(OUTPUT_FORMAT2 || (exports2.OUTPUT_FORMAT = OUTPUT_FORMAT2 = {}));
    exports2.OUTPUT_EXTENSIONS = {
      [OUTPUT_FORMAT2.AUDIO_24KHZ_48KBITRATE_MONO_MP3]: "mp3",
      [OUTPUT_FORMAT2.AUDIO_24KHZ_96KBITRATE_MONO_MP3]: "mp3",
      [OUTPUT_FORMAT2.WEBM_24KHZ_16BIT_MONO_OPUS]: "webm"
    };
  }
});

// node_modules/msedge-tts/dist/Prosody.js
var require_Prosody = __commonJS({
  "node_modules/msedge-tts/dist/Prosody.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    exports2.VOLUME = exports2.PITCH = exports2.RATE = exports2.ProsodyOptions = void 0;
    var ProsodyOptions = class {
      /**
       * The pitch to use.
       * Can be any {@link PITCH}, or a relative frequency in Hz (+50Hz), a relative semitone (+2st), or a relative percentage (+50%).
       * [SSML documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#:~:text=Optional-,pitch,-Indicates%20the%20baseline)
       */
      pitch = "+0Hz";
      /**
       * The rate to use.
       * Can be any {@link RATE}, or a relative number (0.5), or string with a relative percentage (+50%).
       * [SSML documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#:~:text=Optional-,rate,-Indicates%20the%20speaking)
       */
      rate = 1;
      /**
       * The volume to use.
       * Can be any {@link VOLUME}, or an absolute number (0, 100), a string with a relative number (+50), or a relative percentage (+50%).
       * [SSML documentation](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice#:~:text=Optional-,volume,-Indicates%20the%20volume)
       */
      volume = 100;
    };
    exports2.ProsodyOptions = ProsodyOptions;
    var RATE;
    (function(RATE2) {
      RATE2.X_SLOW = "x-slow", RATE2.SLOW = "slow", RATE2.MEDIUM = "medium", RATE2.FAST = "fast", RATE2.X_FAST = "x-fast", RATE2.DEFAULT = "default";
    })(RATE || (exports2.RATE = RATE = {}));
    var PITCH;
    (function(PITCH2) {
      PITCH2.X_LOW = "x-low", PITCH2.LOW = "low", PITCH2.MEDIUM = "medium", PITCH2.HIGH = "high", PITCH2.X_HIGH = "x-high", PITCH2.DEFAULT = "default";
    })(PITCH || (exports2.PITCH = PITCH = {}));
    var VOLUME;
    (function(VOLUME2) {
      VOLUME2.SILENT = "silent", VOLUME2.X_SOFT = "x-soft", VOLUME2.SOFT = "soft", VOLUME2.MEDIUM = "medium", VOLUME2.LOUD = "loud", VOLUME2.X_LOUD = "x-LOUD", VOLUME2.DEFAULT = "default";
    })(VOLUME || (exports2.VOLUME = VOLUME = {}));
  }
});

// node_modules/msedge-tts/dist/utils.js
var require_utils = __commonJS({
  "node_modules/msedge-tts/dist/utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    exports2.joinPath = void 0;
    var joinPath = (...parts) => parts.filter(Boolean).join("/").replace(/\/{2,}/g, "/");
    exports2.joinPath = joinPath;
  }
});

// node_modules/msedge-tts/dist/MsEdgeTTS.js
var require_MsEdgeTTS = __commonJS({
  "node_modules/msedge-tts/dist/MsEdgeTTS.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: !0, value: v });
    }) : function(o, v) {
      o.default = v;
    }), __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) k !== "default" && Object.prototype.hasOwnProperty.call(mod, k) && __createBinding(result, mod, k);
      return __setModuleDefault(result, mod), result;
    }, __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { default: mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    exports2.MsEdgeTTS = exports2.MetadataOptions = void 0;
    var axios_1 = __importDefault(require_axios()), isomorphic_ws_1 = __importDefault(require_node2()), index_1 = require_buffer(), Output_1 = require_Output(), stream_1 = require("stream"), fs2 = __importStar(require("fs")), Prosody_1 = require_Prosody(), utils_1 = require_utils(), MetadataOptions = class {
      /**
       * (optional) any voice locale that is supported by the voice. See the list of all voices for compatibility. If not provided, the locale will be inferred from the `voiceName`.
       * Changing the voiceName will reset the voiceLocale.
       */
      voiceLocale;
      /**
       * (optional) whether to enable sentence boundary metadata. Default is `false`
       */
      sentenceBoundaryEnabled = !1;
      /**
       * (optional) whether to enable word boundary metadata. Default is `false`
       */
      wordBoundaryEnabled = !1;
    };
    exports2.MetadataOptions = MetadataOptions;
    var messageTypes;
    (function(messageTypes2) {
      messageTypes2.TURN_START = "turn.start", messageTypes2.TURN_END = "turn.end", messageTypes2.RESPONSE = "response", messageTypes2.SPEECH_CONFIG = "speech.config", messageTypes2.AUDIO_METADATA = "audio.metadata", messageTypes2.AUDIO = "audio", messageTypes2.SSML = "ssml";
    })(messageTypes || (messageTypes = {}));
    var MsEdgeTTS2 = class _MsEdgeTTS {
      static TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
      static VOICES_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=${_MsEdgeTTS.TRUSTED_CLIENT_TOKEN}`;
      static WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
      static JSON_XML_DELIM = `\r
\r
`;
      static AUDIO_DELIM = `Path:audio\r
`;
      static VOICE_LANG_REGEX = /\w{2}-\w{2}/;
      _enableLogger;
      _isBrowser;
      _ws;
      _voice;
      _outputFormat;
      _metadataOptions = new MetadataOptions();
      _streams = {};
      _startTime = 0;
      _agent;
      _log(...o) {
        this._enableLogger && console.log(...o);
      }
      /**
       * Create a new `MsEdgeTTS` instance.
       *
       * @param options (optional) {@link Options}
       */
      constructor(options) {
        this._agent = options?.agent || void 0, this._enableLogger = options?.enableLogger || !1, this._isBrowser = typeof window < "u" && typeof window.document < "u";
      }
      static async getSynthUrl() {
        let req_id = _MsEdgeTTS.generateUUID(), secMsGEC = await _MsEdgeTTS.generateSecMsGec(this.TRUSTED_CLIENT_TOKEN);
        return `${this.WSS_URL}?TrustedClientToken=${this.TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=1-143.0.3650.96&ConnectionId=${req_id}`;
      }
      async _initClient() {
        let synthUrl = await _MsEdgeTTS.getSynthUrl(), options = {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
            Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
          }
        };
        return this._ws = this._isBrowser ? new isomorphic_ws_1.default(synthUrl, options) : new isomorphic_ws_1.default(synthUrl, { ...options, agent: this._agent }), this._ws.binaryType = "arraybuffer", new Promise((resolve, reject) => {
          this._ws.onopen = () => {
            this._log("Connected in", (Date.now() - this._startTime) / 1e3, "seconds"), this._send(`Content-Type:application/json; charset=utf-8\r
Path:${messageTypes.SPEECH_CONFIG}${_MsEdgeTTS.JSON_XML_DELIM}
                    {
                        "context": {
                            "synthesis": {
                                "audio": {
                                    "metadataoptions": {
                                        "sentenceBoundaryEnabled": "${this._metadataOptions.sentenceBoundaryEnabled}",
                                        "wordBoundaryEnabled": "${this._metadataOptions.wordBoundaryEnabled}"
                                    },
                                    "outputFormat": "${this._outputFormat}" 
                                }
                            }
                        }
                    }
                `).then(resolve);
          }, this._ws.onmessage = (m) => {
            let buffer = index_1.Buffer.from(m.data), message = buffer.toString(), requestId = /X-RequestId:(.*?)\r\n/gm.exec(message)[1];
            if (message.includes(`Path:${messageTypes.TURN_START}`))
              this._log("->", message);
            else if (message.includes(`Path:${messageTypes.TURN_END}`))
              this._log("->", message), this._streams[requestId].turnEnded = !0, this._streams[requestId].audio.push(null);
            else if (message.includes(`Path:${messageTypes.RESPONSE}`))
              this._log("->", message);
            else if (message.includes(`Path:${messageTypes.AUDIO_METADATA}`)) {
              let dataStartIndex = buffer.indexOf(_MsEdgeTTS.JSON_XML_DELIM) + _MsEdgeTTS.JSON_XML_DELIM.length, data = buffer.subarray(dataStartIndex);
              this._log("->", message), this._pushMetadata(data, requestId);
            } else if (message.includes(`Path:${messageTypes.AUDIO}`) && m.data instanceof ArrayBuffer) {
              let dataStartIndex = buffer.indexOf(_MsEdgeTTS.AUDIO_DELIM) + _MsEdgeTTS.AUDIO_DELIM.length, headers = buffer.subarray(0, dataStartIndex).toString(), data = buffer.subarray(dataStartIndex);
              this._log("->", headers), this._pushAudioData(data, requestId);
            } else
              this._log("->", "UNKNOWN MESSAGE", message);
          }, this._ws.onclose = () => {
            this._log("disconnected after:", (Date.now() - this._startTime) / 1e3, "seconds");
            for (let requestId in this._streams) {
              let stream = this._streams[requestId];
              stream.turnEnded ? stream.audio.push(null) : stream.audio.destroy(new Error("Stream closed before the synthesis completed (no turn.end received). The audio is likely truncated."));
            }
          }, this._ws.onerror = (event) => {
            let underlying = event?.error ?? event, message = underlying?.message ?? String(underlying), code = underlying?.code ?? event?.code, wrapped = new Error(`Edge TTS WebSocket error: ${message}${code ? ` (code=${code})` : ""}`);
            wrapped.cause = underlying, reject(wrapped);
          };
        });
      }
      static generateUUID() {
        return "xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
          let r = Math.random() * 16 | 0;
          return (c === "x" ? r : r & 3 | 8).toString(16);
        });
      }
      static async generateSecMsGec(trustedClientToken) {
        let ticks = Math.floor(Date.now() / 1e3) + 11644473600, windowsTicks = (ticks - ticks % 300) * 1e7, data = new TextEncoder().encode(`${windowsTicks}${trustedClientToken}`), hashBuffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      }
      async _send(message) {
        for (let i = 1; i <= 3 && this._ws.readyState !== this._ws.OPEN; i++)
          i == 1 && (this._startTime = Date.now()), this._log("connecting: ", i), await this._initClient();
        this._ws.send(message, () => {
          this._log("<-", message);
        });
      }
      _pushAudioData(data, requestId) {
        this._streams[requestId].audio.push(data);
      }
      _pushMetadata(data, requestId) {
        this._streams[requestId].metadata.push(data);
      }
      _SSMLTemplate(input, options = {}) {
        return options = { ...new Prosody_1.ProsodyOptions(), ...options }, `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this._metadataOptions.voiceLocale}">
                <voice name="${this._voice}">
                    <prosody pitch="${options.pitch}" rate="${options.rate}" volume="${options.volume}">
                        ${input}
                    </prosody> 
                </voice>
            </speak>`;
      }
      /**
       * Fetch the list of voices available in Microsoft Edge.
       * These, however, are not all. The complete list of voices supported by this module [can be found here](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support) (neural, standard, and preview).
       */
      getVoices() {
        return new Promise((resolve, reject) => {
          axios_1.default.get(_MsEdgeTTS.VOICES_URL).then((res) => resolve(res.data)).catch(reject);
        });
      }
      /**
       * Sets the required information for the speech to be synthesised and inits a new WebSocket connection.
       * Must be called at least once before text can be synthesised.
       * Saved in this instance. Can be called at any time times to update the metadata.
       * Merges specified values into previously provided values.
       *
       * @param voiceName a string with any `ShortName`. A list of all available neural voices can be found [here](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support#neural-voices). However, it is not limited to neural voices: standard voices can also be used. A list of standard voices can be found [here](https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support#standard-voices). Changing the voiceName will reset the voiceLocale.
       * @param outputFormat any {@link OUTPUT_FORMAT}
       * @param metadataOptions (optional) {@link MetadataOptions}
       */
      async setMetadata(voiceName, outputFormat, metadataOptions) {
        let oldVoice = this._voice, oldOutputFormat = this._outputFormat, oldOptions = JSON.stringify(this._metadataOptions);
        if (this._voice = voiceName, !this._metadataOptions.voiceLocale || !metadataOptions.voiceLocale && oldVoice !== this._voice) {
          let voiceLangMatch = _MsEdgeTTS.VOICE_LANG_REGEX.exec(this._voice);
          if (!voiceLangMatch)
            throw new Error("Could not infer voiceLocale from voiceName, and no voiceLocale was specified!");
          this._metadataOptions.voiceLocale = voiceLangMatch[0];
        }
        this._outputFormat = outputFormat, Object.assign(this._metadataOptions, metadataOptions), !(!(oldVoice !== this._voice || oldOutputFormat !== this._outputFormat || oldOptions !== JSON.stringify(this._metadataOptions)) && this._ws.readyState === this._ws.OPEN) && (this._startTime = Date.now(), await this._initClient());
      }
      _metadataCheck() {
        if (!this._ws)
          throw new Error("Speech synthesis not configured yet. Run setMetadata before calling toStream or toFile.");
      }
      /**
       * Close the WebSocket connection.
       */
      close() {
        this._ws?.close();
      }
      /**
       * Writes raw audio synthesised from text to a file. Uses a basic {@link _SSMLTemplate SML template}.
       *
       * @param dirPath a valid output directory path
       * @param input the input to synthesise
       * @param options (optional) {@link ProsodyOptions}
       @returns {Promise<{audioFilePath: string, metadataFilePath: string | null}>} - a `Promise` with the full filepaths
       */
      toFile(dirPath, input, options) {
        return this._rawSSMLRequestToFile(dirPath, this._SSMLTemplate(input, options));
      }
      /**
       * Writes raw audio synthesised from text in real-time to a {@link Readable}. Uses a basic {@link _SSMLTemplate SML template}.
       *
       * @param input the text to synthesise. Can include SSML elements.
       * @param options (optional) {@link ProsodyOptions}
       @returns {Promise<{audioStream: Readable, metadataStream: Readable | null}>} - a `Promise` with the streams
       */
      toStream(input, options) {
        return this._rawSSMLRequest(this._SSMLTemplate(input, options));
      }
      /**
       * Writes raw audio synthesised from text to a file. Has no SSML template. Basic SSML should be provided in the request.
       *
       * @param dirPath a valid output directory path.
       * @param requestSSML the SSML to send. SSML elements required in order to work.
       * @returns {Promise<{audioFilePath: string, metadataFilePath: string | null}>} - a `Promise` with the full filepaths
       */
      rawToFile(dirPath, requestSSML) {
        return this._rawSSMLRequestToFile(dirPath, requestSSML);
      }
      /**
       * Writes raw audio synthesised from a request in real-time to a {@link Readable}. Has no SSML template. Basic SSML should be provided in the request.
       *
       * @param requestSSML the SSML to send. SSML elements required in order to work.
       @returns {Promise<{audioStream: Readable, metadataStream: Readable | null}>} - a `Promise` with the streams
       */
      rawToStream(requestSSML) {
        return this._rawSSMLRequest(requestSSML);
      }
      _hasMetadataBoundaries() {
        return this._metadataOptions.sentenceBoundaryEnabled || this._metadataOptions.wordBoundaryEnabled;
      }
      async _rawSSMLRequestToFile(dirPath, requestSSML) {
        let { audioStream, metadataStream, requestId } = this._rawSSMLRequest(requestSSML), audioFilePath = (0, utils_1.joinPath)(dirPath, "audio." + Output_1.OUTPUT_EXTENSIONS[this._outputFormat]), metadataFilePath = metadataStream ? (0, utils_1.joinPath)(dirPath, "metadata.json") : null;
        try {
          return await Promise.all([
            new Promise((resolve, reject) => {
              let writableAudioFile = audioStream.pipe(fs2.createWriteStream(audioFilePath));
              audioStream.once("error", (e) => {
                writableAudioFile.destroy(), reject(e);
              }), writableAudioFile.once("close", async () => {
                writableAudioFile.bytesWritten > 0 ? resolve(audioFilePath) : (reject(new Error("No audio data received")), fs2.unlinkSync(audioFilePath));
              }), writableAudioFile.once("error", reject);
            }),
            new Promise((resolve, reject) => {
              if (!metadataFilePath)
                return resolve(null);
              let metadataItems = { Metadata: [] };
              metadataStream.on("data", (chunk) => {
                let chunkObj = JSON.parse(chunk.toString());
                metadataItems.Metadata.push(...chunkObj.Metadata);
              }), metadataStream.once("close", () => {
                metadataItems.Metadata.length > 0 ? (fs2.writeFileSync(metadataFilePath, JSON.stringify(metadataItems, null, 2)), resolve(metadataFilePath)) : (reject(new Error("No metadata received")), fs2.unlinkSync(metadataFilePath));
              }), metadataStream.once("error", reject);
            })
          ]), { audioFilePath, metadataFilePath, requestId };
        } catch (e) {
          throw audioStream.destroy(), metadataStream?.destroy(), e;
        }
      }
      static randomHex(bytes) {
        let arr = new Uint8Array(bytes);
        return crypto.getRandomValues(arr), Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
      }
      _rawSSMLRequest(requestSSML) {
        this._metadataCheck();
        let requestId = _MsEdgeTTS.randomHex(16), request = `X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
Path:${messageTypes.SSML}${_MsEdgeTTS.JSON_XML_DELIM}` + requestSSML.trim(), self2 = this, audioStream = new stream_1.Readable({
          read() {
          },
          destroy(error, callback) {
            delete self2._streams[requestId], callback(error);
          }
        }), metadataStream = this._hasMetadataBoundaries() ? new stream_1.Readable({
          read() {
          }
        }) : null;
        return audioStream.on("error", (e) => {
          audioStream.destroy(), metadataStream?.destroy();
        }), audioStream.once("close", () => {
          audioStream.destroy(), metadataStream?.destroy();
        }), this._streams[requestId] = {
          audio: audioStream,
          metadata: metadataStream,
          turnEnded: !1
        }, this._send(request).then(), { audioStream, metadataStream, requestId };
      }
    };
    exports2.MsEdgeTTS = MsEdgeTTS2;
  }
});

// node_modules/msedge-tts/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/msedge-tts/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k);
      var desc = Object.getOwnPropertyDescriptor(m, k);
      (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) && (desc = { enumerable: !0, get: function() {
        return m[k];
      } }), Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      k2 === void 0 && (k2 = k), o[k2] = m[k];
    })), __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p) && __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: !0 });
    __exportStar(require_MsEdgeTTS(), exports2);
    __exportStar(require_Output(), exports2);
    __exportStar(require_Prosody(), exports2);
  }
});

// src/shell/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SpeakingEditorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/shell/sync-field.ts
var import_state = require("@codemirror/state"), import_view = require("@codemirror/view"), setWords = import_state.StateEffect.define(), setPosition = import_state.StateEffect.define(), clearAll = import_state.StateEffect.define();
function mapEntries(entries, changes) {
  return entries.map((e) => {
    let runs = e.runs.map((r) => ({ from: changes.mapPos(r.from, 1), to: changes.mapPos(r.to, -1) })).filter((r) => r.to > r.from), dirty = e.dirty || runs.length === 0;
    return changes.iterChangedRanges((fromA, toA) => {
      for (let r of e.runs) fromA < r.to && toA > r.from && (dirty = !0);
    }), { ...e, runs, dirty };
  });
}
var sentenceDeco = import_view.Decoration.mark({ class: "se-sentence" }), wordDeco = import_view.Decoration.mark({ class: "se-word" }), syncField = import_state.StateField.define({
  create: () => ({ words: [], word: -1, sentence: -1 }),
  update(value, tr) {
    let v = value;
    tr.docChanged && (v = { ...v, words: mapEntries(v.words, tr.changes) });
    for (let e of tr.effects)
      e.is(setWords) && (v = { ...v, words: e.value }), e.is(setPosition) && (v = { ...v, word: e.value.word, sentence: e.value.sentence }), e.is(clearAll) && (v = { words: [], word: -1, sentence: -1 });
    return v;
  },
  provide: (f) => import_view.EditorView.decorations.from(f, (v) => {
    let deco = [], word = v.words[v.word];
    for (let e of v.words)
      if (!(e.sentence !== v.sentence || e.dirty))
        for (let r of e.runs) deco.push({ from: r.from, to: r.to, d: sentenceDeco });
    if (word && !word.dirty) for (let r of word.runs) deco.push({ from: r.from, to: r.to, d: wordDeco });
    return deco.sort((a, b) => a.from - b.from || a.to - b.to), import_view.Decoration.set(deco.map((x) => x.d.range(x.from, x.to)), !0);
  })
});

// src/shell/session.ts
var import_view2 = require("@codemirror/view");

// src/engine/core/document-model.ts
var ABBREVIATION_PATTERN = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g|a\.m|p\.m)\./gi;
function splitIntoSentenceSpans(text) {
  let processed = text.replace(
    ABBREVIATION_PATTERN,
    (match) => match.replace(/\./g, "\0")
  ), spans = [], start = 0;
  for (let i = 0; i < processed.length; i++) {
    if (!/[.!?]/.test(processed[i])) continue;
    let end = i + 1;
    for (; end < processed.length && /["')\]]/.test(processed[end]); )
      end++;
    if (!(end < processed.length && !/\s/.test(processed[end]))) {
      for (pushTrimmedSpan(text, spans, start, end); end < processed.length && /\s/.test(processed[end]); )
        end++;
      start = end, i = end - 1;
    }
  }
  return pushTrimmedSpan(text, spans, start, text.length), spans;
}
function pushTrimmedSpan(source, spans, start, end) {
  for (; start < end && /\s/.test(source[start]); ) start++;
  for (; end > start && /\s/.test(source[end - 1]); ) end--;
  start < end && spans.push({
    text: source.slice(start, end),
    start,
    end
  });
}
function cleanLineInto(line, lineOffset, output, offsets) {
  let i = getReadableLineStart(line);
  for (; i < line.length; ) {
    if (line.startsWith("![", i)) {
      let closeBracket = line.indexOf("]", i + 2), openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1, closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        appendRange(line, lineOffset, i + 2, closeBracket, output, offsets), i = closeParen + 1;
        continue;
      }
    }
    if (line[i] === "[") {
      let closeBracket = line.indexOf("]", i + 1), openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1, closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        appendRange(line, lineOffset, i + 1, closeBracket, output, offsets), i = closeParen + 1;
        continue;
      }
    }
    if (line[i] === "`") {
      let end = line.indexOf("`", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "<") {
      let end = line.indexOf(">", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "\\" && i + 1 < line.length) {
      i++, appendChar(line[i], lineOffset + i, output, offsets), i++;
      continue;
    }
    if (/[*_~]/.test(line[i])) {
      i++;
      continue;
    }
    appendChar(line[i], lineOffset + i, output, offsets), i++;
  }
}
function getReadableLineStart(line) {
  let markerMatch = line.match(
    /^\s*(?:(?:#{1,6}|>)\s+|(?:[-*+]|\d+[.)])\s+)/
  );
  return markerMatch ? markerMatch[0].length : 0;
}
function appendRange(source, baseOffset, start, end, output, offsets) {
  for (let i = start; i < end; i++)
    appendChar(source[i], baseOffset + i, output, offsets);
}
function appendChar(char, offset, output, offsets) {
  if (/\s/.test(char)) {
    output.length > 0 && !/\s/.test(output[output.length - 1]) && (output.push(" "), offsets.push(offset));
    return;
  }
  output.push(char), offsets.push(offset);
}
function cleanBlockWithOffsets(raw, baseOffset) {
  let lines = raw.split(`
`), output = [], offsets = [], rel = 0;
  for (let line of lines)
    cleanLineInto(line, baseOffset + rel, output, offsets), rel += line.length + 1, output.length > 0 && !/\s/.test(output[output.length - 1]) && (output.push(" "), offsets.push(baseOffset + rel - 1));
  return { text: output.join(""), offsets };
}
function segmentBlocks(lines, firstLine) {
  let blocks = [], current, flush = () => {
    current && current.lines.length && blocks.push(current), current = void 0;
  }, inCode = !1;
  for (let i = firstLine; i < lines.length; i++) {
    let line = lines[i];
    if (line.trimStart().startsWith("```")) {
      inCode ? (inCode = !1, current?.lines.push(line), flush()) : (flush(), inCode = !0, current = { kind: "code", startLine: i, lines: [line] });
      continue;
    }
    if (inCode) {
      current.lines.push(line);
      continue;
    }
    if (line.trim().length === 0 || /^[-*_]{3,}\s*$/.test(line)) {
      flush();
      continue;
    }
    let heading = line.match(/^(#{1,6})\s+/);
    if (heading) {
      flush(), blocks.push({ kind: "heading", level: heading[1].length, startLine: i, lines: [line] });
      continue;
    }
    let isList = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line), isQuote = /^\s*>/.test(line), kind = isList ? "list-item" : isQuote ? "quote" : "paragraph";
    if (isList) {
      flush(), current = { kind, startLine: i, lines: [line] };
      continue;
    }
    (!current || current.kind !== kind) && (flush(), current = { kind, startLine: i, lines: [] }), current.lines.push(line);
  }
  return flush(), blocks;
}
function sentencesFromBlock(raw, baseOffset) {
  let clean = cleanBlockWithOffsets(raw, baseOffset);
  return splitIntoSentenceSpans(clean.text).flatMap((span) => {
    let start = clean.offsets[span.start], end = clean.offsets[span.end - 1];
    if (start === void 0 || end === void 0) return [];
    let wordDrafts = [], re = /\S+/g, m, sentenceClean = clean.text.slice(span.start, span.end);
    for (; (m = re.exec(sentenceClean)) !== null; ) {
      let ws = clean.offsets[span.start + m.index], we = clean.offsets[span.start + m.index + m[0].length - 1];
      ws === void 0 || we === void 0 || wordDrafts.push({ text: m[0], source: { start: ws, end: we + 1 } });
    }
    return [{ text: span.text, source: { start, end: end + 1 }, wordDrafts }];
  });
}
function parseDocument(text, uri, version) {
  let lines = text.split(`
`), lineOffsets = [], off = 0;
  for (let l of lines)
    lineOffsets.push(off), off += l.length + 1;
  let firstLine = 0;
  if (lines[0]?.trim() === "---") {
    let end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    end > 0 && (firstLine = end + 1);
  }
  let blocks = [], sentences = [], words = [];
  for (let raw of segmentBlocks(lines, firstLine)) {
    let base = lineOffsets[raw.startLine], rawText = raw.lines.join(`
`), source = { start: base, end: base + rawText.length };
    if (raw.kind === "code") {
      blocks.push({ kind: "code", sentences: [], source, codeText: rawText });
      continue;
    }
    let blockSentences = [];
    for (let d of sentencesFromBlock(rawText, base)) {
      let s = {
        index: sentences.length + blockSentences.length,
        text: d.text,
        source: d.source,
        words: []
      };
      for (let wd of d.wordDrafts) {
        let w = { index: words.length, text: wd.text, source: wd.source };
        words.push(w), s.words.push(w);
      }
      blockSentences.push(s);
    }
    sentences.push(...blockSentences), blocks.push({ kind: raw.kind, level: raw.level, sentences: blockSentences, source });
  }
  return { uri, version, blocks, sentences, words };
}

// src/engine/core/chunker.ts
function buildChunks(model, maxChars = 2200, minChars = 1400) {
  let blockOf = /* @__PURE__ */ new Map();
  model.blocks.forEach((b, bi) => b.sentences.forEach((s) => blockOf.set(s.index, bi)));
  let chunks = [], cur = [], curLen = 0, flush = () => {
    if (!cur.length) return;
    let parts = [], words = [], pos = 0;
    for (let si of cur) {
      let s = model.sentences[si];
      parts.length && (parts.push(" "), pos += 1);
      let search = 0;
      for (let w of s.words) {
        let at = s.text.indexOf(w.text, search);
        at >= 0 && (words.push({ wordIndex: w.index, charStart: pos + at, charEnd: pos + at + w.text.length }), search = at + w.text.length);
      }
      parts.push(s.text), pos += s.text.length;
    }
    chunks.push({ index: chunks.length, text: parts.join(""), sentenceIndexes: cur, words }), cur = [], curLen = 0;
  };
  for (let s of model.sentences) {
    let addLen = s.text.length + (cur.length ? 1 : 0);
    cur.length && curLen + addLen > maxChars && flush();
    let prevBlock = cur.length ? blockOf.get(cur[cur.length - 1]) : void 0;
    cur.length && curLen >= minChars && blockOf.get(s.index) !== prevBlock && flush(), cur.push(s.index), curLen += addLen;
  }
  return flush(), chunks;
}

// src/engine/core/timing.ts
var TICKS_PER_MS = 1e4, norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
function timingsFromEdge(chunk, events) {
  let words = [], wi = 0;
  for (let ev of events) {
    let target = norm(ev.text);
    if (target)
      for (let look = wi; look < Math.min(wi + 3, chunk.words.length); look++) {
        let ref = chunk.words[look], wordText = chunk.text.slice(ref.charStart, ref.charEnd);
        if (norm(wordText) === target || norm(wordText).startsWith(target)) {
          words.push({
            wordIndex: ref.wordIndex,
            start: Math.round(ev.offsetTicks / TICKS_PER_MS),
            end: Math.round((ev.offsetTicks + ev.durationTicks) / TICKS_PER_MS)
          }), wi = look + 1;
          break;
        }
      }
  }
  return { unit: "ms", words };
}

// src/engine/synthesis/disk-cache.ts
var import_crypto = require("crypto"), import_fs = require("fs"), import_path = require("path"), DiskCache = class {
  constructor(dir, maxBytes) {
    this.dir = dir;
    this.maxBytes = maxBytes;
  }
  dir;
  maxBytes;
  accessClock = 0;
  static makeKey(text, providerId, voiceId) {
    return (0, import_crypto.createHash)("sha256").update(`${text} ${providerId} ${voiceId}`).digest("hex").slice(0, 24);
  }
  binPath(key) {
    return (0, import_path.join)(this.dir, `${key}.bin`);
  }
  metaPath(key) {
    return (0, import_path.join)(this.dir, `${key}.json`);
  }
  async get(key) {
    try {
      let meta = JSON.parse(await import_fs.promises.readFile(this.metaPath(key), "utf8")), audio = new Uint8Array(await import_fs.promises.readFile(this.binPath(key)));
      return meta.lastAccess = Date.now() + ++this.accessClock, await import_fs.promises.writeFile(this.metaPath(key), JSON.stringify(meta)), { audio, format: meta.format, timings: meta.timings };
    } catch {
      return;
    }
  }
  async set(key, value) {
    await import_fs.promises.mkdir(this.dir, { recursive: !0 });
    let meta = {
      format: value.format,
      timings: value.timings,
      size: value.audio.byteLength,
      lastAccess: Date.now() + ++this.accessClock
    };
    await import_fs.promises.writeFile(this.binPath(key), Buffer.from(value.audio)), await import_fs.promises.writeFile(this.metaPath(key), JSON.stringify(meta)), await this.evictIfNeeded();
  }
  async evictIfNeeded() {
    let entries = [];
    try {
      let files = await import_fs.promises.readdir(this.dir);
      for (let f of files) {
        if (!f.endsWith(".json")) continue;
        let key = f.slice(0, -5);
        try {
          entries.push({ key, meta: JSON.parse(await import_fs.promises.readFile(this.metaPath(key), "utf8")) });
        } catch {
          entries.push({ key, meta: { format: "mp3", timings: { unit: "ms", words: [] }, size: 0, lastAccess: 0 } });
        }
      }
    } catch {
      return;
    }
    let total = entries.reduce((n, e) => n + e.meta.size, 0);
    if (!(total <= this.maxBytes)) {
      entries.sort((a, b) => a.meta.lastAccess - b.meta.lastAccess);
      for (let e of entries) {
        if (total <= this.maxBytes) break;
        await import_fs.promises.rm(this.binPath(e.key), { force: !0 }), await import_fs.promises.rm(this.metaPath(e.key), { force: !0 }), total -= e.meta.size;
      }
    }
  }
};

// src/engine/synthesis/synthesis-service.ts
var SynthesisService = class {
  constructor(provider, voice, cache) {
    this.provider = provider;
    this.voice = voice;
    this.cache = cache;
  }
  provider;
  voice;
  cache;
  inFlight = /* @__PURE__ */ new Map();
  queue = [];
  working = !1;
  seq = 0;
  controller = new AbortController();
  request(chunk, priority = !1) {
    let existing = this.inFlight.get(chunk.index);
    if (existing)
      return priority && this.bump(chunk.index), existing;
    let promise = new Promise((resolve, reject) => {
      this.queue.push({ chunk, priority, seq: this.seq++, resolve, reject }), this.queue.sort(
        (a, b) => a.priority !== b.priority ? a.priority ? -1 : 1 : a.seq - b.seq
      );
    });
    return this.inFlight.set(chunk.index, promise), promise.catch(() => {
    }).finally(() => this.inFlight.delete(chunk.index)), this.work(), promise;
  }
  bump(chunkIndex) {
    let job = this.queue.find((j) => j.chunk.index === chunkIndex);
    job && (job.priority = !0, this.queue.sort(
      (a, b) => a.priority !== b.priority ? a.priority ? -1 : 1 : a.seq - b.seq
    ));
  }
  abortAll() {
    this.controller.abort(), this.controller = new AbortController();
    for (let job of this.queue.splice(0)) job.reject(new Error("aborted"));
  }
  async work() {
    if (!this.working) {
      this.working = !0;
      try {
        for (; this.queue.length; ) {
          let job = this.queue.shift();
          try {
            let key = DiskCache.makeKey(job.chunk.text, this.provider.id, this.voice), cached = await this.cache?.get(key);
            if (cached) {
              job.resolve(cached);
              continue;
            }
            let result;
            try {
              result = await this.provider.synthesize(job.chunk, this.voice, this.controller.signal);
            } catch (first) {
              if (this.controller.signal.aborted) throw first;
              result = await this.provider.synthesize(job.chunk, this.voice, this.controller.signal);
            }
            await this.cache?.set(key, result), job.resolve(result);
          } catch (err) {
            job.reject(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } finally {
        this.working = !1;
      }
    }
  }
};

// src/engine/synthesis/edge.ts
var import_msedge_tts = __toESM(require_dist2());
var FALLBACK_VOICES = [
  { id: "en-US-AriaNeural", label: "Aria (US)" },
  { id: "en-US-GuyNeural", label: "Guy (US)" },
  { id: "en-GB-SoniaNeural", label: "Sonia (UK)" },
  { id: "en-IN-NeerjaNeural", label: "Neerja (IN)" },
  { id: "en-AU-NatashaNeural", label: "Natasha (AU)" }
], EdgeProvider = class {
  id = "edge";
  label = "Edge TTS (free)";
  requiresKey = !1;
  timingQuality = "exact";
  maxCharsPerRequest = 6e3;
  defaultVoice = "en-US-AriaNeural";
  async listVoices() {
    try {
      let en = (await new import_msedge_tts.MsEdgeTTS().getVoices()).filter((v) => v.Locale.startsWith("en-")).map((v) => ({ id: v.ShortName, label: v.FriendlyName ?? v.ShortName }));
      return en.length > 0 ? en : FALLBACK_VOICES;
    } catch {
      return FALLBACK_VOICES;
    }
  }
  async synthesize(chunk, voice, signal) {
    if (signal.aborted) throw new Error("aborted");
    let tts = new import_msedge_tts.MsEdgeTTS();
    await tts.setMetadata(voice, import_msedge_tts.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: !0,
      sentenceBoundaryEnabled: !1
    });
    let { audioStream, metadataStream } = tts.toStream(chunk.text), audioParts = [], boundaries = [];
    return new Promise((resolve, reject) => {
      let settled = !1, cleanup = () => {
        signal.removeEventListener("abort", onAbort);
        try {
          audioStream.destroy();
        } catch {
        }
        try {
          metadataStream?.destroy();
        } catch {
        }
        try {
          tts.close();
        } catch {
        }
      }, fail = (err) => {
        settled || (settled = !0, cleanup(), reject(err instanceof Error ? err : new Error(String(err))));
      }, succeed = (value) => {
        settled || (settled = !0, cleanup(), resolve(value));
      }, onAbort = () => fail(new Error("aborted"));
      signal.addEventListener("abort", onAbort, { once: !0 }), audioStream.on("data", (d) => audioParts.push(d)), audioStream.on("error", fail), metadataStream?.on("data", (d) => {
        try {
          let parsed = JSON.parse(d.toString("utf8"));
          for (let m of parsed.Metadata ?? [])
            m.Type === "WordBoundary" && boundaries.push({
              text: m.Data?.text?.Text ?? "",
              offsetTicks: m.Data?.Offset ?? 0,
              durationTicks: m.Data?.Duration ?? 0
            });
        } catch {
        }
      }), metadataStream?.on("error", fail);
      let finish = () => {
        if (settled) return;
        let audio = new Uint8Array(Buffer.concat(audioParts));
        if (audio.byteLength === 0) {
          fail(new Error("Edge TTS returned no audio"));
          return;
        }
        succeed({ audio, format: "mp3", timings: timingsFromEdge(chunk, boundaries) });
      };
      audioStream.on("end", finish), audioStream.on("close", finish);
    });
  }
};

// src/playback/engine.ts
var PREFETCH = 2, Engine = class {
  constructor(model, chunks, cb) {
    this.model = model;
    this.chunks = chunks;
    this.cb = cb;
    for (let s of model.sentences) {
      s.words.length && this.sentenceFirstWord.set(s.index, s.words[0].index);
      for (let w of s.words) this.wordToSentence.set(w.index, s.index);
    }
    for (let c of chunks) for (let ref of c.words) this.wordToChunk.set(ref.wordIndex, c.index);
  }
  model;
  chunks;
  cb;
  loaded = /* @__PURE__ */ new Map();
  currentChunk = 0;
  currentWord = -1;
  speed = 1;
  playing = !1;
  pendingJumpWord = null;
  wordToSentence = /* @__PURE__ */ new Map();
  wordToChunk = /* @__PURE__ */ new Map();
  sentenceFirstWord = /* @__PURE__ */ new Map();
  start(chunkIndex) {
    this.currentChunk = chunkIndex, this.playing = !0, this.cb.requestChunk(chunkIndex, !0), this.prefetch(chunkIndex + 1);
  }
  /**
   * Load (and seek to) a word without playing. Used after a reconfigure when the
   * session was paused: we want the new voice primed at the same spot so a later
   * resume/play picks up exactly where the listener left off, but we must NOT
   * auto-play. Sets currentWord so resume() and currentSentence resolve correctly,
   * and reports "paused" so the UI shows a play (not pause) affordance.
   */
  primeAt(wordIndex) {
    let chunkIndex = this.wordToChunk.get(wordIndex);
    if (chunkIndex === void 0) return;
    this.currentChunk = chunkIndex, this.currentWord = wordIndex, this.playing = !1;
    let lc = this.loaded.get(chunkIndex);
    if (lc && lc.timingsMs !== null) {
      let t = lc.timingsMs.find((w) => w.wordIndex === wordIndex);
      lc.audio.currentTime = t ? t.start / 1e3 : 0;
    } else
      this.pendingJumpWord = wordIndex, this.cb.requestChunk(chunkIndex, !0);
    this.prefetch(chunkIndex + 1), this.cb.onState("paused");
  }
  prefetch(from) {
    for (let i = from; i < Math.min(from + PREFETCH, this.chunks.length); i++)
      this.loaded.has(i) || this.cb.requestChunk(i, !1);
  }
  receiveChunk(chunkIndex, data) {
    if (this.loaded.has(chunkIndex)) return;
    let url = this.cb.makeUrl(data.audio, data.format), audio = this.cb.createAudio();
    audio.preservesPitch = !0, audio.playbackRate = this.speed, audio.src = url;
    let lc = {
      audio,
      url,
      rawTimings: data.timings,
      timingsMs: data.timings.unit === "ms" ? data.timings.words : null
    };
    audio.onloadedmetadata = () => {
      if (lc.timingsMs === null) {
        let durMs = audio.duration * 1e3;
        lc.timingsMs = data.timings.words.map((w) => ({
          wordIndex: w.wordIndex,
          start: w.start * durMs,
          end: w.end * durMs
        }));
      }
      this.maybeStartChunk(chunkIndex);
    }, audio.onended = () => this.handoff(chunkIndex), this.loaded.set(chunkIndex, lc), Number.isNaN(audio.duration) || audio.onloadedmetadata?.();
  }
  maybeStartChunk(chunkIndex) {
    if (chunkIndex !== this.currentChunk) return;
    let lc = this.loaded.get(chunkIndex);
    if (!(!lc || lc.timingsMs === null)) {
      if (this.pendingJumpWord !== null) {
        let t = lc.timingsMs.find((w) => w.wordIndex === this.pendingJumpWord);
        lc.audio.currentTime = t ? t.start / 1e3 : 0, this.pendingJumpWord = null;
      }
      this.playing && (lc.audio.play().catch(() => this.cb.onState("paused")), this.cb.onState("playing"));
    }
  }
  handoff(endedChunk) {
    if (endedChunk !== this.currentChunk) return;
    let next = this.currentChunk + 1;
    if (next >= this.chunks.length) {
      this.playing = !1, this.cb.onState("ended");
      return;
    }
    this.currentChunk = next, this.prefetch(next + 1);
    let lc = this.loaded.get(next);
    lc && lc.timingsMs !== null ? (lc.audio.currentTime = 0, lc.audio.play().catch(() => this.cb.onState("paused")), this.cb.onState("playing")) : this.cb.requestChunk(next, !0);
  }
  pause() {
    this.loaded.get(this.currentChunk)?.audio.pause(), this.playing = !1, this.cb.onState("paused");
  }
  resume() {
    this.playing = !0;
    let sentence = this.wordToSentence.get(Math.max(this.currentWord, 0)) ?? 0, firstWord = this.sentenceFirstWord.get(sentence);
    firstWord !== void 0 ? this.jumpToWord(firstWord) : this.maybeStartChunk(this.currentChunk);
  }
  jumpToWord(wordIndex) {
    let chunkIndex = this.wordToChunk.get(wordIndex);
    if (chunkIndex === void 0) return;
    this.loaded.get(this.currentChunk)?.audio.pause(), this.currentChunk = chunkIndex, this.currentWord = wordIndex, this.playing = !0;
    let lc = this.loaded.get(chunkIndex);
    if (lc && lc.timingsMs !== null) {
      let t = lc.timingsMs.find((w) => w.wordIndex === wordIndex);
      lc.audio.currentTime = t ? t.start / 1e3 : 0, lc.audio.play().catch(() => this.cb.onState("paused")), this.cb.onState("playing"), this.prefetch(chunkIndex + 1);
    } else
      this.pendingJumpWord = wordIndex, this.cb.requestChunk(chunkIndex, !0), this.prefetch(chunkIndex + 1);
  }
  setSpeed(rate) {
    this.speed = rate;
    for (let lc of this.loaded.values()) lc.audio.playbackRate = rate;
  }
  stop() {
    for (let lc of this.loaded.values())
      lc.audio.pause(), this.cb.revokeUrl(lc.url);
    this.loaded.clear(), this.playing = !1;
  }
  // Called on a ~100ms interval by main.ts; resolves current word from audio time.
  tick() {
    let lc = this.loaded.get(this.currentChunk);
    if (!lc || lc.timingsMs === null) return;
    let ms = lc.audio.currentTime * 1e3, word = -1;
    for (let w of lc.timingsMs)
      if (ms >= w.start) word = w.wordIndex;
      else break;
    word >= 0 && word !== this.currentWord && (this.currentWord = word, this.cb.onPosition(word, this.wordToSentence.get(word) ?? 0));
  }
  get isPlaying() {
    return this.playing;
  }
  get currentSentence() {
    return this.wordToSentence.get(Math.max(this.currentWord, 0)) ?? 0;
  }
};

// src/shell/word-runs.ts
function cleanRuns(docSlice, wordText, boxStart) {
  let runs = [], wi = 0, runStart = -1;
  for (let i = 0; i < docSlice.length && wi < wordText.length; i++)
    docSlice[i] === wordText[wi] ? (runStart < 0 && (runStart = i), wi++, wi === wordText.length && (runs.push({ from: boxStart + runStart, to: boxStart + i + 1 }), runStart = -1)) : runStart >= 0 && (runs.push({ from: boxStart + runStart, to: boxStart + i }), runStart = -1);
  return wi === wordText.length ? runs : [];
}
function buildWordEntries(model, docText) {
  let wordToSentence = /* @__PURE__ */ new Map();
  for (let s of model.sentences) for (let w of s.words) wordToSentence.set(w.index, s.index);
  return model.words.map((w) => {
    let box = docText.slice(w.source.start, w.source.end);
    return {
      index: w.index,
      text: w.text,
      runs: cleanRuns(box, w.text, w.source.start),
      sentence: wordToSentence.get(w.index) ?? -1,
      dirty: !1
    };
  });
}

// src/shell/session.ts
var ReadingSession = class {
  model;
  chunks;
  entries;
  synthesis;
  engine;
  view;
  onStateCb;
  rafId = null;
  _state = "idle";
  active = !1;
  // between a play/resume/seek and teardown/ended
  disposed = !1;
  constructor(opts) {
    this.view = opts.view, this.onStateCb = opts.onState, this.model = parseDocument(opts.docText, opts.uri, 1), this.chunks = buildChunks(this.model), this.entries = buildWordEntries(this.model, opts.docText), this.synthesis = new SynthesisService(new EdgeProvider(), "en-US-AriaNeural");
    let cb = {
      requestChunk: (i, priority) => this.requestChunk(i, priority),
      onPosition: (word, sentence) => this.onPosition(word, sentence),
      onState: (s) => this.handleEngineState(s),
      createAudio: () => new Audio(),
      makeUrl: (bytes, format) => URL.createObjectURL(
        new Blob([bytes.slice().buffer], {
          type: format === "mp3" ? "audio/mpeg" : "audio/wav"
        })
      ),
      revokeUrl: (url) => URL.revokeObjectURL(url)
    };
    this.engine = new Engine(this.model, this.chunks, cb), this.dispatch([setWords.of(this.entries)]);
  }
  // ─── Public API ────────────────────────────────────────────────────────────
  playPause() {
    if (!this.disposed) {
      if (this._state === "playing") {
        this.engine.pause();
        return;
      }
      if (this._state === "paused") {
        this.active = !0, this.engine.resume(), this.startLoop();
        return;
      }
      if (this._state === "ended") {
        this.active = !0, this.engine.jumpToWord(0), this.startLoop();
        return;
      }
      this.active = !0, this.engine.start(0), this.startLoop();
    }
  }
  stop() {
    this.disposed || (this._state = "idle", this.teardown(), this.onStateCb("idle"));
  }
  seekToWord(wordIndex) {
    this.disposed || (this.active = !0, this.engine.jumpToWord(wordIndex), this.startLoop());
  }
  dispose() {
    this.disposed || (this.disposed = !0, this._state = "idle", this.teardown());
  }
  get state() {
    return this._state;
  }
  // ─── Engine callbacks ────────────────────────────────────────────────────────
  requestChunk(i, priority) {
    this.synthesis.request(this.chunks[i], priority).then((a) => {
      this.disposed || this.engine.receiveChunk(i, a);
    }).catch((err) => {
      this.disposed || !this.active || (this._state = "error", this.active = !1, this.stopLoop(), this.onStateCb("error", err instanceof Error ? err.message : String(err)));
    });
  }
  onPosition(word, sentence) {
    let effects = [setPosition.of({ word, sentence })], first = (this.view.state.field(syncField, !1)?.words ?? this.entries).find((e) => e.sentence === sentence && e.runs.length > 0 && !e.dirty);
    if (first) {
      let pos = first.runs[0].from;
      try {
        let coords = this.view.coordsAtPos(pos), rect = this.view.scrollDOM.getBoundingClientRect();
        (!coords || coords.top < rect.top || coords.bottom > rect.bottom) && effects.push(import_view2.EditorView.scrollIntoView(pos, { y: "nearest" }));
      } catch {
      }
    }
    this.dispatch(effects);
  }
  handleEngineState(s) {
    this._state = s, s === "playing" ? this.startLoop() : this.stopLoop(), s === "ended" && (this.active = !1), this.onStateCb(s);
  }
  // ─── Internals ────────────────────────────────────────────────────────────────
  loop = () => {
    this.engine.tick(), this.rafId = requestAnimationFrame(this.loop);
  };
  startLoop() {
    this.rafId == null && (this.rafId = requestAnimationFrame(this.loop));
  }
  stopLoop() {
    this.rafId != null && (cancelAnimationFrame(this.rafId), this.rafId = null);
  }
  teardown() {
    this.active = !1, this.stopLoop(), this.engine.stop(), this.synthesis.abortAll(), this.dispatch([clearAll.of(null)]);
  }
  dispatch(effects) {
    try {
      this.view.dispatch({ effects });
    } catch {
    }
  }
};

// src/shell/acceptance.ts
var import_view3 = require("@codemirror/view");
var REPORT = "skeleton-acceptance.md", NOTE = "Skeleton Note.md", FIXTURE = `---
title: Skeleton fixture
---

# Heading With Words To Read

This first paragraph is plain prose with a good many ordinary words so the
reader has a calm runway to walk across before anything interesting happens.

The second paragraph has **bold emphasis**, some *italic drift*, an \`inline code\` span,
and a [markdown link](https://example.com) to strip out cleanly.

- A list item with a **bolded** word inside it and a few more plain words.
- Another list item, kept deliberately short and simple.

The closing paragraph gives the clock a long, calm runway of ordinary words to
end on, with enough length that several word boundaries pass while it plays.
`, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(pred, timeoutMs, step = 50) {
  let start = Date.now();
  for (; Date.now() - start < timeoutMs; ) {
    if (pred()) return !0;
    await sleep(step);
  }
  return pred();
}
async function runAcceptance(app) {
  let lines = ["# Skeleton acceptance report", ""], checks = [], check = (name, pass, detail) => {
    checks.push({ name, pass, detail }), lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
  }, write = () => app.vault.adapter.write(REPORT, lines.join(`
`) + `
`), session = null;
  try {
    lines.push(
      `Environment: platform=${process.platform}, electron=${process.versions?.electron ?? "none"}, chrome=${process.versions?.chrome ?? "none"}`,
      ""
    ), await app.vault.adapter.write(NOTE, FIXTURE);
    let file = app.vault.getAbstractFileByPath(NOTE) ?? app.vault.getFiles().find((f) => f.path === NOTE), leaf = app.workspace.getLeaf(!0);
    await leaf.openFile(file);
    let mdView = leaf.view;
    await mdView.setState(
      { ...mdView.getState(), mode: "source", source: !1 },
      { history: !1 }
    );
    let cm = mdView.editor.cm, field = () => cm.state.field(syncField), lastState = "idle";
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      onState: (s) => {
        lastState = s;
      }
    }), session.playPause();
    let started = await waitUntil(() => session.state === "playing" && field().word >= 0, 6e3);
    check(
      "play reaches playing and first word decoration appears within 6s",
      started,
      `state=${session.state}, word=${field().word}, engineState=${lastState}`
    );
    let cleanFails = [], sample2 = field().words.slice(0, 15);
    for (let e of sample2) {
      let painted = e.runs.map((r) => cm.state.doc.sliceString(r.from, r.to)).join("");
      painted !== e.text && cleanFails.push(`word ${e.index} "${e.text}" painted "${painted}"`);
    }
    check(
      "painted slices equal word text (no syntax painted), first 15 words",
      cleanFails.length === 0,
      cleanFails.length ? cleanFails.slice(0, 5).join("; ") : `${sample2.length} words, every painted slice === word text`
    );
    let advances = [];
    await new Promise((done) => {
      let last = field().word, t0 = performance.now(), obs = () => {
        let w = field().word;
        if (w !== last && w >= 0 && (advances.push({ t: performance.now(), word: w }), last = w), advances.length >= 10 || performance.now() - t0 > 6e3 || session.state !== "playing") {
          done();
          return;
        }
        requestAnimationFrame(obs);
      };
      requestAnimationFrame(obs);
    });
    let monotonic = !0, paintable = !0;
    for (let i = 1; i < advances.length; i++) advances[i].word < advances[i - 1].word && (monotonic = !1);
    for (let a of advances) {
      let e = field().words[a.word];
      (!e || e.dirty || e.runs.length === 0) && (paintable = !1);
    }
    check(
      "word advances are frame-synced and painted over a 10-word sample",
      advances.length >= 5 && monotonic && paintable,
      `${advances.length} advances observed, monotonic=${monotonic}, allPaintable=${paintable} (dispatch is synchronous in the rAF tick)`
    );
    let targetWords = field().words.filter((e) => e.runs.length > 0), target = targetWords[Math.min(targetWords.length - 1, 20)], clickResolved = -1, listener = (ev) => {
      let pos = cm.posAtCoords({ x: ev.clientX, y: ev.clientY });
      if (pos == null) return;
      let words = field().words, w = words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ?? words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
      w && (clickResolved = w.index, session.seekToWord(w.index));
    };
    cm.contentDOM.addEventListener("mousedown", listener);
    let mid = Math.floor((target.runs[0].from + target.runs[0].to) / 2);
    cm.dispatch({ effects: import_view3.EditorView.scrollIntoView(mid) }), await sleep(120);
    let coords = cm.coordsAtPos(mid);
    coords && cm.contentDOM.dispatchEvent(
      new MouseEvent("mousedown", {
        clientX: (coords.left + coords.right) / 2 || coords.left + 1,
        clientY: (coords.top + coords.bottom) / 2,
        bubbles: !0
      })
    ), cm.contentDOM.removeEventListener("mousedown", listener);
    let seeked = await waitUntil(
      () => field().word === target.index || field().word === target.index + 1,
      1500
    );
    check(
      "synthetic click seeks playback to the clicked word within 1s",
      seeked && clickResolved === target.index,
      `clicked=${clickResolved} target=${target.index} ("${target.text}"), current=${field().word}, coords=${!!coords}`
    ), await waitUntil(() => session.state === "playing", 2e3), session.playPause(), await waitUntil(() => session.state === "paused", 1500);
    let pausedWord = field().word, pausedSentence = field().sentence;
    await sleep(400);
    let frozen = field().word === pausedWord, sentenceWords = field().words.filter((e) => e.sentence === pausedSentence && e.runs.length > 0).map((e) => e.index), firstWord = sentenceWords.length ? Math.min(...sentenceWords) : pausedWord;
    session.playPause();
    let resumedAtStart = await waitUntil(
      () => session.state === "playing" && (field().word === firstWord || field().word === firstWord + 1),
      3e3
    );
    check(
      "pause freezes position; resume restarts from the sentence start",
      frozen && resumedAtStart,
      `frozen=${frozen} (word stayed ${pausedWord}); resumed at ${field().word}, sentence-start=${firstWord}`
    ), await waitUntil(() => session.state === "playing", 2e3);
    let probe = field().words.find((e) => e.runs.length > 0 && e.index > field().word + 3), probeBefore = probe ? probe.runs[0].from : -1, ins = "TYPED ";
    cm.dispatch({ changes: { from: 0, insert: ins } });
    let probeAfter = probe ? field().words[probe.index].runs[0]?.from ?? -1 : -1, stillPlaying = await waitUntil(() => session.state === "playing", 800) && session.state === "playing";
    check(
      "insertion upstream shifts decorations and playback continues",
      probe != null && probeAfter === probeBefore + ins.length && stillPlaying,
      `probe word ${probe?.index} ${probeBefore}->${probeAfter} (+${ins.length}), state=${session.state}`
    ), session.stop();
    let clearedNow = field().words.length === 0 && field().word === -1, wordAtStop = field().word;
    await sleep(500);
    let stayedFrozen = field().word === wordAtStop && field().words.length === 0;
    check(
      "stop clears all decorations and releases audio",
      clearedNow && stayedFrozen && session.state === "idle",
      `words=${field().words.length}, word=${field().word}, state=${session.state}, frozen after 500ms=${stayedFrozen}`
    );
    let allPass = checks.every((c) => c.pass);
    lines.splice(
      2,
      0,
      `RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${checks.filter((c) => c.pass).length}/${checks.length})`,
      ""
    ), await write();
  } catch (e) {
    lines.splice(2, 0, "RESULT: FAIL (unhandled)", "", String(e?.stack ?? e), "");
    try {
      await write();
    } catch {
    }
  } finally {
    session?.dispose();
  }
}

// src/shell/main.ts
var SpeakingEditorPlugin = class extends import_obsidian.Plugin {
  session = null;
  sessionView = null;
  ribbonEl = null;
  boundDoms = /* @__PURE__ */ new WeakSet();
  async onload() {
    this.registerEditorExtension(syncField), this.ribbonEl = this.addRibbonIcon("play-circle", "Play or pause reading", () => this.playPause()), this.addCommand({
      id: "play-pause",
      name: "Play or pause reading",
      callback: () => this.playPause()
    }), this.addCommand({
      id: "stop",
      name: "Stop reading",
      callback: () => this.stopSession()
    }), this.addCommand({
      id: "run-acceptance-checks",
      name: "Run acceptance checks",
      callback: () => {
        this.disposeSession(), runAcceptance(this.app);
      }
    });
  }
  onunload() {
    this.disposeSession();
  }
  // ─── Session wiring ──────────────────────────────────────────────────────────
  playPause() {
    let view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
    if (!view) return;
    let cm = view.editor.cm;
    if (cm) {
      if (this.session && this.sessionView === cm) {
        this.session.playPause();
        return;
      }
      this.disposeSession(), this.startSession(cm, view.file?.path ?? "untitled");
    }
  }
  startSession(cm, uri) {
    this.sessionView = cm, this.session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri,
      view: cm,
      onState: (s) => this.onSessionState(s)
    }), this.bindClickToSeek(cm), this.session.playPause();
  }
  stopSession() {
    this.session && (this.session.stop(), this.updateRibbon("idle"));
  }
  disposeSession() {
    this.session?.dispose(), this.session = null, this.sessionView = null, this.updateRibbon("idle");
  }
  onSessionState(state) {
    this.updateRibbon(state);
  }
  updateRibbon(state) {
    if (!this.ribbonEl) return;
    let icon = state === "playing" ? "pause" : state === "paused" ? "play" : "play-circle";
    (0, import_obsidian.setIcon)(this.ribbonEl, icon);
  }
  // ─── Click-to-seek ───────────────────────────────────────────────────────────
  // Bind once per editor DOM (sessions come and go on the same editor); the
  // handler is a no-op unless the active session belongs to this editor.
  bindClickToSeek(view) {
    let dom = view.contentDOM;
    this.boundDoms.has(dom) || (this.boundDoms.add(dom), this.registerDomEvent(dom, "mousedown", (evt) => this.onEditorMouseDown(view, evt)));
  }
  onEditorMouseDown(view, evt) {
    if (!this.session || this.sessionView !== view) return;
    let pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
    if (pos == null) return;
    let words = view.state.field(syncField).words, w = words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ?? words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
    w && this.session.seekToWord(w.index);
  }
};
/*! Bundled license information:

mime-db/index.js:
  (*!
   * mime-db
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015-2022 Douglas Christopher Wilson
   * MIT Licensed
   *)

mime-types/index.js:
  (*!
   * mime-types
   * Copyright(c) 2014 Jonathan Ong
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)

axios/dist/node/axios.cjs:
  (*! Axios v1.18.1 Copyright (c) 2026 Matt Zabriskie and contributors *)

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/
