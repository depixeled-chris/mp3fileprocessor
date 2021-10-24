const fs = require('fs');
const path = require('path');
const NodeID3 = require('node-id3');
const sanitize = require("sanitize-filename");

// full path in windows is likely going to be something like
// "D:\\folder\\somestuff\\images"

const searchDirectory = 'D:\\mp3-processing';
const outputDirectory = searchDirectory+'\\output';

let singleDiscTracks = [];

const deleteFolderRecursive = function (directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
};


const createPath = function(path) {
  if (!fs.existsSync(path)){
    console.log('creating directory', path);
    fs.mkdirSync(path);
  }
}

const walk = function(dir, done, search) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      //console.log('file', file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          const pathChunks = file.split('\\');
          const lastChunk = pathChunks[pathChunks.length-1];
          const isOutputDirectory = file.substr(0, outputDirectory.length) === outputDirectory;
          console.log('isOutputDirectory', isOutputDirectory, file.substr(0, outputDirectory.length), outputDirectory);
          console.log('made it this far', isOutputDirectory);
          walk(file, function(err, res) {
            if(!isOutputDirectory) results = results.concat(res);
            if (!--pending) done(null, results);
          }, search);
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

if (fs.existsSync(outputDirectory.replace("\\\\", "\\"))){
  deleteFolderRecursive(outputDirectory.replace("\\\\", "\\"));
}
createPath (outputDirectory.replace("\\\\", "\\"));

walk(searchDirectory.replace("\\\\", "\\"), function(err, files) {
  if (err) throw err;
  const filesLength = files.length;
  console.log('filesLength', filesLength);
  if (filesLength) {
    for(let i = 0; i < filesLength; i++) {
      const file = files[i];
      const filename = file.split('\\').pop();
      const path = file.replace(filename, '');
      const extension = filename.split('.').pop();
      const isOutputDirectory = file.substr(0, outputDirectory.length) === outputDirectory;
      if(!isOutputDirectory && extension === 'mp3') {
        NodeID3.read(file, function(err, tags) {
          //console.log('tags', tags.raw.TPE1);
          const track = tags.trackNumber && tags.trackNumber.search('/') !== -1 ? tags.trackNumber.split('/')[0] : tags.trackNumber;
          const paddedTrack = track.padStart(2, '0');
          let folder = sanitize(`${tags.performerInfo}-${tags.album}`);
          const partOfSet = tags.partOfSet;
          console.log('partOfSet', partOfSet);

          createPath (`${outputDirectory}\\${folder}`.replace("\\\\", "\\"));

          if(tags.partOfSet && tags.partOfSet.search('/') !== -1 && Number(tags.partOfSet.split('/')[1]) > 1) {
            console.log('multi-parter', folder, tags.partOfSet);
            folder += '\\disc '+tags.partOfSet.split('/')[0];
            createPath (`${outputDirectory}\\${folder}`.replace("\\\\", "\\"));
          }

          let newFilename = `${outputDirectory}\\${folder}\\${paddedTrack} ${sanitize(tags.title)}.mp3`.replace("\\\\", "\\");
          
          console.log('oldFilename', file);
          console.log('newFilename', newFilename);
          console.log('folder', `${outputDirectory}\\${folder}`.replace("\\\\", "\\"));
          
          if(!fs.existsSync(newFilename)) {
            fs.copyFile(file, newFilename, function (err) {
              if (err) throw err;
              console.log('copying', file, newFilename);
            });
          } else {
            let counter = 1;
            while(fs.existsSync(newFilename)) {
              const filenameParts = newFilename.split('.');
              filenameParts.pop();
              newFilename = filenameParts.join('.')+'-'+counter+'.'+extension;
              counter++;
            }
            fs.copyFile(file, newFilename, function (err) {
              if (err) throw err;
              console.log('copying', file, newFilename);
            });
          }
        });
      }
    }
  }
});