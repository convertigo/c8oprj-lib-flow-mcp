function guideFamily(root, name) {
  var File = java.io.File, FU = Packages.org.apache.commons.io.FileUtils;
  var dir = new File(root, '_flow/resources/guide'), names = [name + '.md'];
  (dir.list() || []).forEach(function (file) {
    file = String(file);
    if (file.indexOf(name + '-') === 0 && /\.md$/.test(file)) names.push(file);
  });
  function walk(folder, prefix) {
    (folder.listFiles() || []).forEach(function (file) {
      if (file.isDirectory()) walk(file, prefix + file.getName() + '/');
      else if (/\.md$/.test(String(file.getName()))) names.push(prefix + file.getName());
    });
  }
  (dir.listFiles() || []).forEach(function (folder) {
    var folderName = String(folder.getName());
    if (folder.isDirectory() && (folderName === name || folderName.indexOf(name + '-') === 0))
      walk(folder, folderName + '/');
  });
  return names.map(function (file) { return String(FU.readFileToString(new File(dir, file), 'UTF-8')); }).join('\n\n').replace(/ \(\d+\.\d KB\)/g, '');
}
