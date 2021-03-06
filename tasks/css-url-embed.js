module.exports = function(grunt) {
  var URL_REGEX = /url\(["']?([^"'\(\)]+?)["']?\)[};, ](?!\s*?\/\*\s*?noembed\s*?\*\/)/;
  var URL_FILTERING_REGEX = /^(data|http|https):/;
  
  var fs = require('fs');
  var path = require('path');
  var mime = require('mime');
  
  grunt.registerMultiTask('cssUrlEmbed', "Embed URL's as base64 strings inside your stylesheets", function() {
    var options = this.options({
      excludeUrlExtensions: [],
      failOnMissingUrl: true
    });
    
    this.files.forEach(function(f) {
      var inputFile = f.src.filter(function(filepath) {
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found');
          return false;
        } else {
          return true;
        }
      });
      
      var outputContent = inputFile.map(function(f) {
        grunt.log.subhead('Processing source file "' + f + '"');
        
        return embedUrls(f, options);
      }).join('');
      
      grunt.file.write(f.dest, outputContent);
      grunt.log.writeln('File "' + f.dest + '" created');
    });
  });
  
  function embedUrls(f, options) {
    try {
      var source = grunt.file.read(f);
      var baseDir = path.resolve(options.baseDir ? options.baseDir : path.dirname(f));
      var urlRegex = new RegExp(URL_REGEX.source, 'g');
      var allUrls = [];
      var match;
      
      while ((match = urlRegex.exec(source))) {
        allUrls.push(match[1]);
      }
      
      var embeddableUrls = allUrls.filter(function(url) { return !url.match(URL_FILTERING_REGEX); });
      
      if (embeddableUrls.length === 0) {
        grunt.log.writeln("Nothing to embed here!");
        return source;
      }
      
      if (grunt.option('verbose')) {
        grunt.log.writeln('Using "' + baseDir + '" as base directory for URL\'s');
      }
      
      var uniqEmbeddableUrls = grunt.util._.uniq(embeddableUrls);
      
      grunt.log.writeln(uniqEmbeddableUrls.length + " embeddable URL" + (uniqEmbeddableUrls.length > 1 ? "'s" : "") + " found");
      
      uniqEmbeddableUrls.forEach(function(rawUrl, i) {
        if (grunt.option('verbose')) {
          grunt.log.writeln('\n[ #' + (i + 1) + ' ]');
        }
        
        var url = rawUrl;
        
        if (rawUrl.indexOf('?') >= 0) {
          url = rawUrl.split('?')[0];
          
          if (grunt.option('verbose')) {
            grunt.log.writeln('"' + rawUrl + '" trimmed to "' + url + '"');
          }
        }
        
        var urlFullPath = path.resolve(baseDir + '/' + url);
        
        if (grunt.option('verbose')) {
          grunt.log.writeln('"' + url + '" resolved to "' + urlFullPath + '"');
        }
        
        if (!grunt.file.exists(urlFullPath)) {
          var missingUrlMessage = '"' + (grunt.option('verbose') ? urlFullPath : url) + '" not found on disk';
          
          if (options.failOnMissingUrl) {
            grunt.fail.warn(missingUrlMessage + '.');
          }
          
          grunt.log.warn(missingUrlMessage);
          
          return;
        }
        
        var base64Content = fs.readFileSync(urlFullPath, 'base64');
        var mimeType = mime.lookup(urlFullPath);
        var dataUri = '("data:' + mimeType + ';base64,' + base64Content + '")';
        var escapedRawUrl = rawUrl.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
        var rawUrlRegex = '\\([\'"]?' + escapedRawUrl + '[\'"]?\\)';
        
        source = source.replace(new RegExp(rawUrlRegex, 'g'), dataUri);
        
        grunt.log.ok('"' + rawUrl + '" embedded');
      });
      
      return source;
    } catch (e) {
      grunt.log.error(e);
      grunt.fail.warn('URL embed failed!');
    }
  }
};
