// Copyright 2016 Yahoo Inc.
// Licensed under the terms of the MIT license. Please see LICENSE file in the project root for terms.

var Promise = require('bluebird');
var buffer = require('./buffer');
var path = require('path');
var ejs = require('ejs');
var fs = require('fs');
var debug = require('debug')('yakbak:record');
var jsonFormatter = require('format-json')

/**
 * Read and pre-compile the tape template.
 * @type {Function}
 * @private
 */

var render = ejs.compile(fs.readFileSync(path.resolve(__dirname, '../src/tape.ejs'), 'utf8'));

/**
 * Record the http interaction between `req` and `res` to disk.
 * The format is a vanilla node module that can be used as
 * an http.Server handler.
 * @param {http.ClientRequest} req
 * @param {http.IncomingMessage} res
 * @param {String} filename
 * @returns {Promise.<String>}
 */

module.exports = function (req, res, reqBody, filename) {
  var responseFilename = filename.replace('.js', '.response_body.json')
  var resBody

  return buffer(res)
    .then((_resBody) => { resBody = Buffer.concat(_resBody) })
    .then(removeContentLengthHeader)
    .then(generateMockFile)
    .then(writeMockFile)
    .then(writeResponseFile)
    .then(() => filename)

  // Since we are storing the content as utf-8 instead of base64.
  // TODO: check the alternative to recalculate the Content-Lenght.
  function removeContentLengthHeader () {
    delete res.headers['content-length']
  }

  function generateMockFile () {
    return render({ req: req, res: res, reqBody: reqBody, responseFilename: responseFilename });
  }

  function writeMockFile (data) {
    return write(filename, data);
  }

  function writeResponseFile () {
    var jsonContent;
    try {
      jsonContent = JSON.parse(resBody.toString('utf8'));
    } catch (e) {}
    var content = jsonContent ? jsonFormatter.plain(jsonContent) : resBody;
    return write(responseFilename, content);
  }
};

/**
 * Write `data` to `filename`. Seems overkill to "promisify" this.
 * @param {String} filename
 * @param {String} data
 * @returns {Promise}
 */

function write(filename, data) {
  return Promise.fromCallback(function (done) {
    debug('write', filename);
    fs.writeFile(filename, data, done);
  });
}
